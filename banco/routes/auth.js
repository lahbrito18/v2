const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('../db'); // Usar o pool do db.js

const router = express.Router();
const resetTokens = {};

// ===== MANTER APENAS POSTGRESQL =====

// Rota adicional para compatibilidade com frontend
router.post('/registro', async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    const userExists = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'Usuário já existe.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO usuarios (nome, email, senha, pontos) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, hashedPassword, 0]
    );

    const userId = result.rows[0].id;

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      userId: userId,
      usuario: { id: userId, nome: name, email: email }
    });

  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Login (CORRIGIR PARA POSTGRESQL)
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const user = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, user.senha);
    
    if (!senhaValida) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    delete user.senha;
    res.json({ message: 'Login bem-sucedido', user });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Esqueci a senha (CORRIGIR PARA POSTGRESQL)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) return res.status(400).json({ message: 'E-mail é obrigatório.' });

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const expires = Date.now() + 3600000;
    resetTokens[token] = { email, expires };

    const resetLink = `https://prepara-enade.onrender.com/reset-password.html?token=${token}`;

    const transporter = nodemailer.createTransporter({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: '"Prepara Enade" <contatopreparaenade@gmail.com>',
      to: email,
      subject: "🔐 Recuperação de Senha - Prepara Enade",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333333;">Olá!</h2>
            <p style="font-size: 16px; color: #555555;">
              Recebemos uma solicitação para redefinir sua senha no <strong>Prepara Enade</strong>.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" target="_blank" style="background-color: #007bff; color: white; padding: 14px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Redefinir Senha
              </a>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Link de redefinição enviado para seu e-mail.' });

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ message: 'Erro ao processar solicitação.' });
  }
});

// Reset senha (CORRIGIR PARA POSTGRESQL)
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) return res.status(400).json({ message: 'Dados inválidos.' });

  const tokenData = resetTokens[token];
  if (!tokenData) return res.status(400).json({ message: 'Token inválido.' });

  if (Date.now() > tokenData.expires) {
    delete resetTokens[token];
    return res.status(400).json({ message: 'Token expirado.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await pool.query('UPDATE usuarios SET senha = $1 WHERE email = $2', [hashedPassword, tokenData.email]);
    
    delete resetTokens[token];
    res.json({ message: 'Senha atualizada com sucesso.' });

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ message: 'Erro ao atualizar senha.' });
  }
});

module.exports = router;
