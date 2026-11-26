const express = require('express');
const fs = require('fs');
const path = require('path');

const healthRoutes = require('./health');
const authRoutes = require('./auth');
const collectionsRoutes = require('./collections');
const appointmentsRoutes = require('./appointments');
const animalsRoutes = require('./animals');
const clinicsRoutes = require('./clinics');
const clinicContactsRoutes = require('./clinicContacts');

const router = express.Router();

// Rotas de sistema e diagnóstico
router.use('/', healthRoutes);

// Autenticação
router.use('/auth', authRoutes);

// Módulos completos: Coletas e Consultas
router.use('/collections', collectionsRoutes);
router.use('/appointments', appointmentsRoutes);

// Módulos base para expansão da equipe
router.use('/animals', animalsRoutes);
router.use('/clinics', clinicsRoutes);
router.use('/clinic-contacts', clinicContactsRoutes);

// Auto-registro de novos módulos criados por outros integrantes em backend/routes/*.js
const CORE_FILES = new Set([
  'index.js',
  'health.js',
  'auth.js',
  'collections.js',
  'appointments.js',
  'animals.js',
  'clinics.js',
  'clinicContacts.js'
]);

fs.readdirSync(__dirname).forEach((file) => {
  if (!file.endsWith('.js') || CORE_FILES.has(file)) return;
  const routeName = file.replace(/\.js$/, '');
  if (!/^[a-zA-Z0-9_-]+$/.test(routeName)) return;
  const mod = require(path.join(__dirname, file));
  if (typeof mod === 'function') {
    router.use(`/${routeName}`, mod);
  }
});

// 404 explícito para endpoints /api/* desconhecidos
router.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint da API não encontrado.' });
});

module.exports = router;
