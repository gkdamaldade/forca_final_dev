
# Forca API (Node.js + Express + Sequelize + Postgres)

Backend do jogo da **Forca por categorias**. Estrutura inspirada no projeto La Vie (Gama XP) com ajustes de boas práticas e uso de **Postgres**.

## Requisitos
- Node 18+
- Postgres 13+ (ou compatível)

## Setup
1. Clone o repositório e crie seu `.env` baseado no `.env.example`.
2. Instale dependências:
   ```bash
   npm install
   ```
3. Crie o schema e dados de exemplo no Postgres:
   ```bash
   # use psql conforme suas credenciais
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f DB/schema.sql
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f DB/seed.sql
   ```
4. Rode em desenvolvimento:
   ```bash
   npm run start:dev
   ```

## Endpoints principais
- `GET /health` – healthcheck
- `GET /api/categories` – lista categorias ativas
- `GET /api/words/random?category=animais|categoryId=1` – palavra aleatória
- `POST /api/results` – registra resultado
- `GET /api/results/leaderboard?limit=10&period=month` – ranking

## Docs
- OpenAPI: `docs/openapi.yaml`
- Postman Collection: `docs/postman_collection.json`

## Observações
- **Sequelize** está configurado para **não** rodar `sync()`; a estrutura vem via SQL em `DB/`.
- Timestamps usam `created_at`/`updated_at` (snake_case). Ajuste `define` em `src/db/sequelize.js` se seu schema for diferente.
- Autenticação JWT está disponível via middleware (`src/middleware/auth.js`), mas **não é obrigatória** para os endpoints atuais.

## Scripts úteis
- `npm run start:dev` – desenvolvimento com nodemon
- `npm start` – produção simples

