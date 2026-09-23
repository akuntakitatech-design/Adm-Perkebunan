# =============================================================
# Administrasi Perkebunan — Frontend (React + Vite) di Nginx
# Base directory di Coolify: /frontend  |  Build pack: Dockerfile
# Env runtime: BACKEND_URL (contoh: http://backend-payroll:3000)
# =============================================================
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM nginx:1.27-alpine AS runtime
ENV BACKEND_URL=http://backend:3000 \
    NGINX_PORT=80 \
    CLIENT_MAX_BODY_SIZE=10m
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:${NGINX_PORT}/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
