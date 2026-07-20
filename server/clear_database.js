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

    console.log("Limpando Links de Pagamento...");
    await prisma.linkPagamento.deleteMany({});

    console.log("Limpando Respostas do Onboarding...");
    await prisma.respostaOnboarding.deleteMany({});

    console.log("Limpando Documentos dos Usuários...");
    await prisma.documentoUsuario.deleteMany({});

    console.log("Limpando Termos de Consignação...");
    await prisma.termoConsignacao.deleteMany({});

    console.log("Limpando Faixas de Comissão...");
    await prisma.faixaComissao.deleteMany({});

    console.log("Limpando logs de ações...");
    await prisma.logAcao.deleteMany({});

    console.log("Limpando dados de Clientes...");
    await prisma.cliente.deleteMany({});

    console.log("Limpando dados de Produtos...");
    await prisma.produto.deleteMany({});

    console.log("Limpando Notificações do sistema...");
    await prisma.notificacao.deleteMany({});

    console.log("Limpando Configurações das lojas...");
    await prisma.configuracao.deleteMany({});

    console.log("Limpando todos os Usuários...");
    await prisma.usuario.deleteMany({});

    console.log("Limpando Mensagens do WhatsApp...");
    await prisma.mensagemWhatsapp.deleteMany({});

    console.log("Limpando Treinamentos cadastrados...");
    await prisma.treinamento.deleteMany({});

    console.log("Limpando Lojas do sistema...");
    await prisma.loja.deleteMany({});

    console.log("Todos os dados do banco foram limpos com sucesso!");

    // 2. Criar apenas a conta de SuperAdmin de forma segura
    console.log("\nCriando conta do SuperAdmin padrão...");
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

    console.log("=========================================");
    console.log("SuperAdmin criado com sucesso!");
    console.log(`E-mail: ${superAdmin.email}`);
    console.log(`PIN (Login): ${superAdminPin}`);
    console.log("=========================================");

  } catch (err) {
    console.error("Erro crítico ao limpar o banco de dados:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
