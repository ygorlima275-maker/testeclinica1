const express = require('express');
const store = require('../services/store');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/clinics
router.get('/', requireAuth, requireRole('admin', 'clinic'), async (req, res, next) => {
  try {
    const rows = await store.list('clinics', { orderBy: 'id', ascending: true });
    let items = rows;

    if (req.user.role === 'clinic') {
      items = rows.filter(
        (c) =>
          (req.user.clinicId && Number(c.id) === Number(req.user.clinicId)) ||
          (c.email && c.email.toLowerCase() === req.user.email.toLowerCase())
      );
    }

    return res.json({ clinics: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/clinics (Coordenação cadastra clínica parceira)
router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, cnpj, crmv, email, phone, address } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanName || !cleanEmail) {
      return res.status(400).json({ error: 'Nome e e-mail da clínica são obrigatórios.' });
    }

    const existing = await store.findByField('clinics', 'email', cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Já existe uma clínica cadastrada com este e-mail.' });
    }

    const created = await store.insert('clinics', {
      name: cleanName,
      cnpj: String(cnpj || '').trim() || null,
      crmv: String(crmv || '').trim() || null,
      email: cleanEmail,
      phone: String(phone || '').trim() || null,
      address: String(address || '').trim() || null,
      status: 'Parceiro Credenciado'
    });

    return res.status(201).json({
      clinic: created,
      message: 'Clínica parceira cadastrada com sucesso!'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clinics/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const removed = await store.remove('clinics', req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Clínica parceira não encontrada.' });
    }
    return res.json({ message: 'Clínica parceira removida com sucesso.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
