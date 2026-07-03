const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();
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

    // 3. Criar a conta de SuperAdmin e Manager de forma segura
    console.log("\nCriando conta do SuperAdmin e da Gestora padrão...");
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "superadmin@plataforma.com";
    const superAdminSenha = process.env.SUPER_ADMIN_SENHA || "admin0001";
    const superAdminPin = process.env.SUPER_ADMIN_PIN || "0001";
    
    const superAdminSenhaHash = await bcrypt.hash(superAdminSenha, 10);
    const superAdmin = await prisma.usuario.create({
      data: {
        nome: "Super Admin",
        email: superAdminEmail,
        pin: superAdminPin,
        senhaHash: superAdminSenhaHash,
        role: "SuperAdmin",
        comissao: 0.0
      }
    });

    const managerEmail = "admin@belklock.com";
    const managerPin = "0002";
    const managerSenha = "belklock";
    const managerSenhaHash = await bcrypt.hash(managerSenha, 10);
    const manager = await prisma.usuario.create({
      data: {
        nome: "Bel Klock Admin",
        email: managerEmail,
        pin: managerPin,
        senhaHash: managerSenhaHash,
        role: "Manager",
        lojaId: "default-loja",
        whatsapp: "(11) 99999-9999",
        comissao: 0.0
      }
    });

    console.log("=========================================");
    console.log("SuperAdmin criado com sucesso!");
    console.log(`E-mail: ${superAdmin.email}`);
    console.log(`PIN (Login): ${superAdminPin}`);
    console.log("-----------------------------------------");
    console.log("Gestora (Manager) criada com sucesso!");
    console.log(`E-mail: ${manager.email}`);
    console.log(`PIN (Login): ${managerPin}`);
    console.log("=========================================");

  } catch (err) {
    console.error("Erro crítico ao limpar o banco de dados:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
