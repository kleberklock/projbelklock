# Guia de Implantação e Deploy em Produção — Conecta Joias 🚀💎

Este manual detalha o passo-a-passo para colocar o ecossistema **Conecta Joias** online na nuvem e em produção real para vendas e licenciamento white-label.

---

## 📌 Arquitetura de Produção Sugerida

Para manter custos baixos ou gratuitos na inicialização do negócio SaaS:
*   **Banco de Dados:** PostgreSQL hospedado no [Supabase](https://supabase.com) (Plano Gratuito com excelente capacidade).
*   **Servidor Backend (Node.js):** Hospedado no [Railway.app](https://railway.app) ou [Render.com](https://render.com).
*   **Frontend (HTML/JS/CSS Estático):** Hospedado na [Vercel](https://vercel.com) (Plano Gratuito vitalício para arquivos estáticos).

---

## 🛠️ Passo 1: Preparando o Banco de Dados (Supabase)

1. Crie uma conta gratuita em [Supabase.com](https://supabase.com).
2. Crie um novo projeto com o nome da sua plataforma.
3. No painel do projeto, vá em **Project Settings > Database** e localize a **Connection String** no formato URI (Transaction/Session Connection String).
   - Exemplo: `postgresql://postgres.xxx:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
4. Guarde essa URL para configurar no arquivo `.env` do backend posteriormente.

---

## 🛠️ Passo 2: Publicando o Servidor Backend (Railway)

1. Crie uma conta em [Railway.app](https://railway.app) (pode se conectar com sua conta do GitHub).
2. Crie um novo projeto apontando para o seu repositório Git ou suba a pasta `/server` do projeto.
3. Na aba **Variables** do Railway, insira as seguintes variáveis de ambiente correspondentes ao seu arquivo `.env`:

| Variável | Valor Recomendado | Descrição |
|---|---|---|
| `PORT` | `5000` | Porta padrão do servidor |
| `DATABASE_URL` | *Sua URL do Supabase* | String obtida no Passo 1 |
| `JWT_SECRET` | *Gerado Automaticamente* | Deixe em branco; o servidor gerará uma chave de 256 bits criptográfica no startup |
| `FRONTEND_URL` | `https://seufrontend.vercel.app` | URL final do seu frontend na Vercel (obter no Passo 3) |
| `ASAAS_API_KEY` | *Sua chave de produção ASAAS* | Token da sua conta ASAAS v3 |
| `ASAAS_API_URL` | `https://www.asaas.com/api/v3` | Endpoint de produção do ASAAS (trocar sandbox para produção) |
| `WHATSAPP_API_URL` | *URL da sua Z-API ou Evolution* | Endpoint de envio de mensagens do WhatsApp |
| `WHATSAPP_API_KEY` | *Token da sua API de WhatsApp* | Token de autenticação da instância de WhatsApp |
| `SUPER_ADMIN_EMAIL` | `seuemail@dominio.com` | E-mail de login do painel global SuperAdmin |
| `SUPER_ADMIN_SENHA` | *Senha Segura de Produção* | Senha de acesso administrativo |
| `SUPER_ADMIN_PIN` | `1234` | PIN do SuperAdmin |

4. Execute o deploy. O Railway fornecerá um domínio público para a sua API (ex: `https://conectajoias-api.up.railway.app`). Guarde essa URL da API!

---

## 🛠️ Passo 3: Publicando o Frontend (Vercel)

1. Crie uma conta em [Vercel.com](https://vercel.com) integrada com o GitHub.
2. Certifique-se de que a variável `apiUrl` em todos os seus arquivos do frontend (`login.js`, `manager.js`, `saasadmin.js`, `superadmin.js`, `onboarding.js`, `termo_assinatura.js`, `pagamento.js`) esteja apontando de forma dinâmica:
   - Os arquivos já estão configurados com detecção dinâmica e buscam pela origem do site, porém, no código, se você acessar localmente apontando para um backend online, você pode alterar a linha de fallback da URL nos scripts.
3. Importe o projeto no painel da Vercel.
4. Defina o diretório raiz como a pasta que contém o `index.html` (raiz do repositório) e a pasta `/server` adicionada na lista de ignorados.
5. Clique em **Deploy**. A Vercel gerará seu link público (ex: `https://conectajoias.vercel.app`).
6. Se desejar, configure um domínio próprio (ex: `www.conectajoias.com.br`) na aba **Settings > Domains** na Vercel.

---

## 🚀 Passo 4: Sincronizando o Schema do Prisma na Nuvem

Após configurar o `DATABASE_URL` com a string do Supabase no seu ambiente local temporariamente para a migração:
1. No terminal do seu computador, dentro da pasta `/server`, altere temporariamente o seu `.env` local para apontar para a string do Supabase.
2. Execute o comando:
   ```bash
   npx prisma db push
   ```
3. O Prisma criará todas as tabelas (Loja, Usuario, Produto, etc.) no Supabase instantaneamente.
4. Volte o arquivo `.env` local para o banco local (`file:./dev.db`) para continuar desenvolvendo offline sem bagunçar a produção.

---

## 🩺 Diagnóstico e Verificação de Suporte

Acesse o endereço da API na nuvem adicionando `/api/saas/diagnostico` (ex: `https://conectajoias-api.up.railway.app/api/saas/diagnostico`).
O endpoint deve retornar um JSON com status `healthy: true` confirmando a comunicação bem-sucedida entre o backend e o PostgreSQL do Supabase!

Pronto! Seu SaaS Conecta Joias está online e pronto para receber marcas parceiras, emitir boletos/PIX reais e automatizar o WhatsApp.
