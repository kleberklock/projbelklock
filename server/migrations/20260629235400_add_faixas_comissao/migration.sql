-- CreateTable
CREATE TABLE "Loja" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default-loja',
    "nome" TEXT NOT NULL DEFAULT 'Loja Padrão',
    "cnpj" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lojaId" TEXT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pin" TEXT,
    "senhaHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "whatsapp" TEXT,
    "comissao" REAL NOT NULL DEFAULT 30.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Usuario_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lojaId" TEXT NOT NULL DEFAULT 'default-loja',
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "quantidadeDefeito" INTEGER NOT NULL DEFAULT 0,
    "custoBruto" REAL NOT NULL DEFAULT 0.0,
    "custoBanho" REAL NOT NULL DEFAULT 0.0,
    "custoLiquido" REAL NOT NULL DEFAULT 0.0,
    "markup" REAL NOT NULL DEFAULT 3.0,
    "fotoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Produto_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consignado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lojaId" TEXT NOT NULL DEFAULT 'default-loja',
    "usuarioId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidadeConsignada" INTEGER NOT NULL,
    "precoVenda" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Consignado_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Consignado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Consignado_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoricoAcerto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lojaId" TEXT NOT NULL DEFAULT 'default-loja',
    "usuarioId" TEXT NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalConsignada" INTEGER NOT NULL,
    "totalVendida" INTEGER NOT NULL,
    "totalDevolvida" INTEGER NOT NULL,
    "totalPerdida" INTEGER NOT NULL DEFAULT 0,
    "totalDefeito" INTEGER NOT NULL DEFAULT 0,
    "faturamentoBruto" REAL NOT NULL,
    "valorDescontoPerda" REAL NOT NULL DEFAULT 0.0,
    "comissaoPaga" REAL NOT NULL,
    "liquidoBelklock" REAL NOT NULL,
    "formaPagamento" TEXT DEFAULT 'Pix',
    CONSTRAINT "HistoricoAcerto_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoricoAcerto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendaDireta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lojaId" TEXT NOT NULL DEFAULT 'default-loja',
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    "whatsappCliente" TEXT,
    "nomeCliente" TEXT,
    "clienteId" TEXT,
    CONSTRAINT "VendaDireta_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendaDireta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendaRevendedora" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lojaId" TEXT NOT NULL DEFAULT 'default-loja',
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nomeProduto" TEXT NOT NULL,
    "codigoProduto" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoVenda" REAL NOT NULL,
    "comissaoValor" REAL NOT NULL,
    "clienteId" TEXT,
    CONSTRAINT "VendaRevendedora_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendaRevendedora_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VendaRevendedora_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lojaId" TEXT NOT NULL DEFAULT 'default-loja',
    "nome" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "dataNascimento" TEXT,
    "observacoes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cliente_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogAcao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "acao" TEXT NOT NULL,
    "detalhes" TEXT NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lojaId" TEXT NOT NULL DEFAULT 'default-loja',
    "tipo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "detalhes" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notificacao_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lojaId" TEXT NOT NULL DEFAULT 'default-loja',
    "nomeEmpresa" TEXT NOT NULL DEFAULT 'BelKlock Semijoias',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "corPrimaria" TEXT NOT NULL DEFAULT '#d4af37',
    "corSecundaria" TEXT NOT NULL DEFAULT '#111111',
    "bgPrimary" TEXT NOT NULL DEFAULT '#0a0a0a',
    "bgCard" TEXT NOT NULL DEFAULT '#121212',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Configuracao_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FaixaComissao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lojaId" TEXT,
    "usuarioId" TEXT,
    "valorMin" REAL NOT NULL DEFAULT 0.0,
    "valorMax" REAL NOT NULL,
    "percentual" REAL NOT NULL,
    CONSTRAINT "FaixaComissao_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FaixaComissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Loja_cnpj_key" ON "Loja"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_pin_key" ON "Usuario"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_codigo_key" ON "Produto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Consignado_usuarioId_produtoId_key" ON "Consignado"("usuarioId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_whatsapp_key" ON "Cliente"("whatsapp");
