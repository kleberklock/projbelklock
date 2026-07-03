const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("=== INSPECIONANDO CONTAGEM DO BANCO DE DADOS ===");
    const lojas = await prisma.loja.count();
    const usuarios = await prisma.usuario.count();
    const produtos = await prisma.produto.count();
    const consignados = await prisma.consignado.count();
    const acertos = await prisma.historicoAcerto.count();
    const vendasDireta = await prisma.vendaDireta.count();
    const vendasRev = await prisma.vendaRevendedora.count();
    const clientes = await prisma.cliente.count();
    const configuracao = await prisma.configuracao.count();
    const treinamentos = await prisma.treinamento.count();
    const whatsapp = await prisma.mensagemWhatsapp.count();

    console.log(`Lojas: ${lojas}`);
    console.log(`Usuários: ${usuarios}`);
    console.log(`Produtos: ${produtos}`);
    console.log(`Consignados: ${consignados}`);
    console.log(`Histórico de Acertos: ${acertos}`);
    console.log(`Vendas Diretas: ${vendasDireta}`);
    console.log(`Vendas Revendedora: ${vendasRev}`);
    console.log(`Clientes: ${clientes}`);
    console.log(`Configuração: ${configuracao}`);
    console.log(`Treinamentos: ${treinamentos}`);
    console.log(`Fila de WhatsApp: ${whatsapp}`);
  } catch (err) {
    console.error("Erro ao inspecionar contagem de dados:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
