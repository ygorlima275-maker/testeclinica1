/* Módulo de Coletas (Hemoterapia): listagem, registro, edição e exclusão via API + Supabase. */

function renderCollections() {
    const tbody = document.getElementById('collections-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const queryEl = document.getElementById('collection-search');
    const query = queryEl ? queryEl.value.trim().toLowerCase() : '';

    const filtered = collectionsData.filter((c) => {
        if (!query) return true;
        return (
            (c.animalName || '').toLowerCase().includes(query) ||
            (c.bloodType || '').toLowerCase().includes(query) ||
            (c.responsibleVet || '').toLowerCase().includes(query) ||
            (c.status || '').toLowerCase().includes(query)
        );
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="cell-empty">Nenhuma coleta hemoterápica registrada.</td></tr>`;
        return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';
    const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'clinic');

    filtered.forEach((col) => {
        const badgeClass =
            col.status === 'Concluída'
                ? 'badge--ok'
                : col.status === 'Agendada'
                ? 'badge--warn'
                : 'badge--bad';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cell-strong" data-label="Animal">${escapeHtml(col.animalName)}</td>
            <td data-label="Tipo Sanguíneo">${escapeHtml(col.bloodType || 'N/I')}</td>
            <td data-label="Data da Coleta">${escapeHtml(col.collectionDate)}</td>
            <td data-label="Volume">${escapeHtml(col.volumeMl)} ml</td>
            <td data-label="Veterinário">${escapeHtml(col.responsibleVet)}</td>
            <td data-label="Status"><span class="badge ${badgeClass}">${escapeHtml(col.status)}</span></td>
            <td data-label="Ações">
                <div class="table-actions">
                    ${canEdit ? `<button onclick="editCollection(${Number(col.id)})">Editar</button>` : ''}
                    ${isAdmin ? `<button onclick="deleteCollection(${Number(col.id)})" class="is-danger">Excluir</button>` : ''}
                    ${!canEdit && !isAdmin ? `<span class="muted">Registrada</span>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openCollectionModal(collectionId = null, preselectedAnimalId = null) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'clinic')) {
        openModal('login-select-modal');
        showToast('Acesso restrito à Coordenação ou Clínicas Parceiras.');
        return;
    }

    const selectWrap = document.getElementById('collection-select-wrap');
    const select = document.getElementById('collection-animal-select');
    const manualWrap = document.getElementById('collection-manual-wrap');
    const manualName = document.getElementById('collection-animal-name');
    const manualBlood = document.getElementById('collection-blood-type');

    select.innerHTML = '';
    manualName.value = '';
    manualBlood.value = '';

    const hasAnimals = animalsData.length > 0;
    selectWrap.classList.toggle('hidden', !hasAnimals);
    manualWrap.classList.toggle('hidden', hasAnimals);
    select.required = hasAnimals;
    manualName.required = !hasAnimals;

    if (hasAnimals) {
        animalsData.forEach((a) => {
            const opt = document.createElement('option');
            opt.value = String(a.id);
            opt.textContent = `${a.name} (${a.species} · Sangue: ${a.blood || 'N/I'})`;
            select.appendChild(opt);
        });
    }

    document.getElementById('collection-id').value = '';
    document.getElementById('collection-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('collection-volume').value = '450';
    document.getElementById('collection-vet').value = currentUser.name || '';
    document.getElementById('collection-status').value = 'Concluída';
    document.getElementById('collection-notes').value = '';
    document.getElementById('collection-modal-title').innerText = 'Registrar Coleta';
    select.disabled = false;

    if (preselectedAnimalId && hasAnimals) {
        select.value = String(preselectedAnimalId);
    }

    if (collectionId) {
        const item = collectionsData.find((c) => Number(c.id) === Number(collectionId));
        if (item) {
            document.getElementById('collection-id').value = String(item.id);
            if (item.animalId && hasAnimals) {
                selectWrap.classList.remove('hidden');
                manualWrap.classList.add('hidden');
                select.value = String(item.animalId);
                select.disabled = true;
            } else {
                selectWrap.classList.add('hidden');
                manualWrap.classList.remove('hidden');
                manualName.value = item.animalName || '';
                manualBlood.value = item.bloodType || '';
                manualName.readOnly = true;
            }
            document.getElementById('collection-date').value = item.collectionDate || '';
            document.getElementById('collection-volume').value = String(item.volumeMl || '');
            document.getElementById('collection-vet').value = item.responsibleVet || '';
            document.getElementById('collection-status').value = item.status || 'Concluída';
            document.getElementById('collection-notes').value = item.notes || '';
            document.getElementById('collection-modal-title').innerText = 'Editar Coleta';
        }
    } else {
        manualName.readOnly = false;
    }

    openModal('collection-modal');
}

function openCollectionModalForAnimal(animalId) {
    openCollectionModal(null, animalId);
}

function editCollection(id) {
    openCollectionModal(id);
}

async function saveCollection(e) {
    e.preventDefault();
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'clinic')) {
        showToast('Acesso negado.');
        return;
    }

    const id = document.getElementById('collection-id').value;
    const selectWrap = document.getElementById('collection-select-wrap');
    const select = document.getElementById('collection-animal-select');
    const manualName = document.getElementById('collection-animal-name').value.trim();
    const manualBlood = document.getElementById('collection-blood-type').value.trim();

    const collectionDate = document.getElementById('collection-date').value;
    const volumeMl = Number(document.getElementById('collection-volume').value);
    const responsibleVet = document.getElementById('collection-vet').value.trim();
    const status = document.getElementById('collection-status').value;
    const notes = document.getElementById('collection-notes').value.trim();

    try {
        if (id) {
            const res = await API.updateCollection(id, {
                collectionDate,
                volumeMl,
                responsibleVet,
                status,
                notes
            });
            showToast(res.message || 'Coleta atualizada com sucesso!');
        } else {
            const usingSelect = !selectWrap.classList.contains('hidden') && select.value;
            const res = await API.createCollection({
                animalId: usingSelect ? Number(select.value) : null,
                animalName: usingSelect ? undefined : manualName,
                bloodType: usingSelect ? undefined : manualBlood,
                collectionDate,
                volumeMl,
                responsibleVet,
                clinicName: currentUser.name,
                status,
                notes
            });
            showToast(res.message || 'Coleta registrada com sucesso!');
        }

        closeModal('collection-modal');
        await syncAllDataFromServer();
    } catch (err) {
        showToast(err.message || 'Erro ao salvar coleta.');
    }
}

async function deleteCollection(id) {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Apenas a Coordenação pode remover coletas.');
        return;
    }

    try {
        const res = await API.deleteCollection(id);
        showToast(res.message || 'Coleta removida com sucesso.');
        await syncAllDataFromServer();
    } catch (err) {
        showToast(err.message || 'Erro ao remover coleta.');
    }
}
