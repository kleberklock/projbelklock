const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log("=== INICIANDO LIMPEZA DO BANCO DE DADOS ===");
  try {
    // 1. Deletar dados de tabelas dependentes (chaves estrangeiras) primeiro
    console.log("Limpando dados de Consignados...");
    await prisma.consignado.deleteMany({});

    console.log("Limpando dados de Vendas de Revendedoras...");
    await prisma.vendaRevendedora.deleteMany({});

    console.log("Limpando dados de Vendas Diretas...");
    await prisma.vendaDireta.deleteMany({});

    console.log("Limpando dados de Histórico de Acertos...");
    await prisma.historicoAcerto.deleteMany({});

    console.log("Limpando logs de ações...");
    await prisma.logAcao.deleteMany({});

    console.log("Limpando dados de Clientes...");
    await prisma.cliente.deleteMany({});

    console.log("Limpando dados de Produtos...");
    await prisma.produto.deleteMany({});

    // 2. Limpar todos os usuários do sistema
    console.log("Limpando todos os Usuários...");
    await prisma.usuario.deleteMany({});

    console.log("Todos os dados foram excluídos com sucesso!");

    // 3. Criar a conta Administradora principal padrão
    console.log("\nCriando conta administradora principal padrão...");
    const emailAdmin = "admin@belklock.com";
    const pinAdmin = "0001";
    const senhaPadrao = "belklock";
    const senhaHash = await bcrypt.hash(senhaPadrao, 10);

    const novoAdmin = await prisma.usuario.create({
      data: {
        nome: "Bel Klock Admin",
        email: emailAdmin,
        pin: pinAdmin,
        senhaHash: senhaHash,
        role: "ADMIN_LOJA",
        whatsapp: "(11) 99999-9999",
        comissao: 0.0
      }
    });

    console.log("=========================================");
    console.log("Administrador padrão criado com sucesso!");
    console.log(`E-mail: ${novoAdmin.email}`);
    console.log(`PIN (Login): ${pinAdmin}`);
    console.log(`Senha padrão: ${senhaPadrao}`);
    console.log("=========================================");

  } catch (err) {
    console.error("Erro crítico ao limpar o banco de dados:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
