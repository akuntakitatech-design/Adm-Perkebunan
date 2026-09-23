import fs from 'node:fs';

const file = 'backend/index.ts';
let source = fs.readFileSync(file, 'utf8');
let changed = false;

// Naikkan kapasitas daftar perusahaan per user tanpa mengubah tabel bisnis lain.
const limitReplacements = [
  ['db.list<MembershipRecord>(membershipKey, { limit: 20 })', 'db.list<MembershipRecord>(membershipKey, { limit: 100 })'],
  ['db.list<MembershipRecord>(membershipsTable(user.userId), { limit: 20 })', 'db.list<MembershipRecord>(membershipsTable(user.userId), { limit: 100 })'],
  ['db.list<MembershipRecord>(membershipsTable(ctx.user!.userId), { limit: 20 })', 'db.list<MembershipRecord>(membershipsTable(ctx.user!.userId), { limit: 100 })'],
];
for (const [from, to] of limitReplacements) {
  if (source.includes(from)) {
    source = source.split(from).join(to);
    changed = true;
  }
}

if (!source.includes("'POST /api/workspace/create': [")) {
  const anchor = "  'POST /api/workspace/switch': [";
  if (!source.includes(anchor)) throw new Error('Anchor workspace/switch not found.');
  const route = `  'POST /api/workspace/create': [\n    requireAuth(),\n    async ctx => {\n      const body = objectBody(ctx.body);\n      const workspaceName = text(body.name).trim().slice(0, 120);\n      if (workspaceName.length < 2) return error('Nama perusahaan minimal 2 karakter.', 400);\n\n      const membershipKey = membershipsTable(ctx.user!.userId);\n      const memberships = (await db.list<MembershipRecord>(membershipKey, { limit: 100 })).items;\n      if (memberships.length >= 100) return error('Maksimal 100 perusahaan dapat diakses oleh satu akun.', 409);\n      if (memberships.some(item => item.workspaceName.trim().toLowerCase() === workspaceName.toLowerCase())) {\n        return error('Perusahaan dengan nama tersebut sudah ada pada akses Anda.', 409);\n      }\n\n      const workspaceId = 'ws-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);\n      const stamp = now();\n      const membership: MembershipRecord = {\n        workspaceId,\n        workspaceName,\n        role: 'OWNER',\n        assignedKebunIds: [],\n        joinedAt: stamp,\n      };\n\n      const [membershipId] = await db.add(membershipKey, [membership]);\n      if (!membershipId) return error('Perusahaan baru gagal dibuat.', 500);\n\n      const [metaId] = await db.add(metaTable(workspaceId), [\n        { name: workspaceName, ownerUserId: ctx.user!.userId, createdAt: stamp },\n      ]);\n      if (!metaId) {\n        await db.delete(membershipKey, [membershipId]);\n        return error('Identitas perusahaan baru gagal dibuat.', 500);\n      }\n\n      const [memberId] = await db.add(membersTable(workspaceId), [{\n        userId: ctx.user!.userId,\n        email: ctx.user!.email || '',\n        name: ctx.user!.name || ctx.user!.email || 'Owner',\n        role: 'OWNER',\n        assignedKebunIds: [],\n        joinedAt: stamp,\n      }]);\n      if (!memberId) {\n        await db.delete(metaTable(workspaceId), [metaId]);\n        await db.delete(membershipKey, [membershipId]);\n        return error('Owner perusahaan baru gagal dibuat.', 500);\n      }\n\n      try {\n        await setActiveWorkspace(ctx.user!.userId, workspaceId);\n      } catch (err) {\n        return error(err instanceof Error ? err.message : 'Perusahaan sudah dibuat tetapi belum dapat diaktifkan.', 500);\n      }\n\n      return json({\n        workspace: { id: workspaceId, name: workspaceName, role: 'OWNER', assignedKebunIds: [] },\n      }, 201);\n    },\n  ],\n`;
  source = source.replace(anchor, route + anchor);
  changed = true;
}

if (!changed) {
  console.log('v75 multi-company backend already applied.');
  process.exit(0);
}

fs.writeFileSync(file, source);
console.log('v75 multi-company backend applied.');
