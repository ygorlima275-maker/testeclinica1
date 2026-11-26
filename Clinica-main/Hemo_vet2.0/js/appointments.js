/* Módulo de consultas: disponibilidade, conflito de horário, agenda e status via API + Supabase. */

function checkAppointmentConflict(dateVal, currentId = null) {
    if (!dateVal) return false;
    return appointmentsData.some(appt => {
        if (currentId && Number(appt.id) === Number(currentId)) return false;
        if (appt.status === 'Cancelado') return false;
        return appt.date === dateVal;
    });
}

async function checkAvailabilityNotice() {
    const inputVal = document.getElementById('appt-date').value;
    const currentApptId = document.getElementById('appt-id').value;
    const noticeEl = document.getElementById('availability-notice');
    if (!inputVal) {
        noticeEl.classList.add('hidden');
        return;
    }

    const renderNotice = (status) => {
        noticeEl.classList.remove('hidden');
        if (status === 'occupied') {
            noticeEl.className = 'notice notice--bad';
            noticeEl.innerHTML = `${icon('triangle-alert')}<div><strong>Data e Horário Ocupados!</strong> Já existe uma consulta cadastrada neste exato horário. Escolha outro momento.</div>`;
        } else if (status === 'weekend') {
            noticeEl.className = 'notice notice--bad';
            noticeEl.innerHTML = `${icon('calendar-x')}<div><strong>Dia Indisponível:</strong> O atendimento na Clínica Escola funciona exclusivamente de Segunda a Sexta. Por favor, selecione outro dia.</div>`;
        } else if (status === 'after_hours') {
            noticeEl.className = 'notice notice--warn';
            noticeEl.innerHTML = `${icon('clock')}<div><strong>Horário Fora de Expediente:</strong> Atendimentos ocorrem entre 08:00 e 17:00. O horário escolhido poderá requerer confirmação especial.</div>`;
        } else {
            noticeEl.className = 'notice notice--ok';
            noticeEl.innerHTML = `${icon('circle-check')}<div><strong>Horário Livre e Disponível:</strong> Data e horário disponíveis para agendamento!</div>`;
        }
    };

    try {
        if (authToken) {
            const result = await API.checkAvailability(inputVal, currentApptId);
            renderNotice(result.status);
            return;
        }
    } catch {
        // Fallback local imediato se offline
    }

    const selectedDate = new Date(inputVal);
    const dayOfWeek = selectedDate.getDay();
    const hours = selectedDate.getHours();

    if (checkAppointmentConflict(inputVal, currentApptId)) {
        renderNotice('occupied');
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        renderNotice('weekend');
    } else if (hours < 8 || hours >= 17) {
        renderNotice('after_hours');
    } else {
        renderNotice('available');
    }
}

function renderAppointments() {
    const tbody = document.getElementById('appointments-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let listToRender = appointmentsData;
    if (currentUser && currentUser.role === 'tutor') {
        listToRender = appointmentsData.filter(a =>
            (a.ownerEmail && currentUser.email && a.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
            a.owner.toLowerCase() === currentUser.name.toLowerCase()
        );
    }

    if (listToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="cell-empty">Nenhuma consulta agendada para o seu perfil.</td></tr>`;
        return;
    }

    listToRender.forEach(appt => {
        const isAdmin = currentUser && currentUser.role === 'admin';
        const isOwnerTutor = currentUser && currentUser.role === 'tutor' && (
            (appt.ownerEmail && currentUser.email && appt.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
            appt.owner.toLowerCase() === currentUser.name.toLowerCase()
        );
        const badgeClass =
            appt.status === 'Confirmado'
                ? 'badge--ok'
                : appt.status === 'Cancelado'
                ? 'badge--bad'
                : 'badge--warn';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cell-strong" data-label="Animal">${escapeHtml(appt.animal)}</td>
            <td data-label="Tutor">${escapeHtml(appt.owner)}</td>
            <td data-label="Serviço / Motivo">${escapeHtml(appt.service)}</td>
            <td data-label="Data e Hora">${escapeHtml((appt.date || '').replace('T', ' '))}</td>
            <td data-label="Status">
                <span class="badge ${badgeClass}">${escapeHtml(appt.status)}</span>
            </td>
            <td data-label="Ações">
                <div class="table-actions">
                ${isAdmin ? `
                    <button onclick="toggleApptStatus(${Number(appt.id)})">Alternar Status</button>
                    <button onclick="deleteAppt(${Number(appt.id)})" class="is-danger">Cancelar</button>
                ` : isOwnerTutor ? `
                    <button onclick="openAppointmentModal(${Number(appt.id)})">Reagendar</button>
                    <button onclick="deleteAppt(${Number(appt.id)})" class="is-danger">Cancelar</button>
                ` : `<span class="muted">Agendado</span>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function onAppointmentAnimalChange() {
    if (!currentUser || currentUser.role !== 'admin') return;
    const select = document.getElementById('appt-animal-select');
    const opt = select.options[select.selectedIndex];
    if (opt && opt.dataset.owner) {
        document.getElementById('appt-owner').value = opt.dataset.owner;
    }
}

function openAppointmentModal(apptId = null) {
    if (!currentUser || (currentUser.role !== 'tutor' && currentUser.role !== 'admin')) {
        openModal('login-select-modal');
        showToast('Você precisa estar logado como Tutor ou Coordenação para agendar consultas.');
        return;
    }

    const selectWrap = document.getElementById('appt-select-wrap');
    const select = document.getElementById('appt-animal-select');
    const manualWrap = document.getElementById('appt-manual-wrap');
    const manualInput = document.getElementById('appt-animal-manual');
    const ownerInput = document.getElementById('appt-owner');

    select.innerHTML = '';
    manualInput.value = '';

    const availablePets = currentUser.role === 'admin'
        ? animalsData
        : animalsData.filter(a =>
            (a.ownerEmail && currentUser.email && a.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
            a.owner.toLowerCase() === currentUser.name.toLowerCase()
        );

    if (availablePets.length === 0 && currentUser.role === 'tutor') {
        showToast('Você ainda não tem nenhum pet cadastrado. Cadastre um pet primeiro!');
        switchTab('tutor-area');
        return;
    }

    const useSelect = availablePets.length > 0;
    selectWrap.classList.toggle('hidden', !useSelect);
    manualWrap.classList.toggle('hidden', useSelect);
    select.required = useSelect;
    manualInput.required = !useSelect;

    if (useSelect) {
        availablePets.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.name;
            opt.dataset.animalId = String(a.id);
            opt.dataset.owner = a.owner || '';
            opt.innerText = `${a.name} (Espécie: ${a.species} - Sangue: ${a.blood || 'N/I'})`;
            select.appendChild(opt);
        });
    }

    if (currentUser.role === 'admin') {
        ownerInput.removeAttribute('readonly');
        ownerInput.value = useSelect && availablePets[0] ? availablePets[0].owner : '';
    } else {
        ownerInput.setAttribute('readonly', true);
        ownerInput.value = currentUser.name;
    }

    document.getElementById('appt-id').value = '';
    document.getElementById('appt-service').value = '';
    document.getElementById('appt-date').value = '';
    document.getElementById('availability-notice').classList.add('hidden');

    if (apptId) {
        const appt = appointmentsData.find(a => Number(a.id) === Number(apptId));
        if (appt) {
            document.getElementById('appt-id').value = appt.id;
            if (useSelect && Array.from(select.options).some(o => o.value === appt.animal)) {
                select.value = appt.animal;
            } else {
                selectWrap.classList.add('hidden');
                manualWrap.classList.remove('hidden');
                select.required = false;
                manualInput.required = true;
                manualInput.value = appt.animal;
            }
            ownerInput.value = appt.owner;
            document.getElementById('appt-service').value = appt.service;
            document.getElementById('appt-date').value = appt.date;
            checkAvailabilityNotice();
        }
    }

    openModal('appointment-modal');
}

async function saveAppointment(e) {
    e.preventDefault();
    if (!currentUser || (currentUser.role !== 'tutor' && currentUser.role !== 'admin')) {
        showToast('Acesso negado.');
        return;
    }

    const id = document.getElementById('appt-id').value;
    const selectWrap = document.getElementById('appt-select-wrap');
    const select = document.getElementById('appt-animal-select');
    const usingSelect = !selectWrap.classList.contains('hidden');
    const selectedOpt = usingSelect ? select.options[select.selectedIndex] : null;
    const animalName = usingSelect
        ? select.value
        : document.getElementById('appt-animal-manual').value.trim();
    const animalId = selectedOpt && selectedOpt.dataset.animalId ? Number(selectedOpt.dataset.animalId) : null;
    const ownerVal = document.getElementById('appt-owner').value.trim();
    const serviceVal = document.getElementById('appt-service').value.trim();
    const dateVal = document.getElementById('appt-date').value;

    const selectedDate = new Date(dateVal);
    if (selectedDate.getDay() === 0 || selectedDate.getDay() === 6) {
        showToast('Não há atendimentos aos finais de semana. Escolha um dia útil!');
        return;
    }

    try {
        if (id) {
            const res = await API.updateAppointment(id, {
                animal: animalName,
                service: serviceVal,
                date: dateVal
            });
            showToast(res.message || 'Consulta reagendada com sucesso!');
        } else {
            const res = await API.createAppointment({
                animalId,
                animal: animalName,
                owner: ownerVal,
                service: serviceVal,
                date: dateVal
            });
            showToast(res.message || 'Consulta agendada com sucesso!');
        }

        closeModal('appointment-modal');
        await syncAllDataFromServer();
    } catch (err) {
        showToast(err.message || 'Erro ao agendar consulta.');
    }
}

async function toggleApptStatus(id) {
    try {
        const res = await API.toggleAppointmentStatus(id);
        showToast(res.message || 'Status da consulta atualizado.');
        await syncAllDataFromServer();
    } catch (err) {
        showToast(err.message || 'Erro ao atualizar status da consulta.');
    }
}

async function deleteAppt(id) {
    try {
        const res = await API.deleteAppointment(id);
        showToast(res.message || 'Consulta cancelada com sucesso.');
        await syncAllDataFromServer();
    } catch (err) {
        showToast(err.message || 'Erro ao cancelar consulta.');
    }
}