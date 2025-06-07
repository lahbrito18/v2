const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

// Armazenar tokens na memória (para produção, use cache ou banco)
const resetTokens = {};

// Cadastro
router.post('/registro', (req, res) => {
  const { name, email, password, apelido, pais, foto } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ erro: 'Todos os campos obrigatórios (name, email, password).' });
  }

  // Se pais for objeto ou string JSON, converta para string antes de salvar
  let paisString = null;
  if (pais) {
    if (typeof pais === 'object') {
      paisString = JSON.stringify(pais);
    } else {
      // tenta garantir que é string JSON válida
      paisString = pais;
    }
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const query = `
    INSERT INTO users (name, email, password, apelido, pais, foto) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [name, email, hashedPassword, apelido || null, paisString, foto || null], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ erro: 'E-mail já cadastrado.' });
      }
      return res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
    }

    return res.status(200).json({ sucesso: true, id: this.lastID });
  });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Erro no servidor' });
    }
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const senhaValida = bcrypt.compareSync(password, user.password);

    if (!senhaValida) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Remover senha antes de enviar dados do usuário
    delete user.password;

    res.json({ message: 'Login bem-sucedido', user });
  });
});

// Esqueci a senha
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'E-mail é obrigatório.' });

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ message: 'Erro no servidor.' });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

    const token = crypto.randomBytes(20).toString('hex');
    const expires = Date.now() + 3600000; // 1 hora

    resetTokens[token] = { email, expires };

    const resetLink = `https://prepara-enade.onrender.com/reset-password.html?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'contatopreparaenade@gmail.com',
        pass: 'Yitp meyo sbuq tnqg' // cuidado com dados sensíveis no código!
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
          <p style="font-size: 16px; color: #555555;">
            Para criar uma nova senha, clique no botão abaixo:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" target="_blank" style="background-color: #007bff; color: white; padding: 14px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Redefinir Senha
            </a>
          </div>

          <p style="font-size: 14px; color: #888888;">
            Se você não solicitou a redefinição de senha, ignore este e-mail.
          </p>

          <hr style="border: none; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #aaaaaa; text-align: center;">
            &copy; 2025 Prepara Enade - Todos os direitos reservados
          </p>
        </div>
      </div>
    `
  };

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        return res.status(500).json({ message: 'Erro ao enviar o e-mail.' });
      }
      res.json({ message: 'Link de redefinição enviado para seu e-mail.' });
    });
  });
});

router.get('/usuario/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT id, name, email, apelido, pais, foto FROM users WHERE id = ?', [id], (err, user) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao buscar usuário.' });
    }
    if (!user) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    res.json(user);
  });
});

// Resetar senha
router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) return res.status(400).json({ message: 'Dados inválidos.' });

  const tokenData = resetTokens[token];

  if (!tokenData) return res.status(400).json({ message: 'Token inválido.' });

  if (Date.now() > tokenData.expires) {
    delete resetTokens[token];
    return res.status(400).json({ message: 'Token expirado.' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);

  db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, tokenData.email], (err) => {
    if (err) return res.status(500).json({ message: 'Erro ao atualizar senha.' });

    delete resetTokens[token];
    res.json({ message: 'Senha atualizada com sucesso.' });
  });
});

// Ranking de usuários por pontuação
router.get('/ranking', (req, res) => {
  const query = `
    SELECT u.name, 
           COALESCE(SUM(s.pontuacao), 0) AS total_pontos
    FROM users u
    LEFT JOIN simulados s ON s.user_id = u.id
    GROUP BY u.id
    ORDER BY total_pontos DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao buscar ranking' });
    res.json(rows);
  });
});

// Atualizar perfil do usuário
router.put('/update-profile', (req, res) => {
  const { id, name, apelido, pais, foto } = req.body;

  if (!id || !name || !apelido || !pais || !foto) {
    return res.status(400).json({ sucesso: false, erro: 'Todos os campos são obrigatórios.' });
  }

  const query = `
    UPDATE users
    SET name = ?, apelido = ?, pais = ?, foto = ?
    WHERE id = ?
  `;

  const params = [name, apelido, pais, foto, id];

  db.run(query, params, function (err) {
    if (err) {
      console.error('Erro ao atualizar perfil:', err);
      return res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar o perfil.' });
    }

    res.json({ sucesso: true, mensagem: 'Perfil atualizado com sucesso.' });
  });
});

// Simulação de banco de dados em memória
let usuario = {
  nome: "Usuário Exemplo",
  email: "exemplo@teste.com"
};

// Rota para atualizar perfil
router.put('/atualizar-perfil', (req, res) => {
  const dadosAtualizados = req.body;

  // Aqui você deve validar os dados recebidos

  // Atualiza o usuário (no seu banco seria uma query de update)
  usuario = { ...usuario, ...dadosAtualizados };

  // Retorna sucesso
  res.json({ success: true, usuario });
});

// Rota para obter dados do usuário (opcional)
router.get('/perfil', (req, res) => {
  res.json(usuario);
});
router.get("/api/usuarios", (req, res) => {
  db.all(`SELECT id, name FROM users`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
// PATCH /api/usuarios/pontos
router.patch('/api/usuarios/pontos', async (req, res) => {
  const { id, pontos } = req.body;

  if (!id || typeof pontos !== 'number') {
    return res.status(400).json({ erro: 'Dados inválidos' });
  }

    db.run('UPDATE users SET pontos = COALESCE(pontos, 0) + ? WHERE id = ?', [pontos, id], function (err) {
  if (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao atualizar pontos' });
  }
  res.status(200).json({ sucesso: true });
  console.log("Recebido para atualizar:", req.body);
});})


module.exports = router;
