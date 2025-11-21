# 📋 Instruções para Executar os Scripts SQL

Este guia mostra como executar os scripts SQL para criar as tabelas e popular os dados.

## 🎯 Opção 1: Usando o Script Node.js (Recomendado)

Se você tem Node.js instalado e configurado:

```bash
npm run db:setup
```

Ou diretamente:

```bash
node scripts/executar-sql.js
```

## 🎯 Opção 2: Usando psql (PostgreSQL CLI)

### Windows (PowerShell ou CMD):

```powershell
# Substitua as variáveis pelos seus valores do .env
$env:PGPASSWORD="sua_senha"
psql -h localhost -U seu_usuario -d nome_do_banco -f DB/schema.sql
psql -h localhost -U seu_usuario -d nome_do_banco -f DB/seed.sql
```

### Linux/Mac:

```bash
# Substitua as variáveis pelos seus valores do .env
export PGPASSWORD="sua_senha"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f DB/schema.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f DB/seed.sql
```

## 🎯 Opção 3: Usando uma Interface Gráfica (pgAdmin, DBeaver, etc.)

1. Abra sua ferramenta de gerenciamento de banco (pgAdmin, DBeaver, etc.)
2. Conecte-se ao seu banco de dados
3. Abra o arquivo `DB/schema.sql` e execute todo o conteúdo
4. Abra o arquivo `DB/seed.sql` e execute todo o conteúdo

## 🎯 Opção 4: Via Supabase Dashboard (se estiver usando Supabase)

1. Acesse o Supabase Dashboard
2. Vá em "SQL Editor"
3. Cole o conteúdo de `DB/schema.sql` e execute
4. Cole o conteúdo de `DB/seed.sql` e execute

## ✅ Verificação

Após executar os scripts, verifique se:

1. ✅ A tabela `itemloja` foi criada
2. ✅ A tabela `inventario` foi criada (ou atualizada)
3. ✅ Existem 6 registros na tabela `itemloja` (os poderes)

### Query de verificação:

```sql
-- Verificar se a tabela itemloja existe e tem dados
SELECT COUNT(*) FROM itemloja;
-- Deve retornar 6

-- Verificar os poderes inseridos
SELECT id, nome, tipo_poder, custo_moedas FROM itemloja;
```

## ⚠️ Problemas Comuns

### Erro: "relation already exists"
- Isso é normal se você já executou o schema antes
- O script usa `CREATE TABLE IF NOT EXISTS`, então é seguro executar novamente

### Erro: "ON CONFLICT DO NOTHING"
- Isso é normal no seed.sql
- Significa que os dados já existem e não serão duplicados

### Erro de conexão
- Verifique se as variáveis no `.env` estão corretas
- Verifique se o banco de dados está rodando
- Verifique se as credenciais estão corretas

## 📝 Variáveis Necessárias no .env

Certifique-se de ter estas variáveis configuradas:

```
DB_HOST=localhost (ou seu host)
DB_PORT=5432
DB_NAME=nome_do_seu_banco
DB_USER=seu_usuario
DB_PASS=sua_senha
DB_DIALECT=postgres
```

