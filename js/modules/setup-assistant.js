import { supabase } from '../config/supabase.js';
import { UI } from './ui.js';

const steps = [
  { table: 'properties', label: 'Cadastre sua propriedade', help: 'Informe o nome e a área do sítio ou fazenda.', target: 'propriedades' },
  { table: 'crops', label: 'Cadastre uma cultura', help: 'Adicione o que você cultiva.', target: 'lotes-safras' },
  { table: 'fields', label: 'Cadastre um talhão', help: 'Associe uma área à sua propriedade.', target: 'lotes-safras' },
  { table: 'harvests', label: 'Registre sua primeira safra', help: 'Associe a safra ao talhão e à cultura.', target: 'lotes-safras' }
];

export const SetupAssistant = {
  userId: null, generation: 0, initialized: false,
  init() {
    if (this.initialized) return;
    this.initialized = true;
    document.getElementById('setupRefresh')?.addEventListener('click', () => this.refresh());
    document.getElementById('setupDismiss')?.addEventListener('click', () => this.hide());
    document.getElementById('reopenSetupBtn')?.addEventListener('click', () => { this.show(); UI.switchTab('visao-geral'); this.refresh(); });
    document.getElementById('setupSteps')?.addEventListener('click', event => {
      const button = event.target.closest('button[data-step]');
      if (button) UI.switchTab(steps[Number(button.dataset.step)].target);
    });
    window.addEventListener('agrovia:dataChanged', () => this.refresh());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(); });
  },
  key() { return `agrovia-setup-hidden:${this.userId}`; },
  onLogin(user) {
    this.userId = user?.id || null;
    if (!this.userId) return;
    let hidden = false;
    try { hidden = localStorage.getItem(this.key()) === 'yes'; } catch { /* armazenamento indisponível */ }
    document.getElementById('setupAssistant')?.classList.toggle('hidden', hidden);
    this.refresh();
  },
  hide() {
    document.getElementById('setupAssistant')?.classList.add('hidden');
    try { localStorage.setItem(this.key(), 'yes'); } catch { /* armazenamento indisponível */ }
  },
  show() {
    document.getElementById('setupAssistant')?.classList.remove('hidden');
    try { localStorage.removeItem(this.key()); } catch { /* armazenamento indisponível */ }
  },
  async refresh() {
    if (!this.userId) return;
    const user = this.userId, generation = ++this.generation;
    const status = document.getElementById('setupStatus');
    if (status) status.textContent = 'Verificando cadastros...';
    const results = await Promise.all(steps.map(step => supabase.from(step.table).select('id', { count: 'exact', head: true }).eq('user_id', user)));
    if (generation !== this.generation || this.userId !== user) return;
    const failures = results.filter(result => result.error);
    if (failures.length) {
      if (status) status.textContent = 'Não foi possível consultar o progresso. Tente atualizar.';
      console.warn('Erro ao consultar progresso do Agrovia:', failures.map(result => result.error));
      return;
    }
    const done = results.map(result => (result.count || 0) > 0);
    const total = done.filter(Boolean).length;
    if (status) status.textContent = total === steps.length ? 'Tudo pronto! Seus quatro cadastros iniciais foram encontrados.' : `${total} de ${steps.length} cadastros concluídos`;
    const progress = document.getElementById('setupProgress');
    if (progress) progress.style.width = `${total / steps.length * 100}%`;
    const root = document.getElementById('setupSteps');
    if (!root) return;
    root.replaceChildren();
    steps.forEach((step, i) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3';
      const label = document.createElement('div');
      const heading = document.createElement('p');
      heading.className = `text-sm font-semibold ${done[i] ? 'text-emerald-300' : 'text-white'}`;
      heading.textContent = `${done[i] ? '✓' : '○'} ${step.label}`;
      const help = document.createElement('p');
      help.className = 'text-xs text-slate-400 mt-1';
      help.textContent = done[i] ? 'Cadastro encontrado no sistema' : step.help;
      label.append(heading, help);
      row.append(label);
      if (!done[i]) {
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.step = String(i);
        button.className = 'shrink-0 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 focus:ring-2 focus:ring-emerald-400';
        button.textContent = 'Ir para cadastro';
        row.append(button);
      }
      root.append(row);
    });
  }
};
