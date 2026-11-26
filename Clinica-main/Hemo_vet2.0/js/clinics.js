/* Módulo de clínicas parceiras via API + Supabase. */

function renderClinics() {
    const grid = document.getElementById('clinics-grid');
    if (!grid) return;
    grid.innerHTML = '';

    let listToRender = clinicsData;

    if (currentUser && currentUser.role === 'clinic') {
        listToRender = clinicsData.filter(c =>
            (currentUser.clinicId && Number(c.id) === Number(currentUser.clinicId)) ||
            (c.email && currentUser.email && c.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            (c.name && currentUser.name && c.name.toLowerCase() === currentUser.name.toLowerCase())
        );

        if (listToRender.length === 0) {
            listToRender = [{
                id: currentUser.clinicId || 0,
                name: currentUser.name,
                email: currentUser.email,
                status: 'Parceiro Credenciado'
            }];
        }
    }

    if (listToRender.length === 0) {
        grid.innerHTML = `<div class="empty-state"><span class="empty-state__icon">${icon('building-2')}</span><p>Nenhuma clínica parceira cadastrada no momento.</p></div>`;
        return;
    }

    listToRender.forEach(clinic => {
        const isAdmin = currentUser && currentUser.role === 'admin';

        const card = document.createElement('article');
        card.className = 'clinic-card';
        card.innerHTML = `
            <div>
                <div class="clinic-card__top">
                    <span class="chip">Campina Grande - PB</span>
                    <span class="badge badge--ok">${escapeHtml(clinic.status || 'Parceiro Credenciado')}</span>
                </div>
                <h3>${escapeHtml(clinic.name)}</h3>
                <p class="clinic-card__desc">Parceiro credenciado com requisições e transferências integradas.</p>
                <ul class="facts">
                    <li>${icon('id-card')}<span>${escapeHtml(clinic.crmv || 'CRMV-PB')} · CNPJ: ${escapeHtml(clinic.cnpj || 'Cadastrado')}</span></li>
                    <li>${icon('map-pin')}<span>${escapeHtml(clinic.address || 'Campina Grande - PB')}</span></li>
                    <li>${icon('phone')}<span>${escapeHtml(clinic.phone || '(83) 3300-0000')}</span></li>
                    <li>${icon('mail')}<span>${escapeHtml(clinic.email)}</span></li>
                </ul>
            </div>
            ${isAdmin ? `
                <div class="clinic-card__foot">
                    <button onclick="deleteClinic(${Number(clinic.id)})" class="btn btn--danger-soft btn--sm">${icon('trash-2')} Excluir Clínica Parceira</button>
                </div>
            ` : ''}
        `;
        grid.appendChild(card);
    });
}

async function deleteClinic(id) {
    try {
        const res = await API.deleteClinic(id);
        showToast(res.message || 'Clínica parceira removida com sucesso.');
        await syncAllDataFromServer();
    } catch (err) {
        showToast(err.message || 'Erro ao remover clínica parceira.');
    }
}