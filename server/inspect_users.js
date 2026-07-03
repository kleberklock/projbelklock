const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("=== INSPECIONANDO USUÁRIOS ===");
    const usuarios = await prisma.usuario.findMany({
      include: {
        loja: true
      }
    });
    console.log(`Total de usuários: ${usuarios.length}`);
    usuarios.forEach((u, i) => {
      console.log(`Usuário ${i}:`);
      console.log(`  ID: ${u.id}`);
      console.log(`  Nome: ${u.nome}`);
      console.log(`  E-mail: ${u.email}`);
      console.log(`  Role: ${u.role}`);
      console.log(`  Loja ID: ${u.lojaId}`);
      console.log(`  Loja Nome: ${u.loja ? u.loja.nome : 'Nenhuma'}`);
      console.log(`  Termo Assinado: ${u.termoAssinado}`);
      console.log("-----------------------------------------");
    });
  } catch (err) {
    console.error("Erro ao inspecionar usuários:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
