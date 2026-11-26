const express = require('express');
const store = require('../services/store');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function toContactDto(row) {
  return {
    id: row.id,
    clinicName: row.clinic_name,
    animal: row.animal,
    subject: row.subject,
    message: row.message,
    date: row.date,
    status: row.status || 'Requisição de Doador Enviada à Coordenação'
  };
}

// GET /api/clinic-contacts
router.get('/', requireAuth, requireRole('clinic', 'admin'), async (req, res, next) => {
  try {
    const rows = await store.list('clinic_contacts', { orderBy: 'id', ascending: true });
    let items = rows.map(toContactDto);

    if (req.user.role === 'clinic') {
      items = items.filter(
        (c) => (c.clinicName || '').toLowerCase() === req.user.name.toLowerCase()
      );
    }

    return res.json({ contacts: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/clinic-contacts
router.post('/', requireAuth, requireRole('clinic'), async (req, res, next) => {
  try {
    const { animal, subject, message } = req.body || {};
    const cleanAnimal = String(animal || '').trim();
    const cleanSubject = String(subject || '').trim();
    const cleanMessage = String(message || '').trim();

    if (!cleanAnimal || !cleanSubject || !cleanMessage) {
      return res.status(400).json({ error: 'Animal, assunto e mensagem são obrigatórios.' });
    }

    const created = await store.insert('clinic_contacts', {
      clinic_name: req.user.name,
      animal: cleanAnimal,
      subject: cleanSubject,
      message: `Animal Associado: ${cleanAnimal} | ${cleanMessage}`,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: 'Requisição de Doador Enviada à Coordenação'
    });

    return res.status(201).json({
      contact: toContactDto(created),
      message: 'Requisição de doador associada ao animal enviada com sucesso!'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
