const express = require('express');
const { isSupabaseConfigured, supabase } = require('../config/supabase');
const store = require('../services/store');

const router = express.Router();

// GET /api/health — status da API e conexão com o Supabase
router.get('/health', async (_req, res) => {
  let dbConnected = false;
  let tablesReady = false;
  let detail = 'Variáveis de ambiente do Supabase não configuradas (modo memória ativo).';

  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('appointments').select('id').limit(1);
      if (!error) {
        dbConnected = true;
        tablesReady = true;
        detail = 'Conectado ao PostgreSQL Supabase com tabelas ativas.';
      } else if (error.code === 'PGRST205') {
        dbConnected = true;
        tablesReady = false;
        detail = 'Conectado ao Supabase, aguardando execução de supabase/migrations/001_initial_schema.sql.';
      } else {
        detail = error.message;
      }
    } catch (err) {
      detail = err.message;
    }
  }

  return res.json({
    ok: true,
    service: 'hemo-vet-api',
    supabaseConfigured: isSupabaseConfigured(),
    dbConnected,
    tablesReady,
    storageMode: store.getStorageMode(),
    detail
  });
});

// GET /api/stats — contagens públicas da página inicial (sem expor dados pessoais)
router.get('/stats', async (_req, res, next) => {
  try {
    const [animals, clinics, appointments, collections] = await Promise.all([
      store.list('animals'),
      store.list('clinics'),
      store.list('appointments'),
      store.list('collections')
    ]);

    return res.json({
      animals: animals.length,
      clinics: clinics.length,
      appointments: appointments.length,
      collections: collections.length,
      partnerNames: clinics.map((c) => c.name)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
