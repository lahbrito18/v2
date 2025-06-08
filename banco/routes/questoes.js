const express = require('express');
const db = require('../db');
const router = express.Router();

// 📌 Listar todas as questões com suas alternativas
router.get('/', (req, res) => {
  db.all(`SELECT * FROM questions`, [], (err, questions) => {
    if (err) return res.status(500).json({ error: err.message });

    const results = [];
    let pending = questions.length;

    if (pending === 0) return res.json([]);

    questions.forEach(question => {
      db.all(`SELECT * FROM alternativas WHERE question_id = ?`, [question.id], (err, alternativas) => {
        if (err) return res.status(500).json({ error: err.message });

        results.push({ ...question, alternativas });

        if (--pending === 0) res.json(results);
      });
    });
  });
});

// ✅ Inserir uma nova questão com alternativas
router.post('/', (req, res) => {
  const { enunciado, categoria, banca, ano, alternativas, comentario } = req.body;

  if (!enunciado || !categoria || !banca || !ano || !alternativas || !Array.isArray(alternativas)) {
    return res.status(400).json({ error: 'Dados inválidos ou incompletos.' });
  }

  db.run(
    `INSERT INTO questions (enunciado, categoria, banca, ano, comentario) VALUES (?, ?, ?, ?, ?)`,
    [enunciado, categoria, banca, ano, comentario],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const questionId = this.lastID;

      const stmt = db.prepare(`INSERT INTO alternativas (question_id, texto, correta) VALUES (?, ?, ?)`);
      alternativas.forEach(alt => {
        stmt.run(questionId, alt.texto, alt.correta ? 1 : 0);
      });
      stmt.finalize();

      res.json({ message: 'Questão cadastrada com sucesso', id: questionId });
    }
  );
});

module.exports = router;
