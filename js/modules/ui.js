export const UI = {
    showToast(message, type = 'info') {
        const existingToasts = document.querySelectorAll('.agrovia-toast');
        if (existingToasts.length > 2) existingToasts[0].remove();

        const toast = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-rose-500' : (type === 'success' ? 'bg-emerald-600' : 'bg-slate-700');
        const icon = type === 'error' ? 'fa-circle-exclamation' : (type === 'success' ? 'fa-circle-check' : 'fa-circle-info');
        
        toast.className = `agrovia-toast fixed bottom-4 right-4 ${bgColor} text-white px-5 py-3 rounded-xl shadow-lg z-[9999] transform transition-all duration-300 translate-y-10 opacity-0 flex items-center gap-3`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.innerHTML = `<i class="fa-solid ${icon} text-lg" aria-hidden="true"></i> <span class="font-medium text-sm">${this.escapeHTML(message)}</span>`;
        
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    setLoading(buttonId, isLoading, originalText = '') {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        
        if (isLoading) {
            if (!btn.dataset.originalContent) btn.dataset.originalContent = btn.innerHTML;
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Processando...`;
            btn.classList.add('opacity-70', 'cursor-not-allowed');
        } else {
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.innerHTML = originalText || btn.dataset.originalContent || '';
            btn.classList.remove('opacity-70', 'cursor-not-allowed');
        }
    },
    switchTab(targetId) {
        const selected = document.getElementById(targetId);
        if (!selected || !selected.classList.contains('view-section')) return;
        const names = {
            'visao-geral': 'Visão Geral', 'propriedades': 'Propriedades',
            'lotes-safras': 'Gestão Agrícola', 'comercial': 'Gestão Comercial',
            'financeiro': 'Financeiro', 'perfil': 'Meu Perfil'
        };
        const location = document.getElementById('currentSectionLabel');
        if (location) location.textContent = names[targetId] || selected.querySelector('h3')?.textContent?.trim() || 'Agrovia';

        document.querySelectorAll('.nav-btn').forEach(b => {
            if (b.dataset.target === targetId) {
                b.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
                b.classList.remove('text-slate-400');
                b.setAttribute('aria-current', 'page');
            } else {
                b.classList.remove('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
                b.classList.add('text-slate-400');
                b.removeAttribute('aria-current');
            }
        });
        document.querySelectorAll('.view-section').forEach(sec => {
            if (sec.id === targetId) {
                sec.classList.remove('hidden');
                sec.classList.add('active');
            } else {
                sec.classList.add('hidden');
                sec.classList.remove('active');
            }
        });
        const main = document.getElementById('mainContent');
        if (main) {
            main.scrollTop = 0;
            // Move o foco somente quando o usuário já estava navegando na aplicação.
            if (document.activeElement?.closest('#mainNavigation, #sidebar, #profileCard')) {
                main.focus({ preventScroll: true });
            }
        }
    },
    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    safeTextUpdate(elementId, text) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = text;
    }
};
