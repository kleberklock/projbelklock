/**
 * Script de Migração de Roles — Etapa 2 RBAC
 * Converte os roles antigos ("admin", "revendedora") para os novos valores uppercase
 * ("ADMIN_LOJA", "VENDEDORA").
 * 
 * Execute uma única vez: node migrar-roles.js
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function migrarRoles() {
  console.log('Iniciando migração de roles...\n');

  // 1. Migrar "admin" → "ADMIN_LOJA"
  const resultAdmin = await prisma.usuario.updateMany({
    where: { role: 'admin' },
    data: { role: 'ADMIN_LOJA' }
  });
  console.log(`✅ Migrados ${resultAdmin.count} usuário(s) de "admin" → "ADMIN_LOJA"`);

  // 2. Migrar "revendedora" → "VENDEDORA"
  const resultVendedora = await prisma.usuario.updateMany({
    where: { role: 'revendedora' },
    data: { role: 'VENDEDORA' }
  });
  console.log(`✅ Migrados ${resultVendedora.count} usuário(s) de "revendedora" → "VENDEDORA"`);

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
