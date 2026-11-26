const express = require('express');
const store = require('../services/store');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function toAnimalDto(row) {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    blood: row.blood || '',
    age: row.age,
    lastCollectionDate: row.last_collection_date || '',
    donatedAmount: row.donated_amount || '',
    owner: row.owner,
    ownerEmail: row.owner_email || null,
    photo: row.photo || '',
    notes: row.notes || '',
    anamnesisPdf: row.anamnesis_pdf || ''
  };
}

// GET /api/animals
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await store.list('animals', { orderBy: 'id', ascending: true });
    let items = rows.map(toAnimalDto);

    if (req.user.role === 'tutor') {
      items = items.filter(
        (a) =>
          (a.ownerEmail && a.ownerEmail.toLowerCase() === req.user.email.toLowerCase()) ||
          a.owner.toLowerCase() === req.user.name.toLowerCase()
      );
    }

    return res.json({ animals: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/animals
router.post('/', requireAuth, requireRole('tutor', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const species = String(body.species || '').trim();
    const breed = String(body.breed || '').trim();
    const blood = String(body.blood || '').trim();
    const age = String(body.age || '').trim();
    const owner = req.user.role === 'tutor' ? req.user.name : String(body.owner || '').trim();
    const anamnesisPdf = String(body.anamnesisPdf || '').trim();

    if (!name || !species || !breed || !age || !owner) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios do pet.' });
    }
    if (!anamnesisPdf) {
      return res.status(400).json({ error: 'É obrigatório anexar o PDF da Anamnese Veterinária.' });
    }

    const created = await store.insert('animals', {
      name,
      species,
      breed,
      blood: blood || null,
      age,
      last_collection_date: body.lastCollectionDate || null,
      donated_amount: body.donatedAmount || null,
      owner,
      owner_email: req.user.role === 'tutor' ? req.user.email : null,
      photo: body.photo || null,
      notes: String(body.notes || '').trim(),
      anamnesis_pdf: anamnesisPdf
    });

    return res.status(201).json({
      animal: toAnimalDto(created),
      message: 'Novo pet cadastrado com Anamnese anexada!'
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/animals/:id
router.put('/:id', requireAuth, requireRole('tutor', 'admin'), async (req, res, next) => {
  try {
    const existing = await store.getById('animals', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Animal não encontrado.' });
    }

    const isOwner =
      (existing.owner_email && existing.owner_email.toLowerCase() === req.user.email.toLowerCase()) ||
      existing.owner.toLowerCase() === req.user.name.toLowerCase();

    if (req.user.role === 'tutor' && !isOwner) {
      return res.status(403).json({ error: 'Você só pode editar seus próprios pets.' });
    }

    const body = req.body || {};
    const updated = await store.update('animals', existing.id, {
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      species: body.species !== undefined ? String(body.species).trim() : existing.species,
      breed: body.breed !== undefined ? String(body.breed).trim() : existing.breed,
      blood: body.blood !== undefined ? String(body.blood).trim() : existing.blood,
      age: body.age !== undefined ? String(body.age).trim() : existing.age,
      last_collection_date:
        body.lastCollectionDate !== undefined
          ? body.lastCollectionDate || null
          : existing.last_collection_date,
      donated_amount:
        body.donatedAmount !== undefined ? body.donatedAmount || null : existing.donated_amount,
      owner:
        req.user.role === 'admin' && body.owner !== undefined
          ? String(body.owner).trim()
          : existing.owner,
      photo: body.photo !== undefined ? body.photo : existing.photo,
      notes: body.notes !== undefined ? String(body.notes).trim() : existing.notes,
      anamnesis_pdf:
        body.anamnesisPdf !== undefined ? body.anamnesisPdf : existing.anamnesis_pdf
    });

    return res.json({
      animal: toAnimalDto(updated),
      message: 'Pet e Anamnese atualizados com sucesso!'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/animals/:id
router.delete('/:id', requireAuth, requireRole('tutor', 'admin'), async (req, res, next) => {
  try {
    const existing = await store.getById('animals', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Animal não encontrado.' });
    }

    const isOwner =
      (existing.owner_email && existing.owner_email.toLowerCase() === req.user.email.toLowerCase()) ||
      existing.owner.toLowerCase() === req.user.name.toLowerCase();

    if (req.user.role === 'tutor' && !isOwner) {
      return res.status(403).json({ error: 'Você só pode excluir seus próprios pets.' });
    }

    await store.remove('animals', existing.id);
    return res.json({ message: 'Pet removido com sucesso.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
