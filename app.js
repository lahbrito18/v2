require('dotenv').config(); // Carregar variáveis de ambiente
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// Importar rotas
const authRoutes = require('./banco/routes/auth');
const questaoRoutes = require('./banco/routes/questoes');
const salaRoutes = require('./banco/routes/salas');

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.json()); // Para parsing JSON
app.use(express.urlencoded({ extended: true })); // Para parsing form data

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/questoes', questaoRoutes);
app.use('/api/salas', salaRoutes);

// Rota de teste para verificar se o servidor está funcionando
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servidor funcionando',
    timestamp: new Date().toISOString()
  });
});

// Middleware de erro
app.use((err, req, res, next) => {
  console.error('Erro capturado:', err.stack);
  res.status(500).json({ message: 'Erro interno do servidor.' });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

// Porta dinâmica para Render
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
