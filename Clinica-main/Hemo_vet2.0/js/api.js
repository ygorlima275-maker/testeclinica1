/* Cliente HTTP centralizado para comunicação Front-end <-> Express API <-> Supabase */

async function apiRequest(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`/api${path}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data.error || `Erro na requisição (${response.status})`;
        const err = new Error(message);
        err.status = response.status;
        err.payload = data;
        throw err;
    }

    return data;
}

const API = {
    getStats: () => apiRequest('/stats'),
    getHealth: () => apiRequest('/health'),

    signup: (payload) => apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    me: () => apiRequest('/auth/me'),

    getAnimals: () => apiRequest('/animals'),
    createAnimal: (payload) => apiRequest('/animals', { method: 'POST', body: JSON.stringify(payload) }),
    updateAnimal: (id, payload) => apiRequest(`/animals/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteAnimal: (id) => apiRequest(`/animals/${id}`, { method: 'DELETE' }),

    // Módulo Coletas
    getCollections: (query = '') => apiRequest(`/collections${query ? `?${query}` : ''}`),
    createCollection: (payload) => apiRequest('/collections', { method: 'POST', body: JSON.stringify(payload) }),
    updateCollection: (id, payload) => apiRequest(`/collections/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteCollection: (id) => apiRequest(`/collections/${id}`, { method: 'DELETE' }),

    // Módulo Consultas
    getAppointments: () => apiRequest('/appointments'),
    checkAvailability: (date, excludeId = '') => {
        const params = new URLSearchParams({ date: date || '' });
        if (excludeId) params.set('excludeId', String(excludeId));
        return apiRequest(`/appointments/availability?${params.toString()}`);
    },
    createAppointment: (payload) => apiRequest('/appointments', { method: 'POST', body: JSON.stringify(payload) }),
    updateAppointment: (id, payload) => apiRequest(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    toggleAppointmentStatus: (id, status) => apiRequest(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    deleteAppointment: (id) => apiRequest(`/appointments/${id}`, { method: 'DELETE' }),

    getClinics: () => apiRequest('/clinics'),
    createClinic: (payload) => apiRequest('/clinics', { method: 'POST', body: JSON.stringify(payload) }),
    deleteClinic: (id) => apiRequest(`/clinics/${id}`, { method: 'DELETE' }),

    getClinicContacts: () => apiRequest('/clinic-contacts'),
    createClinicContact: (payload) => apiRequest('/clinic-contacts', { method: 'POST', body: JSON.stringify(payload) })
};

async function syncAllDataFromServer() {
    try {
        homeStats = await API.getStats();
    } catch (err) {
        console.warn('Falha ao carregar estatísticas:', err.message);
    }

    if (!currentUser || !authToken) {
        animalsData = [];
        collectionsData = [];
        appointmentsData = [];
        clinicsData = [];
        clinicContacts = [];
        renderHomeStats();
        return;
    }

    const tasks = [];

    tasks.push(
        API.getAnimals()
            .then((res) => { animalsData = res.animals || []; })
            .catch(() => { animalsData = []; })
    );

    tasks.push(
        API.getCollections()
            .then((res) => { collectionsData = res.collections || []; })
            .catch(() => { collectionsData = []; })
    );

    if (currentUser.role === 'tutor' || currentUser.role === 'admin') {
        tasks.push(
            API.getAppointments()
                .then((res) => { appointmentsData = res.appointments || []; })
                .catch(() => { appointmentsData = []; })
        );
    } else {
        appointmentsData = [];
    }

    if (currentUser.role === 'admin' || currentUser.role === 'clinic') {
        tasks.push(
            API.getClinics()
                .then((res) => { clinicsData = res.clinics || []; })
                .catch(() => { clinicsData = []; })
        );
        tasks.push(
            API.getClinicContacts()
                .then((res) => { clinicContacts = res.contacts || []; })
                .catch(() => { clinicContacts = []; })
        );
    } else {
        clinicsData = [];
        clinicContacts = [];
    }

    await Promise.all(tasks);

    renderAnimals();
    renderCollections();
    renderAppointments();
    renderClinics();
    renderClinicContactsList();
    renderHomeStats();
    if (currentUser.role === 'tutor') {
        renderTutorArea();
    }
}
