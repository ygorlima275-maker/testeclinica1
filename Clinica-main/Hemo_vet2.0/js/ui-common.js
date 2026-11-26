/* Utilitários de interface: sanitização XSS, ícones, menu mobile, modais e toast. */

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeUrl(url, fallback = '') {
    if (!url || typeof url !== 'string') return fallback;
    const trimmed = url.trim();
    if (
        trimmed.startsWith('assets/') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('data:image/') ||
        trimmed.startsWith('data:application/pdf')
    ) {
        return trimmed;
    }
    return fallback;
}

// Ícone do sprite SVG inline (ver index.html).
function icon(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('hidden');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function showToast(message) {
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast fade-in';
    toast.setAttribute('role', 'status');
    toast.innerHTML = `${icon('circle-check')}<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, 3500);
}
