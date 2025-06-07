const { Pool } = require('pg');

// Conexão com o PostgreSQL (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function criarTabelas() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        apelido TEXT,
        pais TEXT,
        foto TEXT,
        pontos INTEGER DEFAULT 0
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        enunciado TEXT NOT NULL,
        categoria TEXT,
        banca TEXT,
        ano INTEGER,
        comentario TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS alternativas (
        id SERIAL PRIMARY KEY,
        question_id INTEGER REFERENCES questions(id),
        texto TEXT,
        correta BOOLEAN
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS salas (
        id SERIAL PRIMARY KEY,
        nome TEXT,
        creator_id INTEGER REFERENCES users(id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sala_usuarios (
        sala_id INTEGER REFERENCES salas(id),
        user_id INTEGER REFERENCES users(id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS simulados (
        id SERIAL PRIMARY KEY,
        sala_id INTEGER,
        user_id INTEGER,
        pontuacao INTEGER,
        data DATE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comentarios (
        id SERIAL PRIMARY KEY,
        questao_id INT NOT NULL,
        usuario_id INT NOT NULL,
        nome_usuario VARCHAR(100),
        texto TEXT NOT NULL,
        data TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Todas as tabelas foram criadas ou já existiam.");
  } catch (error) {
    console.error("Erro ao criar tabelas:", error);
  }
}

criarTabelas();

module.exports = pool;
