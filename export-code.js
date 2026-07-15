/**
 * ============================================================
 *  EXPORTADOR INTELIGENTE - CONECTA JOIAS
 *  Gera arquivos organizados e documentados para análise
 *  no Google Gemini (ou qualquer outra IA).
 *
 *  COMO USAR:
 *    node export-code.js
 *
 *  RESULTADO:
 *    Pasta /gemini_export/ com arquivos separados por módulo,
 *    cada um com tamanho ideal para o Gemini analisar.
 * ============================================================
 */

const fs   = require('fs');
const path = require('path');

// ─── Configurações ───────────────────────────────────────────
const ROOT        = __dirname;
const OUTPUT_DIR  = path.join(ROOT, 'gemini_export');
const MAX_BYTES   = 900_000; // ~900 KB por arquivo (limite seguro do Gemini)

// Arquivos/pastas a ignorar na varredura
const IGNORED_DIRS  = ['node_modules', '.git', '.vscode', 'uploads', 'assets', 'gemini_export'];
const IGNORED_FILES = [
  'dev.db', 'package-lock.json', 'codigo_conecta_joias.md',
  'export-code.js', 'check_db.js', 'limpar_para_teste.js'
];
const ALLOWED_EXTS  = ['.js', '.html', '.css', '.prisma', '.json'];

// ─── Mapa de módulos (define a ordem e agrupamento) ──────────
// Cada módulo vira um arquivo separado na pasta gemini_export/
const MODULOS = [
  {
    nome: '01_BACKEND_servidor',
    descricao: `
## Backend - Servidor Node.js + Express + Prisma ORM

Este módulo contém toda a lógica do servidor:
- Autenticação JWT (login, registro, pré-config de tema)
- CRUD de Produtos, Revendedoras (Consultants), Clientes
- Gestão de Consignados, Vendas, Acertos de Comissão
- Rotas do SuperAdmin (gestão multi-tenant de lojas)
- Configurações visuais White-Label da loja (cores, logo, tema)
- Integração com Azure Blob Storage (uploads de imagens)
- Integração com ASAAS (gateway de pagamentos)
- Rate Limiting, CORS, Logs de Auditoria

ARQUITETURA:
  - Multi-tenant: cada loja tem seu próprio lojaId
  - Roles: SuperAdmin > Manager (admin da loja) > Consultant (revendedora)
  - JWT inclui: id, nome, email, pin, role, lojaId
`,
    arquivos: ['server/server.js', 'server/schema.prisma', 'server/asaas-service.js']
  },
  {
    nome: '02_FRONTEND_login',
    descricao: `
## Frontend - Tela de Login e Onboarding (index.html + login.js)

Este módulo cuida de:
- Login por E-mail (admin) ou PIN de 4 dígitos (revendedora)
- Pré-carregamento do tema visual ANTES do login (pre-login-config)
- Após login bem-sucedido: salva cores da loja no localStorage
  para que a revendedora herde as cores do admin ao abrir manager.html
- Wizard de Onboarding (6 passos) para novas gestoras
- Upload de logo da marca durante o onboarding
- Função aplicarTemaLoja() que aplica variáveis CSS dinâmicas

FLUXO DE HERANÇA DE CORES:
  1. Revendedora digita PIN → API retorna token + configLoja (cores)
  2. Cores salvas no localStorage ANTES de redirecionar
  3. manager.html carrega as cores corretas desde o início
`,
    arquivos: ['index.html', 'login.js']
  },
  {
    nome: '03_FRONTEND_admin',
    descricao: `
## Frontend - Painel do Administrador (superadmin.html + superadmin.js)

Este módulo é o painel completo da Gestora (Manager):
- Dashboard com KPIs (faturamento, comissão, estoque crítico)
- Gestão de Estoque (CRUD de produtos, fotos, markup)
- Gestão de Revendedoras (Consultants): cadastro, comissão, PIN
- Consignados: envio de peças para revendedoras
- Acertos de comissão
- Gestão de Clientes
- Vendas Diretas (pelo admin)
- Marketing (feed de imagens, Instagram)
- Configurações White-Label (cores, logo, nome da marca)
- Treinamentos para consultoras
- Relatórios e DRE

CONFIGURAÇÕES VISUAIS:
  - O admin escolhe cores, logo e nome da marca
  - Ao salvar, o PUT /api/config atualiza o banco de dados
  - As revendedoras herdam essas configurações automaticamente
`,
    arquivos: ['superadmin.html', 'superadmin.js', 'superadmin-vendas.js', 'superadmin-tour.js']
  },
  {
    nome: '04_FRONTEND_revendedora',
    descricao: `
## Frontend - Painel da Revendedora / Consultora (manager.html + manager.js)

Este módulo é o painel da Revendedora (Consultant):
- Minha Maleta: lista de peças consignadas
- Registrar Vendas das peças da maleta
- Histórico de Vendas e Comissões
- Progressão de Comissão (barra de progresso)
- Gestão de Clientes próprios
- Links de Pagamento (PIX, boleto via ASAAS)
- Termos de Consignação (assinar digitalmente)
- Onboarding da Consultora

IMPORTANTE - HERANÇA DE CORES:
  - Ao iniciar, carregarDadosDoLocalStorage() aplica o tema do localStorage
  - Depois carregarConfiguracaoAPI() busca config do servidor com o token JWT
  - O lojaId no JWT é o da loja do admin que criou a revendedora
  - Assim a revendedora sempre vê as cores da marca do seu admin

RESTRIÇÕES DE PERFIL:
  - Menus de estoque, dashboard, marketing ficam ocultos
  - Apenas "Minha Maleta" e "Clientes" são visíveis
`,
    arquivos: ['manager.html', 'manager.js', 'marketing-data.js']
  },
  {
    nome: '05_FRONTEND_estilos',
    descricao: `
## Frontend - Estilos CSS e Configuração Visual (style.css)

Este módulo contém o sistema de design do projeto:

VARIÁVEIS CSS (aplicadas dinamicamente via aplicarTemaLoja()):
  --gold-primary       → Cor primária da marca (personalizável)
  --gold-light/dark    → Variações mais claras/escuras da cor primária
  --gold-gradient      → Gradiente da cor primária
  --gold-translucent   → Cor primária com transparência (para fundos)
  --bg-primary         → Fundo principal da página
  --bg-card            → Fundo dos cards/modais
  --text-primary       → Cor principal do texto
  --text-secondary     → Cor secundária do texto

TEMAS:
  - Tema Escuro (padrão): bg #0a0a0a, card #121212
  - Tema Claro: bg #f5f5f5, card #ffffff
  - Tema Sistema: segue preferência do OS do usuário

COMPONENTES:
  - Cards premium com glassmorphism
  - Sidebar responsiva com collapse
  - Tabelas com hover e ordenação
  - Modais animados
  - Toasts de notificação
  - Botões com gradiente dourado
`,
    arquivos: ['style.css']
  },
  {
    nome: '06_SAAS_admin',
    descricao: `
## SaaS Admin - Painel do Super Administrador da Plataforma (saasadmin.html + saasadmin.js)

Este módulo é o painel de controle GLOBAL da plataforma:
- Visão de todas as lojas/tenants cadastradas
- Criar novas lojas manualmente
- Suspender/reativar lojas
- Controle de planos (BRONZE, GOLD, PLATINUM)
- Relatórios de vendas globais da plataforma
- Gestão de pagamentos de assinatura (ASAAS)

ROLES:
  - Apenas o SuperAdmin acessa este painel
  - Manager acessa superadmin.html (painel da sua loja)
  - Consultant acessa manager.html (maleta da revendedora)
`,
    arquivos: ['saasadmin.html', 'saasadmin.js']
  },
  {
    nome: '07_PAGAMENTO_onboarding',
    descricao: `
## Pagamento e Onboarding (pagamento.html + onboarding.html)

Módulos auxiliares:
- pagamento.html/js: checkout de assinatura da plataforma (ASAAS)
- onboarding.html/js: wizard de configuração inicial da loja
- termo_assinatura.html/js: assinatura digital de termos de consignação
`,
    arquivos: ['pagamento.html', 'pagamento.js', 'onboarding.html', 'onboarding.js', 'termo_assinatura.html', 'termo_assinatura.js']
  }
];

// ─── Utilitários ─────────────────────────────────────────────

/**
 * Detecta a linguagem de um arquivo pela extensão
 * para formatar o bloco de código Markdown corretamente.
 */
function detectarLinguagem(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mapa = {
    '.js'     : 'javascript',
    '.html'   : 'html',
    '.css'    : 'css',
    '.prisma' : 'prisma',
    '.json'   : 'json',
    '.bat'    : 'batch',
    '.md'     : 'markdown',
    '.env'    : 'env'
  };
  return mapa[ext] || 'text';
}

/**
 * Formata o tamanho de bytes em KB ou MB de forma legível.
 */
function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Lê o conteúdo de um arquivo e retorna como bloco Markdown.
 * Retorna null se o arquivo não existir.
 */
function lerArquivoComoBloco(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    return `> ⚠️ Arquivo não encontrado: \`${relPath}\`\n\n`;
  }

  const conteudo = fs.readFileSync(fullPath, 'utf8');
  const linguagem = detectarLinguagem(relPath);
  const tamanho   = formatarTamanho(Buffer.byteLength(conteudo, 'utf8'));
  const linhas    = conteudo.split('\n').length;

  return (
    `### 📄 \`${relPath}\`\n` +
    `*${linhas} linhas | ${tamanho}*\n\n` +
    `\`\`\`${linguagem}\n` +
    conteudo +
    `\n\`\`\`\n\n`
  );
}

/**
 * Divide um conteúdo grande em múltiplas partes,
 * respeitando o limite de MAX_BYTES por arquivo.
 */
function dividirEmPartes(conteudo, nomeBase) {
  const bytes = Buffer.byteLength(conteudo, 'utf8');
  if (bytes <= MAX_BYTES) {
    return [{ sufixo: '', conteudo }];
  }

  const partes = [];
  let inicio   = 0;
  let parte    = 1;

  while (inicio < conteudo.length) {
    // Tenta cortar no próximo separador de arquivo (---) para não quebrar no meio
    let fim = inicio + Math.floor(MAX_BYTES * 0.9); // 90% do limite para margem
    if (fim >= conteudo.length) {
      fim = conteudo.length;
    } else {
      // Procura o separador mais próximo antes do corte
      const separador = conteudo.lastIndexOf('\n---\n', fim);
      if (separador > inicio + 100) fim = separador + 5;
    }

    partes.push({
      sufixo  : `_parte${parte}de${Math.ceil(Buffer.byteLength(conteudo, 'utf8') / MAX_BYTES)}`,
      conteudo: conteudo.slice(inicio, fim)
    });

    inicio = fim;
    parte++;
  }
  return partes;
}

// ─── Geração dos arquivos ─────────────────────────────────────

/**
 * Cria a pasta de saída limpa e regenera todos os arquivos.
 */
function gerarExportacao() {
  // Limpar e recriar a pasta de saída
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   EXPORTADOR INTELIGENTE - CONECTA JOIAS       ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`📁 Destino: ${OUTPUT_DIR}`);
  console.log('');

  const arquivosGerados = [];
  let totalBytes = 0;

  // ── Gerar cada módulo ──────────────────────────────────────
  for (const modulo of MODULOS) {
    console.log(`⚙️  Gerando módulo: ${modulo.nome}...`);

    // Cabeçalho do módulo
    let conteudo = '';
    conteudo += `# ${modulo.nome.replace(/_/g, ' ')}\n`;
    conteudo += `*Gerado automaticamente para análise no Google Gemini*\n`;
    conteudo += `*Data: ${new Date().toLocaleString('pt-BR')}*\n`;
    conteudo += '\n---\n\n';
    conteudo += modulo.descricao.trim();
    conteudo += '\n\n---\n\n';

    // Conteúdo de cada arquivo do módulo
    for (const arq of modulo.arquivos) {
      conteudo += lerArquivoComoBloco(arq);
      conteudo += '\n---\n\n';
    }

    // Dividir se necessário e salvar
    const partes = dividirEmPartes(conteudo, modulo.nome);
    for (const parte of partes) {
      const nomeArquivo = `${modulo.nome}${parte.sufixo}.md`;
      const caminhoSaida = path.join(OUTPUT_DIR, nomeArquivo);
      fs.writeFileSync(caminhoSaida, parte.conteudo, 'utf8');

      const bytesArquivo = Buffer.byteLength(parte.conteudo, 'utf8');
      totalBytes += bytesArquivo;
      arquivosGerados.push({ nome: nomeArquivo, tamanho: bytesArquivo });
      console.log(`   ✅ ${nomeArquivo} (${formatarTamanho(bytesArquivo)})`);
    }
  }

  // ── Gerar arquivo LEIA-ME de orientação para o Gemini ──────
  const leiame = gerarLeiame(arquivosGerados);
  const leiamePath = path.join(OUTPUT_DIR, '00_LEIA-ME_para_o_Gemini.md');
  fs.writeFileSync(leiamePath, leiame, 'utf8');
  console.log(`   ✅ 00_LEIA-ME_para_o_Gemini.md`);

  // ── Resumo final ───────────────────────────────────────────
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   EXPORTAÇÃO CONCLUÍDA COM SUCESSO! ✅         ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`📊 ${arquivosGerados.length + 1} arquivos gerados`);
  console.log(`💾 Total: ${formatarTamanho(totalBytes)}`);
  console.log(`📂 Pasta: ${OUTPUT_DIR}`);
  console.log('');
  console.log('💡 PRÓXIMOS PASSOS:');
  console.log('   1. Abra o Gemini (gemini.google.com)');
  console.log('   2. Leia o arquivo 00_LEIA-ME_para_o_Gemini.md primeiro');
  console.log('   3. Faça upload dos arquivos .md um por vez (ou em grupo)');
  console.log('   4. Peça ao Gemini: "Analise o código e sugira melhorias"');
  console.log('');
}

/**
 * Gera o arquivo LEIA-ME com instruções para uso no Gemini.
 */
function gerarLeiame(arquivosGerados) {
  const lista = arquivosGerados
    .map(a => `| \`${a.nome}\` | ${formatarTamanho(a.tamanho)} |`)
    .join('\n');

  return `# 📖 LEIA-ME - Como usar estes arquivos no Google Gemini

*Gerado em: ${new Date().toLocaleString('pt-BR')}*

---

## 📌 O que é este projeto?

**Conecta Joias** é uma plataforma SaaS White-Label de gestão de vendas para
revendedoras de semijoias. Construída com:

- **Backend**: Node.js + Express + Prisma ORM + SQLite (local) / PostgreSQL (produção)
- **Frontend**: HTML + CSS + JavaScript puro (sem framework)
- **Autenticação**: JWT com roles (SuperAdmin, Manager, Consultant)
- **Armazenamento**: Azure Blob Storage (imagens), ASAAS (pagamentos)

---

## 🏗️ Arquitetura do Sistema

\`\`\`
┌─────────────────────────────────────────────────────┐
│                  CONECTA JOIAS                      │
├─────────────────┬───────────────────────────────────┤
│   FRONTEND      │   BACKEND                         │
│                 │                                   │
│  index.html     │  server.js (Express API)          │
│  login.js       │    ├── /api/auth/login            │
│                 │    ├── /api/config (tema)         │
│  superadmin.html│    ├── /api/produtos              │
│  superadmin.js  │    ├── /api/revendedoras          │
│                 │    ├── /api/consignados           │
│  manager.html   │    ├── /api/vendas-revendedora   │
│  manager.js     │    ├── /api/acertos              │
│                 │    └── /api/lojas (SuperAdmin)   │
│  saasadmin.html │                                   │
│  saasadmin.js   │  schema.prisma (banco de dados)  │
│                 │    ├── Loja (tenant)              │
│  style.css      │    ├── Usuario (roles)           │
└─────────────────┤    ├── Produto                   │
                  │    ├── Consignado                │
                  │    ├── VendaRevendedora          │
                  │    ├── HistoricoAcerto           │
                  │    └── Configuracao (tema/cores) │
                  └───────────────────────────────────┘
\`\`\`

---

## 👥 Roles e Permissões

| Role | Acesso | Página |
|------|--------|--------|
| **SuperAdmin** | Gestão global de todas as lojas | saasadmin.html |
| **Manager** | Gestão completa da sua loja | superadmin.html |
| **Consultant** | Apenas sua maleta de consignados | manager.html |

---

## 🎨 Sistema de Cores White-Label

O sistema aplica cores dinâmicas via variáveis CSS:

\`\`\`javascript
// Chamada após login — garante herança de cores para revendedoras
aplicarTemaLoja({
  corPrimaria,    // Ex: "#dbb539" (dourado personalizado)
  corSecundaria,  // Ex: "#111111"
  bgPrimary,      // Ex: "#0a0a0a" (fundo escuro)
  bgCard,         // Ex: "#121212" (cards)
  temaPref        // "CLARO" | "ESCURO" | "SISTEMA"
});
\`\`\`

---

## 📂 Arquivos desta exportação

| Arquivo | Tamanho |
|---------|---------|
${lista}

---

## 💬 Sugestões de prompts para o Gemini

Após fazer upload dos arquivos, use estes prompts:

### 🔍 Análise Geral
> "Analise a arquitetura deste sistema SaaS e liste os 5 maiores problemas ou riscos técnicos que você identifica."

### 🔒 Segurança
> "Revise o código de autenticação e autorização (login.js + server.js) e aponte vulnerabilidades de segurança."

### ⚡ Performance
> "Analise o manager.js e superadmin.js e sugira melhorias de performance para as funções mais críticas."

### 🧹 Qualidade de Código
> "Este código usa JavaScript puro com objetos grandes. Sugira uma refatoração para torná-lo mais modular e testável."

### 🎨 UX/UI
> "Analise o sistema de White-Label (cores, tema) e sugira melhorias para tornar a personalização mais robusta."

### 🚀 Escalabilidade
> "O backend usa SQLite local. O que seria necessário para migrar para produção com PostgreSQL e múltiplos usuários simultâneos?"

---

## ⚠️ Pontos de Atenção (contexto importante para o Gemini)

1. **Herança de cores**: Bug recente corrigido — a rota POST /api/auth/login
   agora retorna \`configLoja\` com as cores, evitando que revendedoras
   (em aba anônima) vejam cores padrão ao invés das cores do admin.

2. **Multi-tenant**: Cada loja tem seu próprio \`lojaId\`. O JWT contém
   o \`lojaId\` do usuário, e o middleware \`identificarLoja\` usa isso
   para isolar dados entre lojas.

3. **Arquivos grandes**: manager.js e superadmin.js são monólitos de ~250KB.
   Uma refatoração em módulos ES6 seria benéfica.

4. **Frontend sem bundler**: O projeto usa HTML + JS puro sem Webpack/Vite.
   Funciona bem para o escopo atual mas limita a modularização.
`;
}

// ─── Execução ─────────────────────────────────────────────────
gerarExportacao();
