const express = require('express');
const store = require('../services/store');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_STATUS = ['Pendente', 'Confirmado', 'Cancelado'];

function toAppointmentDto(row) {
  return {
    id: row.id,
    animalId: row.animal_id || null,
    animal: row.animal,
    owner: row.owner,
    ownerEmail: row.owner_email || null,
    service: row.service,
    date: row.date,
    status: row.status || 'Pendente',
    notes: row.notes || '',
    createdAt: row.created_at || null
  };
}

function evaluateSlot(dateStr, existingAppointments, excludeId = null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(dateStr || '').trim());
  if (!m) {
    return {
      valid: false,
      status: 'invalid',
      message: 'Formato de data e hora inválido.'
    };
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const dayNum = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);

  const utcDate = new Date(Date.UTC(year, month - 1, dayNum));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== dayNum ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59
  ) {
    return {
      valid: false,
      status: 'invalid',
      message: 'Data ou horário inválido.'
    };
  }

  const normalizedDate = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  const conflict = existingAppointments.some((appt) => {
    if (excludeId && Number(appt.id) === Number(excludeId)) return false;
    if (appt.status === 'Cancelado') return false;
    return String(appt.date || '').slice(0, 16) === normalizedDate;
  });

  if (conflict) {
    return {
      valid: false,
      status: 'occupied',
      message: 'Já existe uma consulta cadastrada neste exato horário.'
    };
  }

  const day = utcDate.getUTCDay();
  if (day === 0 || day === 6) {
    return {
      valid: false,
      status: 'weekend',
      message: 'Não há atendimentos aos finais de semana (somente Segunda a Sexta).'
    };
  }

  if (hour < 8 || hour >= 17) {
    return {
      valid: true,
      status: 'after_hours',
      message: 'Horário fora de expediente (08:00 às 17:00). Poderá requerer confirmação especial.'
    };
  }

  return {
    valid: true,
    status: 'available',
    message: 'Horário livre e disponível para agendamento!'
  };
}

// GET /api/appointments/availability?date=YYYY-MM-DDTHH:mm&excludeId=1
router.get('/availability', requireAuth, async (req, res, next) => {
  try {
    const { date, excludeId } = req.query;
    const all = await store.list('appointments');
    const result = evaluateSlot(String(date || ''), all, excludeId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments — lista consultas conforme perfil
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'clinic') {
      return res.status(403).json({
        error: 'Clínicas parceiras não possuem acesso à agenda de consultas.'
      });
    }

    const rows = await store.list('appointments', { orderBy: 'date', ascending: true });
    let items = rows.map(toAppointmentDto);

    if (req.user.role === 'tutor') {
      items = items.filter(
        (a) =>
          (a.ownerEmail && a.ownerEmail.toLowerCase() === req.user.email.toLowerCase()) ||
          a.owner.toLowerCase() === req.user.name.toLowerCase()
      );
    }

    const { status } = req.query;
    if (status) {
      items = items.filter((a) => a.status === status);
    }

    return res.json({ appointments: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments — agendar nova consulta
router.post('/', requireAuth, requireRole('tutor', 'admin'), async (req, res, next) => {
  try {
    const { animalId, animal, owner, service, date, notes } = req.body || {};

    const cleanAnimal = String(animal || '').trim();
    const cleanService = String(service || '').trim();
    const cleanDate = String(date || '').trim();
    const resolvedOwner =
      req.user.role === 'tutor' ? req.user.name : String(owner || req.user.name).trim();

    if (!cleanAnimal || !cleanService || !cleanDate) {
      return res.status(400).json({
        error: 'Pet, serviço/motivo e data/horário são obrigatórios.'
      });
    }

    const all = await store.list('appointments');
    const slot = evaluateSlot(cleanDate, all);
    if (!slot.valid) {
      const code = slot.status === 'occupied' ? 409 : 400;
      return res.status(code).json({ error: slot.message, slot });
    }

    let resolvedAnimalId = animalId ? Number(animalId) : null;
    if (!resolvedAnimalId) {
      const animals = await store.list('animals');
      const matched = animals.find(
        (a) =>
          a.name.toLowerCase() === cleanAnimal.toLowerCase() &&
          a.owner.toLowerCase() === resolvedOwner.toLowerCase()
      );
      if (matched) resolvedAnimalId = matched.id;
    }

    const created = await store.insert('appointments', {
      animal_id: resolvedAnimalId,
      animal: cleanAnimal,
      owner: resolvedOwner,
      owner_email: req.user.role === 'tutor' ? req.user.email : null,
      service: cleanService,
      date: cleanDate,
      status: 'Pendente',
      notes: String(notes || '').trim()
    });

    return res.status(201).json({
      appointment: toAppointmentDto(created),
      message: 'Consulta agendada com sucesso!'
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/appointments/:id — reagendar/editar consulta
router.put('/:id', requireAuth, requireRole('tutor', 'admin'), async (req, res, next) => {
  try {
    const existing = await store.getById('appointments', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Consulta não encontrada.' });
    }

    const isOwner =
      (existing.owner_email && existing.owner_email.toLowerCase() === req.user.email.toLowerCase()) ||
      existing.owner.toLowerCase() === req.user.name.toLowerCase();

    if (req.user.role === 'tutor' && !isOwner) {
      return res.status(403).json({ error: 'Você só pode reagendar as suas próprias consultas.' });
    }

    const { animal, service, date, notes } = req.body || {};
    const cleanAnimal = animal !== undefined ? String(animal).trim() : existing.animal;
    const cleanService = service !== undefined ? String(service).trim() : existing.service;
    const cleanDate = date !== undefined ? String(date).trim() : existing.date;

    if (!cleanAnimal || !cleanService || !cleanDate) {
      return res.status(400).json({ error: 'Pet, serviço e data/horário são obrigatórios.' });
    }

    const all = await store.list('appointments');
    const slot = evaluateSlot(cleanDate, all, existing.id);
    if (!slot.valid) {
      const code = slot.status === 'occupied' ? 409 : 400;
      return res.status(code).json({ error: slot.message, slot });
    }

    const updated = await store.update('appointments', existing.id, {
      animal: cleanAnimal,
      service: cleanService,
      date: cleanDate,
      status: req.user.role === 'tutor' ? 'Pendente' : existing.status,
      notes: notes !== undefined ? String(notes).trim() : existing.notes
    });

    return res.json({
      appointment: toAppointmentDto(updated),
      message: 'Consulta reagendada com sucesso!'
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/appointments/:id/status — alternar/definir status (apenas Coordenação/Admin)
router.patch('/:id/status', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await store.getById('appointments', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Consulta não encontrada.' });
    }

    const requestedStatus = req.body && req.body.status;
    const nextStatus =
      requestedStatus && ALLOWED_STATUS.includes(requestedStatus)
        ? requestedStatus
        : existing.status === 'Confirmado'
        ? 'Pendente'
        : 'Confirmado';

    const updated = await store.update('appointments', existing.id, {
      status: nextStatus
    });

    return res.json({
      appointment: toAppointmentDto(updated),
      message: `Status alterado para ${nextStatus}.`
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/appointments/:id — cancelar/excluir consulta
router.delete('/:id', requireAuth, requireRole('tutor', 'admin'), async (req, res, next) => {
  try {
    const existing = await store.getById('appointments', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Consulta não encontrada.' });
    }

    const isOwner =
      (existing.owner_email && existing.owner_email.toLowerCase() === req.user.email.toLowerCase()) ||
      existing.owner.toLowerCase() === req.user.name.toLowerCase();

    if (req.user.role === 'tutor' && !isOwner) {
      return res.status(403).json({ error: 'Você só pode cancelar as suas próprias consultas.' });
    }

    await store.remove('appointments', existing.id);
    return res.json({ message: 'Consulta cancelada com sucesso.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
