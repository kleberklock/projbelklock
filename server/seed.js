const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando semeadura de dados (Seed)...");

  const emailAdmin = "admin@belklock.com";
  const senhaPadrao = "admin123";

  // Verifica se o admin já existe
  const adminExiste = await prisma.usuario.findUnique({
    where: { email: emailAdmin }
  });

  if (adminExiste) {
    console.log(`O usuário administrador [${emailAdmin}] já está cadastrado no banco.`);
    return;
  }

  // Criptografa a senha do administrador
  const senhaHash = await bcrypt.hash(senhaPadrao, 10);

  // Cria o primeiro usuário administrador
  const novoAdmin = await prisma.usuario.create({
    data: {
      nome: "Bel Klock Admin",
      email: emailAdmin,
      senhaHash: senhaHash,
      role: "admin",
      whatsapp: "(11) 99999-9999",
      comissao: 0.0 // admin não recebe comissão
    }
  });

  console.log("=========================================");
  console.log("Administrador criado com sucesso no Azure SQL!");
  console.log(`E-mail: ${novoAdmin.email}`);
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
