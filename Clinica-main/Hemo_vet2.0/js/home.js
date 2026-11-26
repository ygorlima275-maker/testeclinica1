/* Módulo da home: números reais do servidor, rede de clínicas e abas de perfil. */

function renderHomeStats() {
    const set = (key, total) => {
        const box = document.getElementById(`stat-${key}`);
        const num = document.querySelector(`[data-stat="${key}"]`);
        if (!box || !num) return;
        num.innerText = total;
        box.classList.toggle('hidden', total === 0);
    };
    set('animals', homeStats.animals || animalsData.length);
    set('clinics', homeStats.clinics || clinicsData.length);
    set('appointments', homeStats.appointments || appointmentsData.length);

    const partners = document.getElementById('home-partners');
    if (!partners) return;
    const names = (homeStats.partnerNames && homeStats.partnerNames.length > 0)
        ? homeStats.partnerNames
        : clinicsData.map(c => c.name);

    if (names.length === 0) {
        partners.innerHTML = `<div class="partners__fallback"><img src="assets/logo-clinica.png" alt=""><span>UNINASSAU · Medicina Veterinária CG</span></div>`;
        return;
    }
    partners.innerHTML = names.map(name => `<span class="chip">${escapeHtml(name)}</span>`).join('');
}

function selectProfileTab(role) {
    ['tutor', 'clinic', 'admin'].forEach(r => {
        const tab = document.getElementById(`ptab-${r}`);
        const panel = document.getElementById(`ppanel-${r}`);
        if (tab) tab.setAttribute('aria-selected', r === role ? 'true' : 'false');
        if (panel) panel.classList.toggle('hidden', r !== role);
    });
}
