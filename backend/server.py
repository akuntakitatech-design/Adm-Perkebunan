"""
FastAPI gateway untuk Administrasi Perkebunan.

Supervisor menjalankan `uvicorn server:app` di port 8001 (read-only config),
sementara logika bisnis aplikasi ini berada di Node.js/Express (TypeScript).
Modul ini:
  1. Menjalankan server Node (tsx server/index.ts) sebagai child process di port internal.
  2. Mem-proxy seluruh request `/api/*` dan `/uploads/*` ke server Node tersebut,
     termasuk header Cookie / Set-Cookie agar sesi login tetap bekerja.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from starlette.background import BackgroundTask
from starlette.responses import StreamingResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("gateway")

NODE_DIR = ROOT_DIR
NODE_PORT = int(os.environ.get("NODE_PORT", "8002"))
NODE_BASE_URL = f"http://127.0.0.1:{NODE_PORT}"

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-length",
    "host",
}


class NodeProcess:
    """Mengelola lifecycle child process server Node."""

    def __init__(self) -> None:
        self.process: subprocess.Popen | None = None
        self._pump_task: asyncio.Task | None = None

    def start(self) -> None:
        if self.process and self.process.poll() is None:
            return
        env = os.environ.copy()
        env.setdefault("NODE_PORT", str(NODE_PORT))
        env.setdefault("STORAGE_DIR", str(ROOT_DIR / "uploads"))
        tsx_bin = NODE_DIR / "node_modules" / ".bin" / "tsx"
        cmd = [str(tsx_bin), "server/index.ts"]
        logger.info("Menjalankan server Node: %s (cwd=%s)", " ".join(cmd), NODE_DIR)
        self.process = subprocess.Popen(
            cmd,
            cwd=str(NODE_DIR),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            start_new_session=True,
        )

    async def pump_logs(self) -> None:
        """Meneruskan log Node ke stdout uvicorn (agar terlihat di supervisor log)."""
        assert self.process and self.process.stdout
        loop = asyncio.get_running_loop()
        stream = self.process.stdout
        while True:
            line = await loop.run_in_executor(None, stream.readline)
            if not line:
                break
            sys.stdout.write(f"[node] {line}")
            sys.stdout.flush()

    async def wait_ready(self, timeout: float = 60.0) -> bool:
        deadline = asyncio.get_running_loop().time() + timeout
        async with httpx.AsyncClient(timeout=2.0) as client:
            while asyncio.get_running_loop().time() < deadline:
                if self.process and self.process.poll() is not None:
                    logger.error("Server Node berhenti dengan kode %s", self.process.returncode)
                    return False
                try:
                    resp = await client.get(f"{NODE_BASE_URL}/api/_healthcheck")
                    if resp.status_code < 500:
                        logger.info("Server Node siap di %s", NODE_BASE_URL)
                        return True
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.5)
        return False

    def stop(self) -> None:
        if not self.process or self.process.poll() is not None:
            return
        try:
            os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
            self.process.wait(timeout=10)
        except Exception:  # noqa: BLE001
            try:
                os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
            except Exception:  # noqa: BLE001
                pass

    def is_alive(self) -> bool:
        return bool(self.process and self.process.poll() is None)


node = NodeProcess()
http_client: httpx.AsyncClient | None = None


async def supervise_node() -> None:
    """Restart Node otomatis jika crash."""
    while True:
        await asyncio.sleep(3)
        if not node.is_alive():
            logger.warning("Server Node tidak aktif, mencoba menjalankan ulang...")
            node.start()
            asyncio.create_task(node.pump_logs())
            await node.wait_ready()


@asynccontextmanager
async def lifespan(_: FastAPI):
    global http_client
    node.start()
    pump = asyncio.create_task(node.pump_logs())
    await node.wait_ready()
    http_client = httpx.AsyncClient(
        base_url=NODE_BASE_URL,
        timeout=httpx.Timeout(120.0, connect=5.0),
        limits=httpx.Limits(max_connections=200, max_keepalive_connections=50),
    )
    supervisor_task = asyncio.create_task(supervise_node())
    try:
        yield
    finally:
        supervisor_task.cancel()
        pump.cancel()
        if http_client:
            await http_client.aclose()
        node.stop()


app = FastAPI(title="Administrasi Perkebunan Gateway", lifespan=lifespan)


@app.get("/api/_gateway")
async def gateway_status():
    return {"gateway": "ok", "node_alive": node.is_alive(), "node_port": NODE_PORT}


async def proxy(request: Request) -> Response:
    assert http_client is not None
    if not node.is_alive():
        return Response(
            content='{"error":"Server aplikasi sedang dimulai ulang. Silakan coba beberapa detik lagi."}',
            status_code=503,
            media_type="application/json",
        )

    url = request.url.path
    if request.url.query:
        url = f"{url}?{request.url.query}"

    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_BY_HOP_HEADERS}
    headers["x-forwarded-proto"] = request.headers.get("x-forwarded-proto", request.url.scheme)
    headers["x-forwarded-host"] = request.headers.get("host", "")
    body = await request.body()

    try:
        upstream = http_client.build_request(request.method, url, headers=headers, content=body)
        resp = await http_client.send(upstream, stream=True)
    except httpx.HTTPError as exc:
        logger.error("Proxy gagal %s %s: %s", request.method, url, exc)
        return Response(
            content='{"error":"Server aplikasi tidak dapat dihubungi. Silakan coba lagi."}',
            status_code=502,
            media_type="application/json",
        )

    response = StreamingResponse(
        resp.aiter_raw(),
        status_code=resp.status_code,
        background=BackgroundTask(resp.aclose),
    )
    # Salin semua header upstream (mendukung multi Set-Cookie) tanpa hop-by-hop headers.
    response.raw_headers = [
        (k.lower().encode("latin-1"), v.encode("latin-1"))
        for k, v in resp.headers.multi_items()
        if k.lower() not in HOP_BY_HOP_HEADERS
    ]
    return response


METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]


@app.api_route("/api/{path:path}", methods=METHODS)
async def proxy_api(request: Request, path: str):  # noqa: ARG001
    return await proxy(request)


@app.api_route("/uploads/{path:path}", methods=["GET", "HEAD"])
async def proxy_uploads(request: Request, path: str):  # noqa: ARG001
    return await proxy(request)
