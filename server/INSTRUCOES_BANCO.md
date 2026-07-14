# 🗄️ Guia de Configuração e Migração do Banco de Dados

Esta etapa migrou o banco de dados padrão do sistema do **SQLite** (local para testes) para o **PostgreSQL** (robusto e pronto para produção/SaaS). 

Abaixo estão as instruções sobre como configurar e rodar o banco de dados.

---

## 🚀 Como Configurar o PostgreSQL para Produção/SaaS

1. **Obtenha um banco de dados PostgreSQL:**
   - **Recomendado:** Crie um projeto gratuito no [Supabase](https://supabase.com) ou no [Railway](https://railway.app). Eles fornecem uma URL de conexão pronta para uso.

2. **Configure a variável de ambiente:**
   - No arquivo `server/.env`, substitua a linha `DATABASE_URL="file:./dev.db"` pela URL de conexão do seu PostgreSQL:
     ```env
     DATABASE_URL="postgresql://usuario:senha@host:5432/banco?schema=public"
     ```

3. **Gere a estrutura de tabelas no banco PostgreSQL:**
   - Execute o comando abaixo no terminal (dentro da pasta `server/`):
     ```bash
     npx prisma db push
     ```
     *Nota: Esse comando criará todas as tabelas (Loja, Usuario, Produto, LinkPagamento, etc.) diretamente no seu PostgreSQL.*

4. **Popule o banco com os dados iniciais:**
   - Execute o seed para cadastrar a loja padrão e o SuperAdmin no seu novo banco:
     ```bash
     node seed.js
     ```

---

## 💻 Como Voltar para SQLite (Apenas para Desenvolvimento Local)

Se você preferir continuar codando e testando o sistema 100% offline no seu computador usando o SQLite (`dev.db`), siga estas etapas simples:

1. **No arquivo `server/schema.prisma`:**
   - Altere o `provider` de volta para `sqlite`:
     ```prisma
     datasource db {
       provider = "sqlite"
       url      = env("DATABASE_URL")
     }
     ```

2. **No arquivo `server/.env`:**
   - Altere a URL do banco para apontar para o arquivo local:
     ```env
     DATABASE_URL="file:./dev.db"
     ```

3. **Regere o Cliente Prisma:**
   - Rode o comando:
     ```bash
     npx prisma generate
     ```
