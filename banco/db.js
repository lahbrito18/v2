const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Teste de conexão (executa apenas uma vez ao iniciar)
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar com PostgreSQL:', err.stack);
  } else {
    console.log('✅ Conectado ao PostgreSQL no Render com sucesso!');
    release();
  }
});

module.exports = pool;
