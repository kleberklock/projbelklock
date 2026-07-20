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
        nome: "Conecta Joias",
        cnpj: "12.345.678/0001-90"
      }
    });
    console.log("✅ Loja Padrão criada.");
  } else {
    console.log("ℹ️ Loja Padrão já existe.");
  }

  // 2. Criar ou Atualizar SuperAdmin Principal baseado nas variáveis de ambiente
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "superadmin@plataforma.com";
  const superAdminSenha = process.env.SUPER_ADMIN_SENHA || "admin0001";
  const superAdminPin = process.env.SUPER_ADMIN_PIN || "0001";
  const superAdminSenhaHash = await bcrypt.hash(superAdminSenha, 10);

  const superAdminExiste = await prisma.usuario.findUnique({
    where: { email: superAdminEmail }
  });

  if (superAdminExiste) {
    await prisma.usuario.update({
      where: { email: superAdminEmail },
      data: {
        pin: superAdminPin,
        senhaHash: superAdminSenhaHash,
        role: "SuperAdmin"
      }
    });
    console.log("✅ SuperAdmin atualizado.");
  } else {
    await prisma.usuario.create({
      data: {
        nome: "Super Admin",
        email: superAdminEmail,
        pin: superAdminPin,
        senhaHash: superAdminSenhaHash,
        role: "SuperAdmin",
        comissao: 0.0
      }
    });
    console.log("✅ SuperAdmin criado.");
  }

  console.log("\n=========================================");
  console.log("Semeadura de dados (Seed) concluída!");
  console.log(`SuperAdmin: ${superAdminEmail}`);
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
