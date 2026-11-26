/* Inicialização. Carregar por último. */
window.onload = async function() {
    updateAuthUI();
    await syncAllDataFromServer();
};

// Esc fecha qualquer modal aberto.
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => closeModal(m.id));
});
