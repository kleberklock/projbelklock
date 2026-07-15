# 💎 Conecta Joias — Plataforma SaaS de Gestão para Revendedoras

> Plataforma **White-Label** completa para gestão de vendas de semijoias por consignação, com painel do administrador, portal das revendedoras e controle financeiro integrado.

---

## 📋 Sumário

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Roles e Permissões](#roles-e-permissões)
- [Sistema de Cores White-Label](#sistema-de-cores-white-label)
- [Como Rodar Localmente](#como-rodar-localmente)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [API — Principais Endpoints](#api--principais-endpoints)
- [Banco de Dados](#banco-de-dados)

---

## 🌟 Visão Geral

O **Conecta Joias** é uma plataforma SaaS multi-tenant onde cada loja (marca) tem seu próprio ambiente isolado. A gestora (admin da loja) personaliza a marca com suas cores e logotipo, cadastra revendedoras, envia peças em consignado e acompanha comissões e vendas em tempo real.

As revendedoras acessam um portal simplificado com apenas sua "maleta" de peças consignadas, podendo registrar vendas, acessar histórico de comissões e assinar termos digitalmente.

---

## ✨ Funcionalidades

### 👑 Gestora (Manager)
| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | KPIs de faturamento, comissão paga, estoque crítico e vendas do mês |
| **Estoque** | CRUD completo de produtos com foto, custo, markup e preço de venda automático |
| **Revendedoras** | Cadastro com PIN único, WhatsApp, comissão fixa ou progressiva |
| **Consignados** | Envio de peças para revendedoras com controle de quantidade |
| **Acertos** | Fechamento de comissão com cálculo automático de perdas e devoluções |
| **Clientes** | CRM básico com histórico de compras e aniversários |
| **Vendas Diretas** | Registro de vendas feitas pelo próprio admin |
| **Marketing** | Feed de imagens da marca para o Instagram |
| **Configurações** | Nome da marca, logo, cores personalizadas (White-Label) |
| **Treinamentos** | Envio de vídeos e PDFs de treinamento para consultoras |
| **Links de Pagamento** | Geração de links PIX/boleto via ASAAS para cobranças |

### 💼 Revendedora (Consultant)
| Módulo | Descrição |
|--------|-----------|
| **Minha Maleta** | Lista de peças consignadas com preços e quantidades |
| **Registrar Venda** | Clique em "Vendi!" para registrar uma venda com cliente e forma de pagamento |
| **Histórico** | Todas as vendas e comissões da consultora |
| **Progressão** | Barra de progresso da comissão com metas configuradas pela gestora |
| **Clientes** | Cadastro e histórico dos clientes da consultora |
| **Termos** | Assinatura digital do termo de consignação |

### ⚡ SuperAdmin (Plataforma)
| Módulo | Descrição |
|--------|-----------|
| **Lojas** | Visão global de todos os tenants cadastrados na plataforma |
| **Planos** | Controle de planos BRONZE / GOLD / PLATINUM por loja |
| **Suspensão** | Suspender/reativar acesso de lojas inadimplentes |
| **Financeiro** | Relatório de receita da plataforma |

---

## 🏗️ Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                    CONECTA JOIAS (SaaS)                      │
├──────────────────────────┬───────────────────────────────────┤
│       FRONTEND           │           BACKEND                 │
│   (HTML + JS + CSS)      │     (Node.js + Express)           │
│                          │                                   │
│  index.html              │  ┌─ /api/auth                     │
│  └── login.js            │  │   ├── POST /login              │
│      (Login + Onboard.)  │  │   ├── POST /signup             │
│                          │  │   ├── POST /register           │
│  superadmin.html         │  │   └── GET  /pre-login-config   │
│  └── superadmin.js       │  │                               │
│      (Painel Gestora)    │  ├─ /api/config                   │
│                          │  │   ├── GET  (público)           │
│  manager.html            │  │   └── PUT  (apenas Manager)    │
│  └── manager.js          │  │                               │
│      (Painel Revendedora)│  ├─ /api/produtos                 │
│                          │  ├─ /api/revendedoras             │
│  saasadmin.html          │  ├─ /api/consignados              │
│  └── saasadmin.js        │  ├─ /api/vendas-revendedora       │
│      (Painel SaaS)       │  ├─ /api/acertos                  │
│                          │  ├─ /api/clientes                 │
│  style.css               │  ├─ /api/lojas (SuperAdmin)       │
│  (Sistema de Design)     │  └─ /api/pagamentos               │
│                          │                                   │
│                          │  Prisma ORM                       │
│                          │  └── SQLite (local)               │
│                          │      PostgreSQL (produção)        │
└──────────────────────────┴───────────────────────────────────┘
```

### Fluxo de Autenticação
```
1. Usuário entra com e-mail (Manager) ou PIN 4 dígitos (Consultant)
2. POST /api/auth/login → retorna { token, usuario, configLoja }
3. Frontend salva token + cores da loja no localStorage
4. Redirecionamento conforme role:
   - SuperAdmin → saasadmin.html
   - Manager    → superadmin.html
   - Consultant → manager.html
5. Cada requisição subsequente envia: Authorization: Bearer <token>
```

### Herança de Cores White-Label
```
Admin define cores → salva no banco (PUT /api/config)
    ↓
Revendedora faz login → servidor retorna configLoja junto com o token
    ↓
Frontend salva cores no localStorage ANTES de redirecionar
    ↓
manager.html carrega → aplica cores via variáveis CSS imediatamente
```

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | HTML5, CSS3 (variáveis dinâmicas), JavaScript ES6+ (sem framework) |
| **Backend** | Node.js 18+, Express 4 |
| **ORM** | Prisma (suporta SQLite local e PostgreSQL em produção) |
| **Autenticação** | JSON Web Tokens (JWT) — `jsonwebtoken` + `bcryptjs` |
| **Upload de Imagens** | Azure Blob Storage (produção) ou disco local (desenvolvimento) |
| **Pagamentos** | ASAAS (PIX, boleto, cartão) |
| **E-mail** | Configurável via variáveis de ambiente |
| **WhatsApp** | Z-API / Evolution API (configurável) |
| **Ícones** | Font Awesome 6 |

---

## 📁 Estrutura de Arquivos

```
projbelklock/
│
├── 📄 index.html              # Tela de login e onboarding wizard
├── 📄 login.js                # Lógica de login, pré-carregamento de tema,
│                              # onboarding em 6 passos
│
├── 📄 superadmin.html         # Painel completo da Gestora/Admin
├── 📄 superadmin.js           # Toda lógica do painel admin
│                              # (~6600 linhas — candidato a refatoração)
├── 📄 superadmin-vendas.js    # Módulo de vendas consolidadas do admin
├── 📄 superadmin-tour.js      # Tour guiado de onboarding do admin
│
├── 📄 manager.html            # Painel da Revendedora/Consultora
├── 📄 manager.js              # Lógica da revendedora: maleta, vendas,
│                              # comissões, clientes (~5900 linhas)
├── 📄 marketing-data.js       # Dados do feed de marketing
│
├── 📄 saasadmin.html          # Painel do SuperAdmin da plataforma
├── 📄 saasadmin.js            # Gestão global de lojas e planos
│
├── 📄 pagamento.html/js       # Checkout de assinatura (ASAAS)
├── 📄 onboarding.html/js      # Wizard de configuração inicial
├── 📄 termo_assinatura.html/js # Assinatura digital de termos
│
├── 📄 style.css               # Sistema de design com variáveis CSS
│                              # (temas claro/escuro, cores white-label)
│
├── 📄 export-code.js          # Utilitário: exporta código para análise no Gemini
├── 📄 start.bat               # Inicialização rápida (Windows)
│
└── 📁 server/                 # Backend Node.js
    ├── 📄 server.js           # Servidor Express com todos os endpoints
    │                          # (~3600 linhas)
    ├── 📄 schema.prisma       # Schema do banco de dados (modelos)
    ├── 📄 asaas-service.js    # Serviço de integração com ASAAS
    ├── 📄 seed.js             # Seed de dados para desenvolvimento
    ├── 📄 .env.example        # Exemplo de variáveis de ambiente
    └── 📁 uploads/            # Imagens enviadas (local)
```

---

## 👥 Roles e Permissões

```
SuperAdmin
  ├── Acessa: saasadmin.html
  ├── Pode: criar/suspender/editar todas as lojas
  └── Não pertence a nenhuma loja (lojaId = null)

Manager (Gestora)
  ├── Acessa: superadmin.html
  ├── Pode: tudo dentro da SUA loja
  │   ├── Criar e gerenciar revendedoras
  │   ├── Gerenciar estoque e produtos
  │   ├── Configurar cores/logo da marca
  │   └── Ver relatórios e DRE
  └── lojaId = ID único da loja

Consultant (Revendedora)
  ├── Acessa: manager.html
  ├── Pode: ver apenas sua maleta e clientes
  │   ├── Registrar vendas das peças consignadas
  │   └── Ver comissões e assinar termos
  ├── Login: PIN de 4 dígitos (único no sistema)
  └── lojaId = MESMO lojaId da gestora que a criou
```

---

## 🎨 Sistema de Cores White-Label

O sistema usa variáveis CSS definidas dinamicamente via JavaScript:

```javascript
// Função central de aplicação de tema
// Chamada após login e ao carregar qualquer painel
aplicarTemaLoja({
  corPrimaria: "#dbb539",   // Cor principal da marca
  corSecundaria: "#111111", // Cor secundária
  bgPrimary: "#0a0a0a",    // Fundo da página (escuro)
  bgCard: "#121212",        // Fundo dos cards
  temaPref: "ESCURO"        // "CLARO" | "ESCURO" | "SISTEMA"
});
```

**Variáveis CSS geradas:**
```css
:root {
  --gold-primary       /* Cor primária */
  --gold-light         /* 30% mais clara */
  --gold-dark          /* 30% mais escura */
  --gold-gradient      /* Gradiente animado */
  --gold-translucent   /* Com 15% de opacidade */
  --bg-primary         /* Fundo geral */
  --bg-card            /* Fundo dos cards */
  --text-primary       /* Texto principal */
  --text-secondary     /* Texto secundário */
}
```

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 18+
- npm

### 1. Instalar dependências do backend
```bash
cd server
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp server/.env.example server/.env
# Edite o server/.env com suas configurações
```

### 3. Criar o banco de dados
```bash
cd server
npx prisma migrate dev --name init
node seed.js  # (opcional) dados de exemplo
```

### 4. Iniciar tudo de uma vez (Windows)
```bash
# Na raiz do projeto:
start.bat
```

### 4. Ou iniciar manualmente
```bash
# Terminal 1 — Backend (porta 5000)
cd server && npm run dev

# Terminal 2 — Frontend (porta 8080)
npx http-server -p 8080 -c-1
```

### 5. Acessar
- **Frontend:** http://localhost:8080
- **API:** http://localhost:5000/api

### Credenciais padrão (desenvolvimento)
| Role | Login | Senha |
|------|-------|-------|
| SuperAdmin | `superadmin@plataforma.com` | `admin0001` |
| Manager | `admin@conectajoias.com` | `conectajoias` |

---

## 🔐 Variáveis de Ambiente

```env
# Servidor
PORT=5000

# JWT (gerar uma chave aleatória forte em produção)
JWT_SECRET=sua_chave_secreta_forte_aqui

# Banco de Dados
DATABASE_URL="file:./dev.db"          # SQLite (desenvolvimento)
# DATABASE_URL="postgresql://..."     # PostgreSQL (produção)

# Azure Blob Storage (imagens)
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_STORAGE_CONTAINER_NAME=semijoias

# ASAAS (Pagamentos)
ASAAS_API_KEY=...
ASAAS_API_URL=https://sandbox.asaas.com/api/v3

# Frontend (para CORS)
FRONTEND_URL=http://localhost:8080

# WhatsApp API (Z-API ou Evolution)
WHATSAPP_API_URL=
WHATSAPP_API_KEY=
```

---

## 🔌 API — Principais Endpoints

### Autenticação
```
POST /api/auth/login           Login (e-mail ou PIN). Retorna token + configLoja
POST /api/auth/signup          Cadastro de nova gestora (cria loja automaticamente)
POST /api/auth/register        Admin cria revendedora ou outro admin (requer token)
GET  /api/auth/pre-login-config  Retorna tema da loja pelo PIN/e-mail (público)
```

### Configuração White-Label
```
GET  /api/config               Retorna configurações visuais da loja (público)
PUT  /api/config               Atualiza cores/logo/nome (apenas Manager/SuperAdmin)
```

### Produtos e Estoque
```
GET    /api/produtos           Lista produtos da loja
POST   /api/produtos           Cria produto
PUT    /api/produtos/:id       Edita produto
DELETE /api/produtos/:id       Remove produto
```

### Revendedoras e Consignados
```
GET  /api/revendedoras                  Lista revendedoras da loja
POST /api/auth/register                 Cria revendedora
GET  /api/revendedoras/minha-maleta    Maleta da revendedora logada
POST /api/consignados                   Envia peças em consignado
PUT  /api/consignados/:id              Atualiza consignado
```

### Vendas e Acertos
```
POST /api/vendas-revendedora    Registra venda da revendedora
GET  /api/vendas-revendedora    Lista vendas da revendedora logada
POST /api/acertos               Fecha acerto de comissão
GET  /api/acertos               Histórico de acertos
```

### SuperAdmin
```
GET  /api/lojas                 Lista todas as lojas
POST /api/lojas                 Cria nova loja manualmente
PUT  /api/lojas/:id/suspender   Suspende uma loja
PUT  /api/lojas/:id/reativar    Reativa uma loja
```

---

## 🗄️ Banco de Dados

Modelos principais do [schema.prisma](server/schema.prisma):

```
Loja           → Tenant (empresa/marca) da plataforma
Usuario        → Usuários do sistema (SuperAdmin, Manager, Consultant)
Produto        → Itens do estoque da loja
Consignado     → Peças enviadas para uma revendedora específica
VendaRevendedora → Venda registrada pela revendedora
HistoricoAcerto  → Fechamento de comissão registrado
Cliente        → CRM básico de clientes
Configuracao   → Cores, logo e nome da marca (White-Label)
FaixaComissao  → Faixas de comissão progressiva por revendedora
TermoConsignacao → Termos digitais de consignação
LinkPagamento  → Links de cobrança gerados via ASAAS
MensagemWhatsapp → Fila de mensagens WhatsApp agendadas
```

---

## 📊 Utilitários de Desenvolvimento

```bash
# Exportar código para análise no Gemini (gera pasta gemini_export/)
node export-code.js

# Inspecionar usuários e configurações no banco
node server/inspect_all.js

# Rodar seed de dados de exemplo
node server/seed.js
```

---

## ⚠️ Pontos de Melhoria Conhecidos

1. **Arquivos monolíticos** — `superadmin.js` (~6.600 linhas) e `manager.js` (~5.900 linhas) seriam melhor organizados em módulos ES6
2. **Sem testes automatizados** — Não há testes unitários ou de integração
3. **Frontend sem bundler** — Sem Webpack/Vite, o carregamento não é otimizado para produção
4. **SQLite em desenvolvimento** — Migrar para PostgreSQL antes de ir para produção
5. **WhatsApp sem confirmação** — A fila de mensagens WhatsApp não tem retry automático

---

*Desenvolvido com ❤️ para conectar gestoras e revendedoras de semijoias.*
