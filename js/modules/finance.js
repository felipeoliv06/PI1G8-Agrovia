import { supabase } from '../config/supabase.js';
import { UI } from './ui.js';

const CATEGORY_OPTIONS = {
  despesa: ['Insumos', 'Mão de obra', 'Combustível', 'Manutenção de máquinas', 'Frete', 'Arrendamento', 'Impostos e taxas', 'Outros'],
  receita: ['Venda de produção', 'Prestação de serviços', 'Arrendamento recebido', 'Outros']
};

export const FinanceModule = {
  userId: null,
  initialized: false,
  loading: false,
  reloadRequested: false,
  properties: [],
  harvests: [],
  transactions: [],
  filters: { period: 'month', type: 'all', status: 'all', search: '', property: 'all', start: '', end: '' },

  async init(user) {
    this.userId = user.id;
    this.renderShell();
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
      window.addEventListener('agrovia:dataChanged', () => this.load());
    }
    await this.load();
  },

  renderShell() {
    const root = document.getElementById('financeiro');
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';
    root.className = 'view-section hidden animate-fade-in';
    root.innerHTML = `
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h3 class="text-2xl font-bold tracking-tight text-white">Financeiro rural</h3><p class="mt-1 text-sm text-slate-400">Acompanhe receitas, despesas e resultado da operação</p></div>
        <div class="flex flex-wrap gap-2"><button id="financeExportBtn" type="button" class="w-fit rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-emerald-500/40 hover:text-white"><i class="fa-solid fa-file-csv mr-1" aria-hidden="true"></i> Exportar CSV</button><button id="financeRefreshBtn" type="button" class="w-fit rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-emerald-500/40 hover:text-white"><i class="fa-solid fa-rotate mr-1" aria-hidden="true"></i> Atualizar</button></div>
      </div>
      <section id="financeSummary" class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
        <div class="finance-skeleton"></div><div class="finance-skeleton"></div><div class="finance-skeleton"></div><div class="finance-skeleton"></div>
      </section>
      <section class="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-4" aria-label="Filtros dos relatórios financeiros"><div class="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 class="text-sm font-bold text-white">Filtros dos indicadores e relatórios</h4><button id="financeClearReportFilters" type="button" class="text-xs font-semibold text-emerald-300 hover:text-white">Limpar filtros</button></div><div class="grid gap-3 sm:grid-cols-3"><div><label for="financeReportProperty" class="finance-label">Propriedade</label><select id="financeReportProperty" class="finance-input"><option value="all">Todas as propriedades</option></select></div><div><label for="financeReportStart" class="finance-label">Data inicial</label><input id="financeReportStart" type="date" class="finance-input"></div><div><label for="financeReportEnd" class="finance-label">Data final</label><input id="financeReportEnd" type="date" class="finance-input"></div></div><p class="mt-2 text-xs text-slate-500">Os filtros combinam com o período e os demais filtros da lista. Os resultados consideram apenas lançamentos confirmados.</p></section>
      <div class="grid grid-cols-1 gap-5 2xl:grid-cols-3">
        <section class="h-fit rounded-2xl border border-slate-800 bg-slate-900 p-5 2xl:col-span-1">
          <div class="mb-4 flex items-center justify-between gap-3"><div><h4 id="financeFormTitle" class="text-lg font-bold text-white">Novo lançamento</h4><p class="mt-1 text-xs text-slate-500">Registre uma entrada ou saída</p></div><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><i class="fa-solid fa-money-bill-transfer" aria-hidden="true"></i></span></div>
          <form id="financeForm" class="space-y-3">
            <input type="hidden" id="financeTransactionId">
            <div><label for="financeType" class="finance-label">Tipo de lançamento</label><select id="financeType" required class="finance-input"><option value="despesa">Despesa</option><option value="receita">Receita</option></select></div>
            <div><label for="financeDescription" class="finance-label">Descrição</label><input id="financeDescription" required maxlength="255" class="finance-input" placeholder="Ex.: Compra de fertilizante"></div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label for="financeAmount" class="finance-label">Valor (R$)</label><input id="financeAmount" required type="number" min="0.01" step="0.01" inputmode="decimal" class="finance-input" placeholder="0,00"></div>
              <div><label for="financeDate" class="finance-label">Data</label><input id="financeDate" required type="date" class="finance-input"></div>
            </div>
            <div><label for="financeCategory" class="finance-label">Categoria</label><select id="financeCategory" required class="finance-input"></select></div>
            <div><label for="financeProperty" class="finance-label">Propriedade</label><select id="financeProperty" required class="finance-input"><option value="">Carregando propriedades...</option></select></div>
            <div><label for="financeHarvest" class="finance-label">Safra (opcional)</label><select id="financeHarvest" class="finance-input"><option value="">Sem vínculo com safra</option></select></div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label for="financeStatus" class="finance-label">Situação</label><select id="financeStatus" class="finance-input"><option value="confirmado">Confirmado</option><option value="pendente">Pendente</option><option value="cancelado">Cancelado</option></select></div>
              <div><label for="financePayment" class="finance-label">Forma de pagamento</label><select id="financePayment" class="finance-input"><option value="">Não informado</option><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Boleto</option><option>Outro</option></select></div>
            </div>
            <div><label for="financeNotes" class="finance-label">Observações (opcional)</label><textarea id="financeNotes" rows="2" maxlength="2000" class="finance-input" placeholder="Detalhes adicionais"></textarea></div>
            <div class="flex gap-2 pt-1"><button id="financeSaveBtn" type="submit" class="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">Salvar lançamento</button><button id="financeCancelEditBtn" type="button" class="hidden rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800">Cancelar</button></div>
          </form>
        </section>
        <section class="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-5 2xl:col-span-2">
          <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h4 class="text-lg font-bold text-white">Lançamentos</h4><p class="mt-1 text-xs text-slate-500">Histórico financeiro da sua operação</p></div>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"><select id="financePeriodFilter" aria-label="Período" class="finance-filter"><option value="month">Este mês</option><option value="year">Este ano</option><option value="all">Todo o período</option></select><select id="financeTypeFilter" aria-label="Tipo" class="finance-filter"><option value="all">Todos os tipos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select><select id="financeStatusFilter" aria-label="Situação" class="finance-filter"><option value="all">Todas as situações</option><option value="confirmado">Confirmados</option><option value="pendente">Pendentes</option><option value="cancelado">Cancelados</option></select><input id="financeSearch" type="search" aria-label="Buscar lançamento" placeholder="Buscar..." class="finance-filter"></div>
          </div>
          <div id="financeTransactionList" class="space-y-3" aria-live="polite"><p class="py-8 text-center text-sm text-slate-500">Carregando lançamentos...</p></div>
        </section>
      </div>
      <section class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <article class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div class="mb-4"><h4 class="font-bold text-white">Despesas por categoria</h4><p class="mt-1 text-xs text-slate-500">Distribuição das despesas confirmadas no período</p></div><div id="financeCategoryReport" class="space-y-4"></div></article>
        <article class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div class="mb-4"><h4 class="font-bold text-white">Resultado por propriedade</h4><p class="mt-1 text-xs text-slate-500">Receitas menos despesas confirmadas</p></div><div id="financePropertyReport" class="space-y-3"></div></article>
      </section>
      <style>
        .finance-input{width:100%;min-width:0;padding:10px 12px;background:#020617;border:1px solid #334155;border-radius:10px;color:#e2e8f0;font-size:13px}
        .finance-input:focus,.finance-filter:focus{outline:2px solid #10b981;outline-offset:1px}
        .finance-label{display:block;margin-bottom:6px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
        .finance-filter{min-width:0;padding:9px 10px;background:#020617;border:1px solid #334155;border-radius:9px;color:#cbd5e1;font-size:12px}
        .finance-skeleton{height:116px;border:1px solid #1e293b;border-radius:16px;background:linear-gradient(90deg,#0f172a,#172338,#0f172a);background-size:200% 100%;animation:financePulse 1.4s infinite}
        @keyframes financePulse{to{background-position:-200% 0}}
      </style>`;
    this.updateCategoryOptions();
    document.getElementById('financeDate').value = this.today();
  },

  bindEvents() {
    const root = document.getElementById('financeiro');
    root.addEventListener('submit', async (event) => {
      if (event.target.id !== 'financeForm') return;
      event.preventDefault();
      const button = document.getElementById('financeSaveBtn');
      button.disabled = true;
      try {
        await this.saveTransaction();
        this.resetForm();
        window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
        UI.showToast('Lançamento salvo com sucesso.', 'success');
      } catch (error) {
        console.error('Agrovia financeiro:', error);
        UI.showToast(this.errorMessage(error), 'error');
      } finally { button.disabled = this.properties.length === 0; }
    });
    root.addEventListener('click', async (event) => {
      const edit = event.target.closest('[data-finance-edit]');
      if (edit) { this.startEdit(edit.dataset.financeEdit); return; }
      const remove = event.target.closest('[data-finance-delete]');
      if (!remove || remove.disabled) return;
      if (!confirm('Excluir este lançamento financeiro?')) return;
      remove.disabled = true;
      try {
        const { data, error } = await supabase.from('financial_transactions')
          .delete().eq('id', remove.dataset.financeDelete).eq('user_id', this.userId)
          .select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Lançamento não encontrado ou sem permissão para excluí-lo. Atualize a lista.');
        window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
        UI.showToast('Lançamento excluído.', 'success');
      } catch (error) {
        UI.showToast(this.errorMessage(error), 'error');
        remove.disabled = false;
      }
    });
    document.getElementById('financeType')?.addEventListener('change', () => this.updateCategoryOptions());
    document.getElementById('financeProperty')?.addEventListener('change', () => this.updateHarvestOptions());
    document.getElementById('financePeriodFilter')?.addEventListener('change', (event) => { this.filters.period = event.target.value; this.render(); });
    document.getElementById('financeTypeFilter')?.addEventListener('change', (event) => { this.filters.type = event.target.value; this.render(); });
    document.getElementById('financeStatusFilter')?.addEventListener('change', (event) => { this.filters.status = event.target.value; this.render(); });
    document.getElementById('financeSearch')?.addEventListener('input', (event) => { this.filters.search = event.target.value.trim().toLocaleLowerCase('pt-BR'); this.render(); });
    document.getElementById('financeReportProperty')?.addEventListener('change', e => { this.filters.property = e.target.value; this.render(); });
    document.getElementById('financeReportStart')?.addEventListener('change', e => { this.filters.start = e.target.value; this.render(); });
    document.getElementById('financeReportEnd')?.addEventListener('change', e => { this.filters.end = e.target.value; this.render(); });
    document.getElementById('financeClearReportFilters')?.addEventListener('click', () => {
      this.filters.property = 'all'; this.filters.start = ''; this.filters.end = '';
      document.getElementById('financeReportProperty').value = 'all';
      document.getElementById('financeReportStart').value = '';
      document.getElementById('financeReportEnd').value = '';
      this.render();
    });
    document.getElementById('financeRefreshBtn')?.addEventListener('click', () => this.load());
    document.getElementById('financeExportBtn')?.addEventListener('click', () => this.exportCsv());
    document.getElementById('financeCancelEditBtn')?.addEventListener('click', () => this.resetForm());
  },

  async load() {
    if (!this.userId) return;
    if (this.loading) {
      this.reloadRequested = true;
      return;
    }
    this.loading = true;
    try {
      const [propertiesResult, harvestsResult] = await Promise.all([
        supabase.from('properties').select('id,name').eq('user_id', this.userId).order('name'),
        supabase.from('harvests').select('id,name,field_id,fields(property_id)').order('start_date', { ascending: false })
      ]);
      for (const result of [propertiesResult, harvestsResult]) if (result.error) throw result.error;

      // Busca em páginas para que relatórios e exportações não parem nos primeiros 500 registros.
      const allTransactions = [];
      const pageSize = 500;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase.from('financial_transactions')
          .select('id,transaction_type,category,description,amount,transaction_date,status,payment_method,notes,property_id,harvest_id,source_order_id,properties(name),harvests(name)')
          .eq('user_id', this.userId)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allTransactions.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }

      this.properties = propertiesResult.data || [];
      this.harvests = harvestsResult.data || [];
      this.transactions = allTransactions;
      this.renderPropertyOptions();
      const reportProperty = document.getElementById('financeReportProperty');
      if (reportProperty) {
        reportProperty.innerHTML = '<option value="all">Todas as propriedades</option>' + this.properties.map(p => `<option value="${p.id}">${UI.escapeHTML(p.name)}</option>`).join('');
        if (this.filters.property !== 'all' && this.properties.some(p => p.id === this.filters.property)) reportProperty.value = this.filters.property;
        else { this.filters.property = 'all'; reportProperty.value = 'all'; }
      }
      this.render();
    } catch (error) {
      console.error('Agrovia: falha ao carregar financeiro', error);
      const list = document.getElementById('financeTransactionList');
      if (list) list.innerHTML = `<div class="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5 text-center"><p class="text-sm font-semibold text-rose-300">Não foi possível carregar o financeiro.</p><p class="mt-1 text-xs text-slate-500">${UI.escapeHTML(this.errorMessage(error))}</p></div>`;
      if (error?.code === '42P01' || error?.code === 'PGRST205') UI.showToast('A tabela financeira ainda não está disponível no banco.', 'error');
    } finally {
      this.loading = false;
      if (this.reloadRequested) {
        this.reloadRequested = false;
        queueMicrotask(() => this.load());
      }
    }
  },

  async saveTransaction() {
    const id = document.getElementById('financeTransactionId').value;
    if (id && this.transactions.some(t => t.id === id && t.source_order_id)) throw new Error('Receita gerada por pedido não pode ser editada.');
    const type = document.getElementById('financeType').value;
    const amount = Number(document.getElementById('financeAmount').value);
    const description = document.getElementById('financeDescription').value.trim();
    const propertyId = document.getElementById('financeProperty').value;
    const harvestId = document.getElementById('financeHarvest').value || null;
    const date = document.getElementById('financeDate').value;
    if (!description) throw new Error('Informe uma descrição para o lançamento.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor maior que zero.');
    if (!propertyId) throw new Error('Selecione uma propriedade.');
    if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) throw new Error('Informe uma data válida.');
    if (harvestId) {
      const selectedHarvest = this.harvests.find(item => item.id === harvestId);
      if (!selectedHarvest || selectedHarvest.fields?.property_id !== propertyId) throw new Error('A safra selecionada não pertence à propriedade escolhida.');
    }
    const payload = {
      user_id: this.userId,
      property_id: propertyId,
      harvest_id: harvestId,
      transaction_type: type,
      category: document.getElementById('financeCategory').value,
      description,
      amount: Number(amount.toFixed(2)),
      transaction_date: date,
      status: document.getElementById('financeStatus').value,
      payment_method: document.getElementById('financePayment').value || null,
      notes: document.getElementById('financeNotes').value.trim() || null,
      updated_at: new Date().toISOString()
    };
    const result = id
      ? await supabase.from('financial_transactions').update(payload).eq('id', id).eq('user_id', this.userId).select('id').maybeSingle()
      : await supabase.from('financial_transactions').insert(payload).select('id').single();
    if (result.error) throw result.error;
    if (id && !result.data) throw new Error('Lançamento não encontrado ou sem permissão para alterá-lo. Atualize a lista.');
  },

  renderPropertyOptions(selected = '') {
    const select = document.getElementById('financeProperty');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione a propriedade</option>' + this.properties.map(item => `<option value="${item.id}">${UI.escapeHTML(item.name)}</option>`).join('');
    if (this.properties.some(item => item.id === selected)) select.value = selected;
    this.updateHarvestOptions();
    const save = document.getElementById('financeSaveBtn');
    if (save) save.disabled = this.properties.length === 0;
    if (!this.properties.length) select.innerHTML = '<option value="">Cadastre uma propriedade primeiro</option>';
  },

  updateHarvestOptions(selected = '') {
    const propertyId = document.getElementById('financeProperty')?.value;
    const select = document.getElementById('financeHarvest');
    if (!select) return;
    const options = this.harvests.filter(item => item.fields?.property_id === propertyId);
    select.innerHTML = '<option value="">Sem vínculo com safra</option>' + options.map(item => `<option value="${item.id}">${UI.escapeHTML(item.name)}</option>`).join('');
    if (options.some(item => item.id === selected)) select.value = selected;
  },

  updateCategoryOptions(selected = '') {
    const type = document.getElementById('financeType')?.value || 'despesa';
    const select = document.getElementById('financeCategory');
    if (!select) return;
    select.innerHTML = CATEGORY_OPTIONS[type].map(item => `<option value="${UI.escapeHTML(item)}">${UI.escapeHTML(item)}</option>`).join('');
    if (CATEGORY_OPTIONS[type].includes(selected)) select.value = selected;
  },

  startEdit(id) {
    const item = this.transactions.find(transaction => transaction.id === id);
    if (item?.source_order_id) return UI.showToast('Receita vinculada a pedido não pode ser editada.', 'info');
    if (!item) return UI.showToast('Lançamento não encontrado. Atualize a lista.', 'error');
    document.getElementById('financeTransactionId').value = item.id;
    document.getElementById('financeType').value = item.transaction_type;
    this.updateCategoryOptions(item.category);
    document.getElementById('financeDescription').value = item.description;
    document.getElementById('financeAmount').value = item.amount;
    document.getElementById('financeDate').value = item.transaction_date;
    document.getElementById('financeStatus').value = item.status;
    document.getElementById('financePayment').value = item.payment_method || '';
    document.getElementById('financeNotes').value = item.notes || '';
    this.renderPropertyOptions(item.property_id);
    this.updateHarvestOptions(item.harvest_id || '');
    document.getElementById('financeFormTitle').textContent = 'Editar lançamento';
    document.getElementById('financeSaveBtn').textContent = 'Salvar alterações';
    document.getElementById('financeCancelEditBtn').classList.remove('hidden');
    document.getElementById('financeForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  resetForm() {
    document.getElementById('financeForm')?.reset();
    document.getElementById('financeTransactionId').value = '';
    document.getElementById('financeDate').value = this.today();
    document.getElementById('financeFormTitle').textContent = 'Novo lançamento';
    document.getElementById('financeSaveBtn').textContent = 'Salvar lançamento';
    document.getElementById('financeCancelEditBtn').classList.add('hidden');
    this.updateCategoryOptions();
    this.renderPropertyOptions();
  },

  render() {
    this.renderSummary();
    this.renderTransactions();
    this.renderReports();
  },

  getFilteredTransactions() {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.transactions.filter(item => {
      if (this.filters.period === 'month' && !String(item.transaction_date).startsWith(month)) return false;
      if (this.filters.period === 'year' && !String(item.transaction_date).startsWith(year)) return false;
      if (this.filters.property !== 'all' && item.property_id !== this.filters.property) return false;
      if (this.filters.start && item.transaction_date < this.filters.start) return false;
      if (this.filters.end && item.transaction_date > this.filters.end) return false;
      if (this.filters.type !== 'all' && item.transaction_type !== this.filters.type) return false;
      if (this.filters.status !== 'all' && item.status !== this.filters.status) return false;
      if (this.filters.search) {
        const text = `${item.description} ${item.category} ${item.properties?.name || ''} ${item.harvests?.name || ''}`.toLocaleLowerCase('pt-BR');
        if (!text.includes(this.filters.search)) return false;
      }
      return true;
    });
  },

  renderSummary() {
    const root = document.getElementById('financeSummary');
    if (!root) return;
    const items = this.getFilteredTransactions();
    const confirmed = items.filter(item => item.status === 'confirmado');
    const revenue = confirmed.filter(item => item.transaction_type === 'receita').reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = confirmed.filter(item => item.transaction_type === 'despesa').reduce((sum, item) => sum + Number(item.amount), 0);
    const pending = items.filter(item => item.status === 'pendente').reduce((sum, item) => sum + Number(item.amount), 0);
    const cards = [
      { label: 'Receitas confirmadas', value: revenue, icon: 'fa-arrow-trend-up', tone: 'emerald', note: 'Entradas recebidas' },
      { label: 'Despesas confirmadas', value: expenses, icon: 'fa-arrow-trend-down', tone: 'rose', note: 'Saídas realizadas' },
      { label: 'Resultado', value: revenue - expenses, icon: 'fa-scale-balanced', tone: revenue - expenses >= 0 ? 'cyan' : 'amber', note: 'Receitas menos despesas' },
      { label: 'Lançamentos pendentes', value: pending, icon: 'fa-clock', tone: 'amber', note: `${items.filter(item => item.status === 'pendente').length} registro(s)` }
    ];
    root.innerHTML = cards.map(card => `<article class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div class="flex items-center justify-between gap-3"><span class="text-sm font-medium text-slate-400">${card.label}</span><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-${card.tone}-500/10 text-${card.tone}-400"><i class="fa-solid ${card.icon}" aria-hidden="true"></i></span></div><p class="mt-4 text-2xl font-bold tracking-tight text-white">${this.formatCurrency(card.value)}</p><p class="mt-1 text-xs text-slate-500">${card.note}</p></article>`).join('');
  },

  renderTransactions() {
    const root = document.getElementById('financeTransactionList');
    if (!root) return;
    const items = this.getFilteredTransactions();
    if (!items.length) {
      root.innerHTML = `<div class="rounded-xl border border-dashed border-slate-700 p-8 text-center"><span class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-500"><i class="fa-solid fa-receipt" aria-hidden="true"></i></span><p class="mt-3 text-sm font-semibold text-slate-300">Nenhum lançamento encontrado</p><p class="mt-1 text-xs text-slate-500">Cadastre uma receita ou despesa para começar seu controle financeiro.</p></div>`;
      return;
    }
    root.innerHTML = items.map(item => {
      const isRevenue = item.transaction_type === 'receita';
      const amountClass = isRevenue ? 'text-emerald-400' : 'text-rose-400';
      const sign = isRevenue ? '+' : '−';
      const statusClass = item.status === 'confirmado' ? 'bg-emerald-500/10 text-emerald-400' : item.status === 'pendente' ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-700/50 text-slate-400';
      return `<article class="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div class="flex min-w-0 items-start gap-3"><span class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isRevenue ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}"><i class="fa-solid ${isRevenue ? 'fa-arrow-down' : 'fa-arrow-up'}" aria-hidden="true"></i></span><div class="min-w-0"><p class="break-words text-sm font-semibold text-white">${UI.escapeHTML(item.description)}</p><p class="mt-1 text-xs text-slate-400">${UI.escapeHTML(item.category)} · ${UI.escapeHTML(item.properties?.name || 'Propriedade')}</p><p class="mt-1 text-xs text-slate-500">${this.formatDate(item.transaction_date)}${item.harvests?.name ? ` · ${UI.escapeHTML(item.harvests.name)}` : ''}${item.payment_method ? ` · ${UI.escapeHTML(item.payment_method)}` : ''}</p></div></div><div class="flex items-center justify-between gap-3 sm:justify-end"><div class="text-left sm:text-right"><p class="font-bold ${amountClass}">${sign} ${this.formatCurrency(item.amount)}</p><span class="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass}">${this.statusLabel(item.status)}</span></div>${item.source_order_id ? `<span class="rounded-lg border border-emerald-500/20 px-2 py-1 text-xs text-emerald-300" title="Receita automática vinculada a pedido">Pedido vinculado</span>` : `<div class="flex gap-1"><button type="button" data-finance-edit="${item.id}" aria-label="Editar lançamento" class="rounded-lg p-2 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400"><i class="fa-solid fa-pen" aria-hidden="true"></i></button><button type="button" data-finance-delete="${item.id}" aria-label="Excluir lançamento" class="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"><i class="fa-solid fa-trash" aria-hidden="true"></i></button></div>`}</div></article>`;
    }).join('');
  },


  renderReports() {
    const items = this.getFilteredTransactions().filter(item => item.status === 'confirmado');
    const categoryRoot = document.getElementById('financeCategoryReport');
    const propertyRoot = document.getElementById('financePropertyReport');
    if (!categoryRoot || !propertyRoot) return;

    const categoryTotals = new Map();
    for (const item of items) {
      if (item.transaction_type !== 'despesa') continue;
      categoryTotals.set(item.category, (categoryTotals.get(item.category) || 0) + Number(item.amount));
    }
    const categories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCategory = categories[0]?.[1] || 0;
    categoryRoot.innerHTML = categories.length ? categories.map(([name, amount]) => {
      const percent = maxCategory > 0 ? (amount / maxCategory) * 100 : 0;
      return `<div><div class="mb-1.5 flex items-center justify-between gap-3"><span class="truncate text-sm text-slate-300">${UI.escapeHTML(name)}</span><strong class="shrink-0 text-sm text-white">${this.formatCurrency(amount)}</strong></div><div class="h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full bg-rose-400" style="width:${percent}%"></div></div></div>`;
    }).join('') : '<p class="py-5 text-center text-sm text-slate-500">Ainda não há despesas confirmadas neste período.</p>';

    const propertyTotals = new Map();
    for (const item of items) {
      // A chave é o ID, não o nome: propriedades diferentes podem ter nomes iguais.
      const key = item.property_id;
      const current = propertyTotals.get(key) || { name: item.properties?.name || 'Propriedade', revenue: 0, expenses: 0 };
      current[item.transaction_type === 'receita' ? 'revenue' : 'expenses'] += Number(item.amount);
      propertyTotals.set(key, current);
    }
    const properties = [...propertyTotals.values()].sort((a, b) => (b.revenue - b.expenses) - (a.revenue - a.expenses));
    propertyRoot.innerHTML = properties.length ? properties.map(totals => {
      const result = totals.revenue - totals.expenses;
      const resultClass = result >= 0 ? 'text-emerald-400' : 'text-rose-400';
      return `<div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div class="flex items-start justify-between gap-3"><p class="truncate text-sm font-semibold text-white">${UI.escapeHTML(totals.name)}</p><strong class="shrink-0 text-sm ${resultClass}">${this.formatCurrency(result)}</strong></div><div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"><span class="text-emerald-400">Receitas: ${this.formatCurrency(totals.revenue)}</span><span class="text-rose-400">Despesas: ${this.formatCurrency(totals.expenses)}</span></div></div>`;
    }).join('') : '<p class="py-5 text-center text-sm text-slate-500">Cadastre lançamentos para comparar suas propriedades.</p>';
  },

  exportCsv() {
    const rows = this.getFilteredTransactions();
    if (!rows.length) return UI.showToast('Não há lançamentos para exportar com os filtros atuais.', 'info');
    const columns = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Propriedade', 'Safra', 'Valor', 'Situação', 'Forma de pagamento', 'Observações'];
    const quote = value => {
      let text = String(value ?? '');
      // Evita que planilhas interpretem textos importados como fórmulas.
      if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [columns.map(quote).join(';'), ...rows.map(item => [
      this.formatDate(item.transaction_date), item.transaction_type === 'receita' ? 'Receita' : 'Despesa', item.description,
      item.category, item.properties?.name || '', item.harvests?.name || '', Number(item.amount).toFixed(2).replace('.', ','),
      this.statusLabel(item.status), item.payment_method || '', item.notes || ''
    ].map(quote).join(';'))];
    const blob = new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agrovia-financeiro-${this.today()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    UI.showToast('Arquivo CSV exportado.', 'success');
  },

  today() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; },
  formatCurrency(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
  formatDate(value) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR'); },
  statusLabel(value) { return ({ confirmado: 'Confirmado', pendente: 'Pendente', cancelado: 'Cancelado' })[value] || value; },
  errorMessage(error) {
    if (error?.code === '23503') return 'A propriedade ou safra selecionada não existe mais.';
    if (error?.code === '23514') return 'Confira o tipo, categoria, situação e valor informado.';
    if (error?.code === '42501') return 'Acesso não autorizado. Confira sua sessão.';
    if (error?.code === '42P01' || error?.code === 'PGRST205') return 'A tabela financeira ainda não está disponível. Atualize o banco do Agrovia.';
    return error?.message || 'Não foi possível concluir a operação.';
  }
};
