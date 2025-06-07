const express = require('express');
const router = express.Router();
const db = require('../db');

// Criação de sala
// Criar nova sala
// Criar nova sala com usuários
router.post('/', (req, res) => {
  const { nome, usuarios } = req.body;

  if (!nome || !Array.isArray(usuarios) || usuarios.length === 0) {
    return res.status(400).json({ message: 'Nome da sala e pelo menos um usuário são obrigatórios.' });
  }

  db.run(`INSERT INTO salas (nome) VALUES (?)`, [nome], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ message: 'Sala já existe.' });
      }
      return res.status(500).json({ message: 'Erro ao criar sala.' });
    }

    const salaId = this.lastID;

    const stmt = db.prepare(`INSERT INTO sala_usuarios (sala_id, user_id) VALUES (?, ?)`);
    usuarios.forEach(userId => stmt.run(salaId, userId));
    stmt.finalize();

    return res.status(201).json({ message: 'Sala criada com sucesso.', salaId });
  });
});


// Buscar salas criadas por um usuário específico
router.get('/', (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ message: 'Parâmetro userId é obrigatório.' });
  }

  const query = `SELECT * FROM salas WHERE creator_id = ?`;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Erro ao buscar salas.' });
    }

    res.json(rows);
  });
});

module.exports = router;
