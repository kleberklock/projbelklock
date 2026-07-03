/**
 * Script de Migração de Roles — Etapa 2 RBAC
 * Converte os roles antigos ("admin", "revendedora") para os novos valores uppercase
 * ("Manager", "Consultant").
 * 
 * Execute uma única vez: node migrar-roles.js
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function migrarRoles() {
  console.log('Iniciando migração de roles...\n');

  // 1. Migrar "admin" e "ADMIN_LOJA" → "Manager"
  const resultAdmin = await prisma.usuario.updateMany({
    where: { role: { in: ['admin', 'ADMIN_LOJA'] } },
    data: { role: 'Manager' }
  });
  console.log(`✅ Migrados ${resultAdmin.count} usuário(s) para "Manager"`);

  // 2. Migrar "revendedora" e "VENDEDORA" → "Consultant"
  const resultVendedora = await prisma.usuario.updateMany({
    where: { role: { in: ['revendedora', 'VENDEDORA'] } },
    data: { role: 'Consultant' }
  });
  console.log(`✅ Migrados ${resultVendedora.count} usuário(s) para "Consultant"`);

  // 3. Migrar "SUPER_ADMIN" → "SuperAdmin"
  const resultSuper = await prisma.usuario.updateMany({
    where: { role: 'SUPER_ADMIN' },
    data: { role: 'SuperAdmin' }
  });
  console.log(`✅ Migrados ${resultSuper.count} usuário(s) para "SuperAdmin"`);

  // Verificação final
  const todos = await prisma.usuario.findMany({ select: { nome: true, email: true, role: true } });
  console.log('\n📋 Estado final dos usuários:');
  todos.forEach(u => console.log(`   - ${u.nome} (${u.email || 'sem email'}): ${u.role}`));

  console.log('\nMigração concluída com sucesso!');
  await prisma.$disconnect();
}

migrarRoles().catch(async (e) => {
  console.error('Erro durante a migração:', e);
  await prisma.$disconnect();
  process.exit(1);
});
