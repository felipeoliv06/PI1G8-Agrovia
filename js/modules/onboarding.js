import { UI } from './ui.js';

const steps = [
  { title: 'Bem-vindo ao Agrovia!', description: 'Este guia mostra as principais áreas do sistema. Você pode sair quando quiser e voltar pelo botão “Ver tutorial novamente”. Nenhum cadastro será feito automaticamente.', target: 'visao-geral', focus: '#mainNavigation' },
  { title: 'Seu painel inicial', description: 'Aqui você acompanha o resumo da operação, avisos de estoque e pedidos. As informações são atualizadas conforme você utiliza o sistema.', target: 'visao-geral', focus: '#dashboardContent' },
  { title: 'Cadastre sua propriedade', description: 'Abra Propriedades, informe o nome e a área em hectares e clique em “Salvar Propriedade”. A localização é opcional. Você pode preencher os campos agora ou depois.', target: 'propriedades', focus: '#propertyForm' },
  { title: 'Conheça a gestão agrícola', description: 'Esta área é destinada a culturas, talhões e safras. Confira os recursos disponíveis nesta versão antes de começar seus registros.', target: 'lotes-safras', focus: '#lotes-safras' },
  { title: 'Explore as outras áreas', description: 'Na Gestão Comercial você encontra produtos, estoque, clientes e pedidos. No Financeiro você acompanha receitas e despesas. Pronto! Você pode rever este guia no menu lateral.', target: 'visao-geral', focus: '#mainNavigation' }
];

export const OnboardingTour = {
  userId: null, index: 0, open: false, previousFocus: null, highlighted: null,
  init() {
    document.getElementById('restartTourBtn')?.addEventListener('click', () => this.start());
    document.getElementById('tourClose')?.addEventListener('click', () => this.finish());
    document.getElementById('tourSkip')?.addEventListener('click', () => this.finish());
    document.getElementById('tourPrev')?.addEventListener('click', () => this.move(-1));
    document.getElementById('tourNext')?.addEventListener('click', () => this.move(1));
    document.addEventListener('keydown', (event) => {
      if (!this.open) return;
      if (event.key === 'Escape') { event.preventDefault(); this.finish(); }
      if (event.key === 'Tab') {
        const dialog = document.getElementById('tourDialog');
        const controls = [...dialog.querySelectorAll('button:not([disabled])')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  },
  onLogin(user) {
    this.userId = user?.id || null;
    if (!this.userId) return;
    try { if (localStorage.getItem(`agrovia-tour-v120:${this.userId}`)) return; } catch { /* Navegador sem armazenamento */ }
    this.start();
  },
  start() {
    if (!this.userId) return;
    this.previousFocus = document.activeElement;
    this.index = 0; this.open = true;
    document.getElementById('tourBackdrop').classList.remove('hidden');
    document.getElementById('tourDialog').classList.remove('hidden');
    this.render();
    document.getElementById('tourClose')?.focus();
  },
  clearHighlight() {
    if (this.highlighted) {
      this.highlighted.classList.remove('agrovia-tour-highlight');
      this.highlighted = null;
    }
  },
  render() {
    if (!this.open) return;
    this.clearHighlight();
    const step = steps[this.index];
    UI.switchTab(step.target);
    document.getElementById('tourTitle').textContent = step.title;
    document.getElementById('tourDescription').textContent = step.description;
    document.getElementById('tourCounter').textContent = `Passo ${this.index + 1} de ${steps.length}`;
    document.getElementById('tourProgress').style.width = `${((this.index + 1) / steps.length) * 100}%`;
    document.getElementById('tourPrev').disabled = this.index === 0;
    document.getElementById('tourPrev').classList.toggle('opacity-40', this.index === 0);
    document.getElementById('tourNext').textContent = this.index === steps.length - 1 ? 'Concluir' : 'Próximo';
    const target = document.querySelector(step.focus);
    if (target && window.innerWidth >= 1024) {
      this.highlighted = target;
      target.classList.add('agrovia-tour-highlight');
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  },
  move(delta) {
    if (!this.open) return;
    if (delta > 0 && this.index === steps.length - 1) return this.finish();
    this.index = Math.max(0, Math.min(steps.length - 1, this.index + delta));
    this.render();
  },
  finish() {
    if (!this.open) return;
    this.open = false; this.clearHighlight();
    document.getElementById('tourBackdrop').classList.add('hidden');
    document.getElementById('tourDialog').classList.add('hidden');
    try { localStorage.setItem(`agrovia-tour-v120:${this.userId}`, 'seen'); } catch { /* Navegador sem armazenamento */ }
    this.previousFocus?.isConnected && this.previousFocus?.focus?.();
  }
};
