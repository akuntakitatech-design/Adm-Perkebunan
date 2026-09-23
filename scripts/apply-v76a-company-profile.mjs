import fs from 'node:fs';

const file = 'backend/index.ts';
let source = fs.readFileSync(file, 'utf8');
let changed = false;

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(from, to);
  changed = true;
}

if (!source.includes("'GET /api/workspace/profile': [")) {
  replaceOnce(
    `type WorkspaceMeta = {\n  name: string;\n  ownerUserId: string;\n  createdAt: string;\n};`,
    `type WorkspaceMeta = {\n  name: string;\n  ownerUserId: string;\n  createdAt: string;\n  updatedAt?: string;\n  shortName?: string;\n  businessType?: string;\n  npwp?: string;\n  nib?: string;\n  address?: string;\n  village?: string;\n  district?: string;\n  city?: string;\n  province?: string;\n  postalCode?: string;\n  phone?: string;\n  email?: string;\n  website?: string;\n  picName?: string;\n  picPosition?: string;\n  fiscalYearStartMonth?: number;\n  currency?: string;\n  reportName?: string;\n  logoUrl?: string;\n};`,
    'WorkspaceMeta type',
  );

  const anchor = "  'POST /api/workspace/create': [";
  const routes = `  'GET /api/workspace/profile': [\n    requireAuth(),\n    async ctx => {\n      const wc = await workspaceContext(ctx.user!);\n      const rows = (await db.list<WorkspaceMeta>(metaTable(wc.workspaceId), { limit: 1 })).items;\n      const meta = rows[0];\n      return json({\n        profile: {\n          name: meta?.name || wc.membership.workspaceName,\n          shortName: meta?.shortName || '',\n          businessType: meta?.businessType || '',\n          npwp: meta?.npwp || '',\n          nib: meta?.nib || '',\n          address: meta?.address || '',\n          village: meta?.village || '',\n          district: meta?.district || '',\n          city: meta?.city || '',\n          province: meta?.province || '',\n          postalCode: meta?.postalCode || '',\n          phone: meta?.phone || '',\n          email: meta?.email || '',\n          website: meta?.website || '',\n          picName: meta?.picName || '',\n          picPosition: meta?.picPosition || '',\n          fiscalYearStartMonth: Number(meta?.fiscalYearStartMonth || 1),\n          currency: meta?.currency || 'IDR',\n          reportName: meta?.reportName || meta?.name || wc.membership.workspaceName,\n          logoUrl: meta?.logoUrl || '',\n        },\n        canEdit: canManageMaster(wc.membership.role),\n      });\n    },\n  ],\n  'PUT /api/workspace/profile': [\n    requireAuth(),\n    async ctx => {\n      const wc = await workspaceContext(ctx.user!);\n      if (!canManageMaster(wc.membership.role)) return error('Hanya Owner/Admin Pusat yang dapat mengubah Profil Perusahaan.', 403);\n      const body = objectBody(ctx.body);\n      const name = text(body.name).trim().slice(0, 120);\n      if (name.length < 2) return error('Nama perusahaan minimal 2 karakter.', 400);\n      const month = Math.max(1, Math.min(12, Math.floor(decimal(body.fiscalYearStartMonth) || 1)));\n      const table = metaTable(wc.workspaceId);\n      const rows = (await db.list<WorkspaceMeta>(table, { limit: 1 })).items;\n      const existing = rows[0];\n      const stamp = now();\n      const profile: WorkspaceMeta = {\n        name,\n        ownerUserId: existing?.ownerUserId || ctx.user!.userId,\n        createdAt: existing?.createdAt || stamp,\n        updatedAt: stamp,\n        shortName: text(body.shortName).slice(0, 80),\n        businessType: text(body.businessType).slice(0, 40),\n        npwp: text(body.npwp).slice(0, 40),\n        nib: text(body.nib).slice(0, 60),\n        address: text(body.address).slice(0, 500),\n        village: text(body.village).slice(0, 100),\n        district: text(body.district).slice(0, 100),\n        city: text(body.city).slice(0, 100),\n        province: text(body.province).slice(0, 100),\n        postalCode: text(body.postalCode).slice(0, 12),\n        phone: text(body.phone).slice(0, 40),\n        email: text(body.email).slice(0, 160),\n        website: text(body.website).slice(0, 200),\n        picName: text(body.picName).slice(0, 120),\n        picPosition: text(body.picPosition).slice(0, 120),\n        fiscalYearStartMonth: month,\n        currency: text(body.currency).slice(0, 8) || 'IDR',\n        reportName: text(body.reportName).slice(0, 160) || name,\n        logoUrl: text(body.logoUrl).slice(0, 500),\n      };\n\n      if (existing?.id) {\n        const [ok] = await db.update(table, [{ id: existing.id, record: profile }]);\n        if (!ok) return error('Profil Perusahaan gagal diperbarui.', 500);\n      } else {\n        const [id] = await db.add(table, [profile]);\n        if (!id) return error('Profil Perusahaan gagal disimpan.', 500);\n      }\n\n      const members = (await db.list<MemberRecord>(membersTable(wc.workspaceId), { limit: 100 })).items;\n      for (const member of members) {\n        const membershipTable = membershipsTable(member.userId);\n        const memberships = (await db.list<MembershipRecord>(membershipTable, { limit: 100 })).items;\n        const target = memberships.find(item => item.workspaceId === wc.workspaceId);\n        if (!target?.id || target.workspaceName === name) continue;\n        const { id, ...record } = target;\n        await db.update(membershipTable, [{ id, record: { ...record, workspaceName: name } }]);\n      }\n\n      return json({ profile });\n    },\n  ],\n`;
  replaceOnce(anchor, routes + anchor, 'workspace create route');
}

if (!changed) {
  console.log('v76 company profile backend already applied.');
} else {
  fs.writeFileSync(file, source);
  console.log('v76 company profile backend applied.');
}
