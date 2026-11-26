/* Módulo de requisição de doadores pelas clínicas via API + Supabase. */

function openClinicContactModalWithAnimal(animalName) {
    openClinicContactModal();
    const select = document.getElementById('cc-animal-select');
    if (select) select.value = animalName;
}

function openClinicContactModal() {
    if (!currentUser || currentUser.role !== 'clinic') {
        showToast('Acesso restrito a clínicas parceiras logadas.');
        return;
    }

    const select = document.getElementById('cc-animal-select');
    select.innerHTML = '';

    if (animalsData.length === 0) {
        select.innerHTML = `<option value="">Nenhum animal cadastrado no sistema</option>`;
    } else {
        animalsData.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.name;
            opt.innerText = `${a.name} (Espécie: ${a.species} - Sangue: ${a.blood || 'N/I'})`;
            select.appendChild(opt);
        });
    }

    document.getElementById('cc-subject').value = '';
    document.getElementById('cc-message').value = '';
    openModal('clinic-contact-modal');
}

async function submitClinicContact(e) {
    e.preventDefault();
    const animalAssociated = document.getElementById('cc-animal-select').value;
    const subject = document.getElementById('cc-subject').value.trim();
    const message = document.getElementById('cc-message').value.trim();

    try {
        const res = await API.createClinicContact({
            animal: animalAssociated,
            subject,
            message
        });
        closeModal('clinic-contact-modal');
        showToast(res.message || 'Requisição de doador enviada com sucesso!');
        await syncAllDataFromServer();
    } catch (err) {
        showToast(err.message || 'Erro ao enviar requisição.');
    }
}

function renderClinicContactsList() {
    const listContainer = document.getElementById('clinic-requests-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const myContacts = clinicContacts.filter(c =>
        currentUser && (c.clinicName || '').toLowerCase() === currentUser.name.toLowerCase()
    );

    if (myContacts.length === 0) {
        listContainer.innerHTML = `<p class="request-empty">Nenhuma requisição de doador enviada até o momento.</p>`;
        return;
    }

    const recentContacts = myContacts.slice(-5).reverse();

    recentContacts.forEach(item => {
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `
            <div class="request-item__top">
                <strong>${escapeHtml(item.subject)}</strong>
                <span class="request-item__status">${escapeHtml(item.status)}</span>
            </div>
            <p>${escapeHtml(item.message)}</p>
            <small>Enviado em: ${escapeHtml(item.date)}</small>
        `;
        listContainer.appendChild(div);
    });
}
