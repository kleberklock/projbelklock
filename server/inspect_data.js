const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("=== INSPECIONANDO HISTÓRICO DE ACERTOS ===");
    const acertos = await prisma.historicoAcerto.findMany();
    console.log(`Total de acertos: ${acertos.length}`);
    if (acertos.length > 0) {
      console.log("Exemplo de acerto:", acertos[0]);
      acertos.forEach((a, i) => {
        console.log(`Acerto ${i}: usuarioId=${a.usuarioId}, data=${a.data}, faturamentoBruto=${a.faturamentoBruto}, comissaoPaga=${a.comissaoPaga}, valorDescontoPerda=${a.valorDescontoPerda}`);
      });
    }

    console.log("\n=== INSPECIONANDO VENDAS DIRETAS ===");
    const vendasDiretas = await prisma.vendaDireta.findMany();
    console.log(`Total de vendas diretas: ${vendasDiretas.length}`);
    if (vendasDiretas.length > 0) {
      console.log("Exemplo de venda direta:", vendasDiretas[0]);
    }

    console.log("\n=== INSPECIONANDO VENDAS REVENDEDORA ===");
    const vendasRev = await prisma.vendaRevendedora.findMany();
    console.log(`Total de vendas revendedora: ${vendasRev.length}`);
    if (vendasRev.length > 0) {
      console.log("Exemplo de venda revendedora:", vendasRev[0]);
    }
  } catch (err) {
    console.error("Erro ao inspecionar dados:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
