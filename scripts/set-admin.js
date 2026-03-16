/**
 * Promove um usuário a admin (role = 'admin') no banco de produção.
 * Lê dois envs: DATABASE_URL_ORIGEM (lista usuários) e DATABASE_URL_PRODUCAO (onde aplica o admin).
 *
 * Uso: node scripts/set-admin.js [userId]
 * Se não passar userId, lista os usuários do banco de origem para você copiar o id.
 */

const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '..', '.env');

function loadEnv() {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (['DATABASE_URL_ORIGEM', 'DATABASE_URL_ORIGIN', 'URL_DEV'].includes(key)) process.env.DATABASE_URL_ORIGEM = val;
    if (['DATABASE_URL_PRODUCAO', 'DATABASE_URL_PRODUCTION', 'URL_PROD'].includes(key)) process.env.DATABASE_URL_PRODUCAO = val;
  }
}
loadEnv();

const urlOrigem = process.env.DATABASE_URL_ORIGEM || process.env.DATABASE_URL_ORIGIN;
const urlProducao = process.env.DATABASE_URL_PRODUCAO || process.env.DATABASE_URL_PRODUCTION;

if (!urlOrigem || !urlProducao) {
  console.error('Defina no .env:');
  console.error('  DATABASE_URL_ORIGEM  = banco de origem (lista usuários)');
  console.error('  DATABASE_URL_PRODUCAO = banco de produção (onde o admin é aplicado)');
  process.exit(1);
}

const { PrismaClient } = require('../src/lib/prisma-bio-client');
const prismaOrigem = new PrismaClient({ datasources: { db: { url: urlOrigem } } });
const prismaProducao = new PrismaClient({ datasources: { db: { url: urlProducao } } });

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    const users = await prismaOrigem.user.findMany({
      select: { id: true, nickname: true, role: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    console.log('Usuários (banco de origem, últimos 20). Passe o id para promover a admin no banco de produção:');
    console.log('');
    for (const u of users) {
      console.log(`  ${u.id}  nickname=${u.nickname || '(vazio)'}  role=${u.role}`);
    }
    console.log('');
    console.log('Exemplo: node scripts/set-admin.js ' + (users[0]?.id || '<id>'));
    return;
  }

  const user = await prismaProducao.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error('Usuário não encontrado no banco de produção:', userId);
    process.exit(1);
  }

  if (user.role === 'admin') {
    console.log('Usuário já é admin no banco de produção:', user.nickname || user.id);
    return;
  }

  await prismaProducao.user.update({
    where: { id: userId },
    data: { role: 'admin' },
  });
  console.log('Admin definido no banco de produção:', user.nickname || user.id, '(' + user.id + ')');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaOrigem.$disconnect();
    await prismaProducao.$disconnect();
  });
