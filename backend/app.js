const express = require('express');
const path = require('path');
const apiRoutes = require('./routes');

const app = express();
const STATIC_DIR = path.resolve(__dirname, '..', 'Clinica-main', 'Hemo_vet2.0');

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// API REST modular (/api/*)
app.use('/api', apiRoutes);

// Arquivos estáticos do front-end
app.use(express.static(STATIC_DIR));

// Fallback SPA
app.use((_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// Middleware global de erro da API
app.use((err, _req, res, _next) => {
  console.error('[API Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno no servidor.'
  });
});

module.exports = app;
