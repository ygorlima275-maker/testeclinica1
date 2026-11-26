const express = require('express');
const store = require('../services/store');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_STATUS = ['Agendada', 'Concluída', 'Cancelada'];

function toCollectionDto(row) {
  return {
    id: row.id,
    animalId: row.animal_id || null,
    animalName: row.animal_name,
    ownerName: row.owner_name || '',
    bloodType: row.blood_type || '',
    collectionDate: row.collection_date,
    volumeMl: Number(row.volume_ml),
    responsibleVet: row.responsible_vet,
    clinicName: row.clinic_name || '',
    notes: row.notes || '',
    status: row.status || 'Concluída',
    createdAt: row.created_at || null
  };
}

async function syncAnimalSummary(animalId) {
  if (!animalId) return;
  const allCollections = await store.list('collections', { orderBy: 'collection_date', ascending: false });
  const completed = allCollections.filter(
    (c) => Number(c.animal_id) === Number(animalId) && c.status === 'Concluída'
  );

  const latestDate = completed.length > 0 ? completed[0].collection_date : null;
  const totalMl = completed.reduce((acc, item) => acc + Number(item.volume_ml || 0), 0);

  await store.update('animals', animalId, {
    last_collection_date: latestDate,
    donated_amount: totalMl > 0 ? `${totalMl} ml` : null
  });
}

// GET /api/collections — lista coletas (com filtros opcionais)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await store.list('collections', { orderBy: 'collection_date', ascending: false });
    let items = rows.map(toCollectionDto);

    if (req.user.role === 'tutor') {
      const tutorName = req.user.name.toLowerCase();
      items = items.filter((c) => (c.ownerName || '').toLowerCase() === tutorName);
    }

    const { animalId, bloodType, status, search } = req.query;
    if (animalId) {
      items = items.filter((c) => Number(c.animalId) === Number(animalId));
    }
    if (bloodType) {
      const q = String(bloodType).toLowerCase();
      items = items.filter((c) => (c.bloodType || '').toLowerCase().includes(q));
    }
    if (status) {
      items = items.filter((c) => c.status === status);
    }
    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(
        (c) =>
          (c.animalName || '').toLowerCase().includes(q) ||
          (c.responsibleVet || '').toLowerCase().includes(q) ||
          (c.bloodType || '').toLowerCase().includes(q)
      );
    }

    return res.json({ collections: items });
  } catch (err) {
    next(err);
  }
});

// GET /api/collections/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await store.getById('collections', req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Registro de coleta não encontrado.' });
    }
    const dto = toCollectionDto(row);
    if (
      req.user.role === 'tutor' &&
      (dto.ownerName || '').toLowerCase() !== req.user.name.toLowerCase()
    ) {
      return res.status(403).json({ error: 'Acesso negado a esta coleta.' });
    }
    return res.json({ collection: dto });
  } catch (err) {
    next(err);
  }
});

// POST /api/collections — registrar nova coleta
router.post('/', requireAuth, requireRole('admin', 'clinic'), async (req, res, next) => {
  try {
    const {
      animalId,
      animalName,
      collectionDate,
      volumeMl,
      responsibleVet,
      clinicName,
      notes,
      status
    } = req.body || {};

    let animal = null;
    if (animalId) {
      animal = await store.getById('animals', animalId);
    } else if (animalName) {
      const allAnimals = await store.list('animals');
      animal =
        allAnimals.find(
          (a) => a.name.toLowerCase() === String(animalName).trim().toLowerCase()
        ) || null;
    }

    const resolvedAnimalName = animal ? animal.name : String(animalName || '').trim();
    if (!resolvedAnimalName) {
      return res.status(400).json({ error: 'Selecione um animal válido para a coleta.' });
    }

    const cleanDate = String(collectionDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      return res.status(400).json({ error: 'Data da coleta inválida (formato YYYY-MM-DD).' });
    }

    const parsedVolume = Number(volumeMl);
    if (!Number.isInteger(parsedVolume) || parsedVolume <= 0 || parsedVolume > 2000) {
      return res.status(400).json({
        error: 'Volume coletado deve ser um número inteiro entre 1 ml e 2000 ml.'
      });
    }

    const cleanVet = String(responsibleVet || '').trim();
    if (!cleanVet) {
      return res.status(400).json({ error: 'Informe o médico veterinário responsável.' });
    }

    const resolvedStatus = ALLOWED_STATUS.includes(status) ? status : 'Concluída';

    const created = await store.insert('collections', {
      animal_id: animal ? animal.id : null,
      animal_name: resolvedAnimalName,
      owner_name: animal ? animal.owner : String(req.body.ownerName || '').trim(),
      blood_type: animal ? animal.blood : String(req.body.bloodType || '').trim(),
      collection_date: cleanDate,
      volume_ml: parsedVolume,
      responsible_vet: cleanVet,
      clinic_name: String(clinicName || req.user.name || '').trim(),
      notes: String(notes || '').trim(),
      status: resolvedStatus
    });

    if (animal) {
      await syncAnimalSummary(animal.id);
    }

    return res.status(201).json({
      collection: toCollectionDto(created),
      message: 'Coleta registrada com sucesso!'
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/collections/:id — atualizar coleta existente
router.put('/:id', requireAuth, requireRole('admin', 'clinic'), async (req, res, next) => {
  try {
    const existing = await store.getById('collections', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Registro de coleta não encontrado.' });
    }

    const {
      collectionDate,
      volumeMl,
      responsibleVet,
      clinicName,
      notes,
      status
    } = req.body || {};

    const cleanDate = collectionDate !== undefined ? String(collectionDate).trim() : existing.collection_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      return res.status(400).json({ error: 'Data da coleta inválida (formato YYYY-MM-DD).' });
    }

    const parsedVolume = volumeMl !== undefined ? Number(volumeMl) : Number(existing.volume_ml);
    if (!Number.isInteger(parsedVolume) || parsedVolume <= 0 || parsedVolume > 2000) {
      return res.status(400).json({
        error: 'Volume coletado deve ser um número inteiro entre 1 ml e 2000 ml.'
      });
    }

    const cleanVet = responsibleVet !== undefined ? String(responsibleVet).trim() : existing.responsible_vet;
    if (!cleanVet) {
      return res.status(400).json({ error: 'Informe o médico veterinário responsável.' });
    }

    const resolvedStatus = status !== undefined ? status : existing.status;
    if (!ALLOWED_STATUS.includes(resolvedStatus)) {
      return res.status(400).json({ error: 'Status inválido para a coleta.' });
    }

    const updated = await store.update('collections', existing.id, {
      collection_date: cleanDate,
      volume_ml: parsedVolume,
      responsible_vet: cleanVet,
      clinic_name: clinicName !== undefined ? String(clinicName).trim() : existing.clinic_name,
      notes: notes !== undefined ? String(notes).trim() : existing.notes,
      status: resolvedStatus
    });

    if (existing.animal_id) {
      await syncAnimalSummary(existing.animal_id);
    }

    return res.json({
      collection: toCollectionDto(updated),
      message: 'Coleta atualizada com sucesso!'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/collections/:id — remover registro de coleta (coordenação)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await store.getById('collections', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Registro de coleta não encontrado.' });
    }

    const removed = await store.remove('collections', existing.id);
    if (!removed) {
      return res.status(404).json({ error: 'Registro de coleta não encontrado.' });
    }

    if (existing.animal_id) {
      await syncAnimalSummary(existing.animal_id);
    }

    return res.json({ message: 'Registro de coleta removido com sucesso.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
