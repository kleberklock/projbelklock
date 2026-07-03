const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando semeadura de dados (Seed)...");

  // 1. Garantir que a Loja Padrão existe
  console.log("Verificando Loja Padrão...");
  let loja = await prisma.loja.findUnique({
    where: { id: "default-loja" }
  });

  if (!loja) {
    loja = await prisma.loja.create({
      data: {
        id: "default-loja",
        nome: "BelKlock Semijoias",
        cnpj: "12.345.678/0001-90"
      }
    });
    console.log("✅ Loja Padrão criada.");
  } else {
    console.log("ℹ️ Loja Padrão já existe.");
  }

  // 2. Criar ou Atualizar Administrador Principal
  const emailAdmin = "admin@belklock.com";
  const pinAdmin = "0001";
  const senhaPadrao = "belklock";
  const senhaHash = await bcrypt.hash(senhaPadrao, 10);

  const adminExiste = await prisma.usuario.findUnique({
    where: { email: emailAdmin }
  });

  let adminUser;
  if (adminExiste) {
    adminUser = await prisma.usuario.update({
      where: { email: emailAdmin },
      data: {
        pin: pinAdmin,
        senhaHash: senhaHash,
        role: "ADMIN_LOJA",
        lojaId: "default-loja"
      }
    });
    console.log("✅ Administrador atualizado.");
  } else {
    adminUser = await prisma.usuario.create({
      data: {
        nome: "Bel Klock Admin",
        email: emailAdmin,
        pin: pinAdmin,
        senhaHash: senhaHash,
        role: "ADMIN_LOJA",
        lojaId: "default-loja",
        whatsapp: "(11) 99999-9999",
        comissao: 0.0
      }
    });
    console.log("✅ Administrador criado.");
  }

  // 3. Criar ou Atualizar Revendedora Gabriela Santos
  const emailGabriela = "gabriela@teste.com";
  const pinGabriela = "2120";
  const senhaHashGabi = await bcrypt.hash("belklock", 10);

  const gabiExiste = await prisma.usuario.findUnique({
    where: { email: emailGabriela }
  });

  let gabiUser;
  if (gabiExiste) {
    gabiUser = await prisma.usuario.update({
      where: { email: emailGabriela },
      data: {
        pin: pinGabriela,
        senhaHash: senhaHashGabi,
        role: "VENDEDORA",
        lojaId: "default-loja"
      }
    });
    console.log("✅ Revendedora Gabriela Santos atualizada.");
  } else {
    gabiUser = await prisma.usuario.create({
      data: {
        nome: "Gabriela Santos",
        email: emailGabriela,
        pin: pinGabriela,
        senhaHash: senhaHashGabi,
        role: "VENDEDORA",
        lojaId: "default-loja",
        whatsapp: "(11) 98765-4321",
        comissao: 30.0
      }
    });
    console.log("✅ Revendedora Gabriela Santos criada.");
  }

  // 4. Criar Histórico de Acerto para Gabriela se não houver
  const acertosGabi = await prisma.historicoAcerto.count({
    where: { usuarioId: gabiUser.id }
  });

  if (acertosGabi === 0) {
    await prisma.historicoAcerto.create({
      data: {
        lojaId: "default-loja",
        usuarioId: gabiUser.id,
        data: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 dias atrás
        totalConsignada: 20,
        totalVendida: 12,
        totalDevolvida: 8,
        totalPerdida: 0,
        totalDefeito: 0,
        faturamentoBruto: 1200.00,
        valorDescontoPerda: 0.0,
        comissaoPaga: 360.00,
        liquidoBelklock: 840.00,
        formaPagamento: "Pix",
        totalRetidoRevendedora: 360.00,
        totalRecebidoAdmin: 840.00,
        saldoFinalAcerto: 0.0
      }
    });
    console.log("✅ Histórico de acerto criado para Gabriela Santos (gerando pendência de Nota Fiscal).");
  } else {
    console.log("ℹ️ Gabriela Santos já possui histórico de acertos.");
  }

  // 5. Criar Treinamentos Padrão se não houver nenhum
  const countTreinamentos = await prisma.treinamento.count();
  if (countTreinamentos === 0) {
    await prisma.treinamento.createMany({
      data: [
        {
          lojaId: "default-loja",
          titulo: "Como gerar Links de Pagamento",
          descricao: "Aprenda a criar e enviar links de pagamento para suas clientes finalizarem as compras com cartão.",
          tipo: "VIDEO",
          url: "https://www.w3schools.com/html/mov_bbb.mp4"
        },
        {
          lojaId: "default-loja",
          titulo: "Manual de Vendas Consignadas",
          descricao: "Guia completo de políticas de comissão, prazos e cuidados com o mostruário.",
          tipo: "PDF",
          url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        }
      ]
    });
    console.log("✅ Treinamentos de demonstração cadastrados.");
  } else {
    console.log("ℹ️ Treinamentos já cadastrados no banco.");
  }

  // 6. Criar Mensagens na Fila do WhatsApp se não houver mensagens pendentes
  const countMensagens = await prisma.mensagemWhatsapp.count({
    where: { status: "PENDENTE" }
  });

  if (countMensagens === 0) {
    await prisma.mensagemWhatsapp.createMany({
      data: [
        {
          lojaId: "default-loja",
          numero: "(11) 98765-4321",
          tipo: "BOAS_VINDAS",
          mensagem: "Olá Gabriela Santos, seja muito bem-vinda à BelKlock Semijoias! Seu PIN de acesso ao painel é 2120.",
          status: "PENDENTE"
        },
        {
          lojaId: "default-loja",
          numero: "(11) 98765-4321",
          tipo: "ACERTO",
          mensagem: "Seu acerto de contas BelKlock foi homologado. Faturamento bruto: R$ 1.200,00. Comissão: R$ 360,00. Acesse seu painel para ver o recibo.",
          status: "PENDENTE"
        }
      ]
    });
    console.log("✅ Mensagens de teste adicionadas à fila do WhatsApp.");
  } else {
    console.log("ℹ️ Já existem mensagens pendentes na fila do WhatsApp.");
  }

  console.log("\n=========================================");
  console.log("Semeadura de dados (Seed) concluída!");
  console.log(`E-mail Admin: ${adminUser.email}`);
  console.log(`PIN Admin: ${adminUser.pin}`);
  console.log(`Senha padrão: ${senhaPadrao}`);
  console.log("=========================================");
}

main()
  .catch((e) => {
    console.error("Erro ao rodar o script de seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
