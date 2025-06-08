const express = require('express');
const pool = require('../db'); // PostgreSQL pool
const router = express.Router();

// 📌 Listar todas as questões com suas alternativas
router.get('/', async (req, res) => {
  try {
    const questionsResult = await pool.query('SELECT * FROM questions ORDER BY id');
    const questions = questionsResult.rows;

    const results = [];
    
    for (const question of questions) {
      const alternativasResult = await pool.query(
        'SELECT * FROM alternativas WHERE question_id = $1', 
        [question.id]
      );
      
      results.push({
        ...question,
        alternativas: alternativasResult.rows
      });
    }

    res.json(results);

  } catch (error) {
    console.error('Erro ao buscar questões:', error);
    res.status(500).json({ error: 'Erro ao buscar questões.' });
  }
});

// ✅ Inserir uma nova questão com alternativas
router.post('/', async (req, res) => {
  const { enunciado, categoria, banca, ano, alternativas, comentario } = req.body;

  if (!enunciado || !categoria || !banca || !ano || !alternativas || !Array.isArray(alternativas)) {
    return res.status(400).json({ error: 'Dados inválidos ou incompletos.' });
  }

  try {
    // Inserir questão
    const questionResult = await pool.query(
      'INSERT INTO questions (enunciado, categoria, banca, ano, comentario) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [enunciado, categoria, banca, ano, comentario]
    );

    const questionId = questionResult.rows[0].id;

    // Inserir alternativas
    for (const alt of alternativas) {
      await pool.query(
        'INSERT INTO alternativas (question_id, texto, correta) VALUES ($1, $2, $3)',
        [questionId, alt.texto, alt.correta ? true : false]
      );
    }

    res.json({ message: 'Questão cadastrada com sucesso', id: questionId });

  } catch (error) {
    console.error('Erro ao cadastrar questão:', error);
    res.status(500).json({ error: 'Erro ao cadastrar questão.' });
  }
});

// Rota para processar resposta de questão
router.post('/responder', async (req, res) => {
  const { userId, questaoId, respostaSelecionada } = req.body;

  if (!userId || !questaoId || respostaSelecionada === undefined) {
    return res.status(400).json({
      message: 'userId, questaoId e respostaSelecionada são obrigatórios.'
    });
  }

  try {
    // Buscar a questão
    const questaoResult = await pool.query('SELECT * FROM questions WHERE id = $1', [questaoId]);
    
    if (questaoResult.rows.length === 0) {
      return res.status(404).json({ message: 'Questão não encontrada.' });
    }

    const questao = questaoResult.rows[0];

    // Buscar alternativa correta
    const alternativaCorretaResult = await pool.query(
      'SELECT * FROM alternativas WHERE question_id = $1 AND correta = true',
      [questaoId]
    );

    if (alternativaCorretaResult.rows.length === 0) {
      return res.status(500).json({ message: 'Resposta correta não encontrada.' });
    }

    const alternativaCorreta = alternativaCorretaResult.rows[0];
    const respostaCorreta = respostaSelecionada === alternativaCorreta.id;
    const pontosGanhos = respostaCorreta ? 5 : 2;

    // Atualizar pontuação do usuário
    await pool.query(
      'UPDATE usuarios SET pontos = COALESCE(pontos, 0) + $1 WHERE id = $2',
      [pontosGanhos, userId]
    );

    // Registrar a resposta (opcional, para histórico)
    try {
      await pool.query(
        'INSERT INTO respostas_usuarios (user_id, questao_id, resposta_selecionada, correta, pontos_ganhos) VALUES ($1, $2, $3, $4, $5)',
        [userId, questaoId, respostaSelecionada, respostaCorreta, pontosGanhos]
      );
    } catch (err) {
      console.error('Erro ao registrar resposta (não crítico):', err);
    }

    // Buscar pontuação atualizada
    const usuarioResult = await pool.query('SELECT pontos FROM usuarios WHERE id = $1', [userId]);
    const pontosAtuais = usuarioResult.rows[0]?.pontos || pontosGanhos;

    res.json({
      message: respostaCorreta ? 'Resposta correta!' : 'Resposta incorreta!',
      correta: respostaCorreta,
      pontosGanhos: pontosGanhos,
      pontosAtuais: pontosAtuais,
      respostaCorreta: alternativaCorreta.id
    });

  } catch (error) {
    console.error('Erro ao processar resposta:', error);
    res.status(500).json({ message: 'Erro ao processar resposta.' });
  }
});

// Rota para buscar pontuação do usuário
router.get('/pontuacao/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query('SELECT pontos FROM usuarios WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    res.json({
      userId: userId,
      pontos: result.rows[0].pontos || 0
    });

  } catch (error) {
    console.error('Erro ao buscar pontuação:', error);
    res.status(500).json({ message: 'Erro ao buscar pontuação.' });
  }
});

// Rota para buscar ranking de usuários
router.get('/ranking', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nome, email, pontos 
      FROM usuarios 
      WHERE pontos > 0 
      ORDER BY pontos DESC 
      LIMIT 10
    `);

    res.json(result.rows);

  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    res.status(500).json({ message: 'Erro ao buscar ranking.' });
  }
});

module.exports = router;
