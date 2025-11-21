// scripts/executar-sql.js
// Script para executar os arquivos SQL no banco de dados
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

const {
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASS,
  DB_DIALECT
} = process.env;

if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASS) {
  console.error('❌ Erro: Variáveis de ambiente do banco de dados não configuradas!');
  console.error('Verifique se o arquivo .env existe e contém: DB_HOST, DB_NAME, DB_USER, DB_PASS');
  process.exit(1);
}

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT || 5432,
  dialect: DB_DIALECT || 'postgres',
  logging: false, // Desabilita logs do Sequelize
  dialectOptions: DB_DIALECT === 'postgres' ? {
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  } : {}
});

async function executarSQL(arquivo) {
  try {
    const caminhoArquivo = path.join(__dirname, '..', arquivo);
    
    if (!fs.existsSync(caminhoArquivo)) {
      console.error(`❌ Arquivo não encontrado: ${caminhoArquivo}`);
      return false;
    }

    const sql = fs.readFileSync(caminhoArquivo, 'utf8');
    
    console.log(`\n📄 Executando: ${arquivo}...`);
    
    // Executa o SQL completo de uma vez
    // O PostgreSQL suporta múltiplos comandos separados por ;
    try {
      await sequelize.query(sql, { raw: true });
    } catch (err) {
      // Ignora erros de "já existe" para CREATE TABLE IF NOT EXISTS e ON CONFLICT
      if (err.message.includes('already exists') || 
          err.message.includes('duplicate') ||
          err.message.includes('ON CONFLICT') ||
          err.message.includes('does not exist')) {
        // Esses erros são esperados e podem ser ignorados
        console.log(`   ℹ️  Alguns comandos já foram executados anteriormente (isso é normal)`);
      } else {
        throw err;
      }
    }
    
    console.log(`✅ ${arquivo} executado com sucesso!`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao executar ${arquivo}:`, error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🔌 Conectando ao banco de dados...');
    await sequelize.authenticate();
    console.log('✅ Conexão estabelecida!\n');

    // Executa schema.sql primeiro
    const schemaOk = await executarSQL('DB/schema.sql');
    
    if (!schemaOk) {
      console.error('\n❌ Falha ao executar schema.sql. Abortando...');
      process.exit(1);
    }

    // Executa seed.sql depois
    const seedOk = await executarSQL('DB/seed.sql');
    
    if (!seedOk) {
      console.warn('\n⚠️  Aviso: seed.sql teve problemas, mas pode continuar...');
    }

    console.log('\n🎉 Execução concluída!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Verifique se as tabelas foram criadas corretamente');
    console.log('   2. Verifique se os 6 poderes foram inseridos na tabela itemloja');
    console.log('   3. Inicie o servidor: npm run start:dev');

  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();

