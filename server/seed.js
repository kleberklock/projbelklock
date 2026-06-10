const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando semeadura de dados (Seed)...");

  const emailAdmin = "admin@belklock.com";
  const pinAdmin = "0001";
  const senhaPadrao = "belklock";

  // Criptografa a senha do administrador
  const senhaHash = await bcrypt.hash(senhaPadrao, 10);

  // Verifica se o admin já existe
  const adminExiste = await prisma.usuario.findUnique({
    where: { email: emailAdmin }
  });

  if (adminExiste) {
    await prisma.usuario.update({
      where: { email: emailAdmin },
      data: {
        pin: pinAdmin,
        senhaHash: senhaHash
      }
    });
    console.log("=========================================");
    console.log("Administrador atualizado com sucesso!");
    console.log(`E-mail: ${emailAdmin}`);
    console.log(`PIN: ${pinAdmin}`);
    console.log(`Senha: ${senhaPadrao}`);
    console.log("=========================================");
    return;
  }

  // Cria o primeiro usuário administrador
  const novoAdmin = await prisma.usuario.create({
    data: {
      nome: "Bel Klock Admin",
      email: emailAdmin,
      pin: pinAdmin,
      senhaHash: senhaHash,
      role: "admin",
      whatsapp: "(11) 99999-9999",
      comissao: 0.0 // admin não recebe comissão
    }
  });

  console.log("=========================================");
  console.log("Administrador criado com sucesso!");
  console.log(`E-mail: ${novoAdmin.email}`);
  console.log(`PIN: ${pinAdmin}`);
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
