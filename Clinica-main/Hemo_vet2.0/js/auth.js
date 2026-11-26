/* Autenticação: login, cadastro via API + Supabase, logout e UI por perfil. */

const INSTITUTIONAL_DOMAIN = '@sempreuninassau.com.br';

function isInstitutionalEmail(email) {
    return typeof email === 'string' && email.trim().toLowerCase().endsWith(INSTITUTIONAL_DOMAIN);
}

function openLoginModalForRole(role) {
    document.getElementById('login-target-role').value = role;
    const titleEl = document.getElementById('login-modal-title');
    const emailInput = document.getElementById('login-email');
    if (role === 'tutor') {
        titleEl.innerText = 'Entrar como Tutor';
        emailInput.placeholder = 'seu.email@exemplo.com';
    }
    if (role === 'admin') {
        titleEl.innerText = 'Entrar como Coordenação / Médico Veterinário';
        emailInput.placeholder = 'medico@sempreuninassau.com.br';
    }
    if (role === 'clinic') {
        titleEl.innerText = 'Entrar como Clínica Parceira';
        emailInput.placeholder = 'contato@clinica.com';
    }
    openModal('login-modal');
}

async function handleLogin(e) {
    e.preventDefault();
    const role = document.getElementById('login-target-role').value;
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (role === 'admin' && !isInstitutionalEmail(email)) {
        showToast('Para acessar como Coordenação / Médico Veterinário, utilize um e-mail institucional @sempreuninassau.com.br.');
        return;
    }

    try {
        const res = await API.login({ email, password, role });
        authToken = res.token;
        currentUser = res.user;

        updateAuthUI();
        closeModal('login-modal');
        document.getElementById('login-password').value = '';
        await syncAllDataFromServer();

        if (currentUser.role === 'tutor') {
            showToast('Login realizado como Tutor!');
            switchTab('tutor-area');
        } else if (currentUser.role === 'clinic') {
            showToast(`Bem-vindo(a), ${currentUser.name}!`);
            switchTab('animals');
        } else {
            showToast('Login realizado com sucesso!');
            switchTab('animals');
        }
    } catch (err) {
        showToast(err.message || 'Falha no login.');
    }
}

async function handleSignup(e, roleType) {
    e.preventDefault();

    try {
        if (roleType === 'tutor') {
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;

            if (password !== confirmPassword) {
                showToast('As senhas não coincidem!');
                return;
            }

            const res = await API.signup({ name, email, password, role: 'tutor' });
            authToken = res.token;
            currentUser = res.user;

            updateAuthUI();
            closeModal('signup-modal');
            document.getElementById('signup-form').reset();
            await syncAllDataFromServer();
            showToast('Conta de tutor criada com sucesso!');
            switchTab('tutor-area');
        } else if (roleType === 'admin') {
            const name = document.getElementById('admin-signup-name').value.trim();
            const email = document.getElementById('admin-signup-email').value.trim();
            const password = document.getElementById('admin-signup-password').value;

            if (!isInstitutionalEmail(email)) {
                showToast('O cadastro institucional exige um e-mail @sempreuninassau.com.br.');
                return;
            }

            const res = await API.signup({ name, email, password, role: 'admin' });
            authToken = res.token;
            currentUser = res.user;

            updateAuthUI();
            closeModal('admin-signup-modal');
            document.getElementById('admin-signup-form').reset();
            await syncAllDataFromServer();
            showToast('Cadastro institucional realizado com sucesso!');
            switchTab('animals');
        } else if (roleType === 'clinic') {
            const name = document.getElementById('cs-name').value.trim();
            const cnpj = document.getElementById('cs-cnpj').value.trim();
            const crmv = document.getElementById('cs-crmv').value.trim();
            const email = document.getElementById('cs-email').value.trim();
            const phone = document.getElementById('cs-phone').value.trim();
            const address = document.getElementById('cs-address').value.trim();
            const password = document.getElementById('cs-password').value;

            if (currentUser && currentUser.role === 'admin') {
                const res = await API.createClinic({ name, cnpj, crmv, email, phone, address });
                closeModal('clinic-signup-modal');
                document.getElementById('clinic-signup-form').reset();
                await syncAllDataFromServer();
                showToast(res.message || 'Clínica parceira cadastrada com sucesso!');
                renderClinics();
            } else {
                const res = await API.signup({
                    name,
                    email,
                    password,
                    role: 'clinic',
                    cnpj,
                    crmv,
                    phone,
                    address
                });
                authToken = res.token;
                currentUser = res.user;
                updateAuthUI();
                closeModal('clinic-signup-modal');
                document.getElementById('clinic-signup-form').reset();
                await syncAllDataFromServer();
                showToast('Clínica cadastrada e logada com sucesso!');
                switchTab('animals');
            }
        }
    } catch (err) {
        showToast(err.message || 'Erro ao concluir cadastro.');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    animalsData = [];
    collectionsData = [];
    appointmentsData = [];
    clinicsData = [];
    clinicContacts = [];

    updateAuthUI();
    showToast('Sessão encerrada.');
    switchTab('home');
    renderAnimals();
    renderCollections();
    renderClinics();
    syncAllDataFromServer();
}

function updateAuthUI() {
    const authArea = document.getElementById('auth-nav-area');
    const tutorNotice = document.getElementById('tutor-notice-banner');
    const tutorRestrictedBanner = document.getElementById('tutor-restricted-banner');
    const clinicFiltersPanel = document.getElementById('clinic-filters-panel');
    const clinicPortalBox = document.getElementById('clinic-portal-box');
    const btnRegisterClinic = document.getElementById('btn-register-clinic');
    const btnAdminAddAnimal = document.getElementById('btn-admin-add-animal');
    const btnOpenAppointment = document.getElementById('btn-open-appointment');
    const navTutorBtn = document.getElementById('nav-tutor-area');
    const mobileTutorBtn = document.getElementById('mobile-nav-tutor');

    const navAnimals = document.getElementById('nav-animals');
    const mobileNavAnimals = document.getElementById('mobile-nav-animals');
    const navAppointments = document.getElementById('nav-appointments');
    const mobileNavAppointments = document.getElementById('mobile-nav-appointments');
    const navCollections = document.getElementById('nav-collections');
    const mobileNavCollections = document.getElementById('mobile-nav-collections');
    const navClinics = document.getElementById('nav-clinics');
    const mobileNavClinics = document.getElementById('mobile-nav-clinics');
    const footerNavClinics = document.getElementById('footer-nav-clinics');

    if (currentUser) {
        let badge = 'Tutor';
        if (currentUser.role === 'admin') badge = 'Coordenação / Admin';
        if (currentUser.role === 'clinic') badge = 'Clínica Parceira';

        authArea.innerHTML = `
            <div class="user-chip">
                <span class="user-chip__name">${escapeHtml(currentUser.name)}</span>
                <span class="user-chip__role">${escapeHtml(badge)}</span>
            </div>
            <button onclick="logout()" class="btn btn--outline btn--sm">Sair</button>
        `;

        if (btnRegisterClinic) {
            btnRegisterClinic.classList.toggle('hidden', currentUser.role !== 'admin');
        }
        if (btnAdminAddAnimal) {
            btnAdminAddAnimal.classList.toggle('hidden', currentUser.role !== 'admin');
        }
        if (btnOpenAppointment) {
            btnOpenAppointment.classList.toggle('hidden', currentUser.role !== 'tutor');
        }

        const canSeeClinics = currentUser.role === 'admin' || currentUser.role === 'clinic';
        if (navClinics) navClinics.classList.toggle('hidden', !canSeeClinics);
        if (mobileNavClinics) mobileNavClinics.classList.toggle('hidden', !canSeeClinics);
        if (footerNavClinics) footerNavClinics.classList.toggle('hidden', !canSeeClinics);

        const canSeeCollections = currentUser.role === 'admin' || currentUser.role === 'clinic';
        if (navCollections) navCollections.classList.toggle('hidden', !canSeeCollections);
        if (mobileNavCollections) mobileNavCollections.classList.toggle('hidden', !canSeeCollections);

        if (currentUser.role === 'tutor') {
            if (navTutorBtn) navTutorBtn.classList.remove('hidden');
            if (mobileTutorBtn) mobileTutorBtn.classList.remove('hidden');
            if (navAnimals) navAnimals.classList.add('hidden');
            if (mobileNavAnimals) mobileNavAnimals.classList.add('hidden');
            if (navAppointments) navAppointments.classList.remove('hidden');
            if (mobileNavAppointments) mobileNavAppointments.classList.remove('hidden');

            if (tutorRestrictedBanner) tutorRestrictedBanner.classList.remove('hidden');
            if (tutorNotice) tutorNotice.classList.add('hidden');
            if (clinicFiltersPanel) clinicFiltersPanel.classList.add('hidden');
        } else if (currentUser.role === 'clinic') {
            if (navTutorBtn) navTutorBtn.classList.add('hidden');
            if (mobileTutorBtn) mobileTutorBtn.classList.add('hidden');
            if (navAnimals) navAnimals.classList.remove('hidden');
            if (mobileNavAnimals) mobileNavAnimals.classList.remove('hidden');
            if (navAppointments) navAppointments.classList.add('hidden');
            if (mobileNavAppointments) mobileNavAppointments.classList.add('hidden');

            if (tutorRestrictedBanner) tutorRestrictedBanner.classList.add('hidden');
            if (tutorNotice) tutorNotice.classList.add('hidden');
            if (clinicFiltersPanel) clinicFiltersPanel.classList.remove('hidden');
        } else {
            if (navTutorBtn) navTutorBtn.classList.add('hidden');
            if (mobileTutorBtn) mobileTutorBtn.classList.add('hidden');
            if (navAnimals) navAnimals.classList.remove('hidden');
            if (mobileNavAnimals) mobileNavAnimals.classList.remove('hidden');
            if (navAppointments) navAppointments.classList.remove('hidden');
            if (mobileNavAppointments) mobileNavAppointments.classList.remove('hidden');

            if (tutorRestrictedBanner) tutorRestrictedBanner.classList.add('hidden');
            if (tutorNotice) tutorNotice.classList.add('hidden');
            if (clinicFiltersPanel) clinicFiltersPanel.classList.add('hidden');
        }

        if (clinicPortalBox) {
            if (currentUser.role === 'clinic') {
                clinicPortalBox.classList.remove('hidden');
                document.getElementById('logged-clinic-name').innerText = currentUser.name;
                renderClinicContactsList();
            } else {
                clinicPortalBox.classList.add('hidden');
            }
        }
    } else {
        authArea.innerHTML = `
            <button onclick="openModal('login-select-modal')" class="btn btn--ghost btn--sm">Entrar</button>
            <button onclick="openModal('signup-select-modal')" class="btn btn--dark btn--sm auth-signup">Cadastrar</button>
        `;

        if (btnRegisterClinic) btnRegisterClinic.classList.add('hidden');
        if (btnAdminAddAnimal) btnAdminAddAnimal.classList.add('hidden');
        if (btnOpenAppointment) btnOpenAppointment.classList.add('hidden');
        if (navTutorBtn) navTutorBtn.classList.add('hidden');
        if (mobileTutorBtn) mobileTutorBtn.classList.add('hidden');
        if (navAnimals) navAnimals.classList.add('hidden');
        if (mobileNavAnimals) mobileNavAnimals.classList.add('hidden');
        if (navAppointments) navAppointments.classList.add('hidden');
        if (mobileNavAppointments) mobileNavAppointments.classList.add('hidden');
        if (navCollections) navCollections.classList.add('hidden');
        if (mobileNavCollections) mobileNavCollections.classList.add('hidden');
        if (navClinics) navClinics.classList.add('hidden');
        if (mobileNavClinics) mobileNavClinics.classList.add('hidden');
        if (footerNavClinics) footerNavClinics.classList.add('hidden');

        if (tutorNotice) tutorNotice.classList.remove('hidden');
        if (tutorRestrictedBanner) tutorRestrictedBanner.classList.add('hidden');
        if (clinicFiltersPanel) clinicFiltersPanel.classList.add('hidden');
        if (clinicPortalBox) clinicPortalBox.classList.add('hidden');
    }
    renderAppointments();
    renderCollections();
    renderClinics();
}