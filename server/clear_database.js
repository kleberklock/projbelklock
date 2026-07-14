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

    // 2. Criar a estrutura básica padrão
    console.log("\nCriando Loja Padrão...");
    await prisma.loja.create({
      data: {
        id: "default-loja",
        nome: "Loja Padrão",
        plano: "GOLD"
      }
    });

    console.log("Criando Configuração da Loja Padrão...");
    await prisma.configuracao.create({
      data: {
        lojaId: "default-loja",
        nomeEmpresa: "Conecta Joias",
        corPrimaria: "#d4af37",
        corSecundaria: "#111111",
        bgPrimary: "#0a0a0a",
        bgCard: "#121212",
        onboardingCompleto: true
      }
    });

    // 3. Criar a conta de SuperAdmin e Manager de forma segura
    console.log("Criando conta do SuperAdmin e da Gestora padrão...");
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

    const managerEmail = "admin@conectajoias.com";
    const managerPin = "0002";
    const managerSenha = "conectajoias";
    const managerSenhaHash = await bcrypt.hash(managerSenha, 10);
    const manager = await prisma.usuario.create({
      data: {
        nome: "Conecta Joias Admin",
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
