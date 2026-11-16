import { supabase } from '../config/supabase.js';
import { UI } from './ui.js';

export const DashboardModule = {
  initialized: false,
  loading: false,
  cache: { properties: [], crops: [], fields: [], harvests: [], products: [], orders: [], deliveries: [] },

  init() {
    if (!this.initialized) {
      document.getElementById('refreshDashboardBtn')?.addEventListener('click', () => this.load());
      document.getElementById('dashboardContent')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-dashboard-target]');
        if (!button) return;
        document.querySelector(`.nav-btn[data-target="${button.dataset.dashboardTarget}"]`)?.click();
      });
      window.addEventListener('agrovia:dataChanged', () => this.load());
      this.initialized = true;
    }
    return this.load();
  },

  async load() {
    if (this.loading) return;
    this.loading = true;
    const refresh = document.getElementById('refreshDashboardBtn');
    if (refresh) {
      refresh.disabled = true;
      refresh.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Atualizando';
    }
    try {
      const results = await Promise.all([
        supabase.from('properties').select('id,name,total_area,location'),
        supabase.from('crops').select('id,name'),
        supabase.from('fields').select('id,name,area,property_id'),
        supabase.from('harvests').select('id,name,start_date,expected_end_date,status,field_id,crop_id,fields(name),crops(name)'),
        supabase.from('products').select('id,name,stock_quantity,minimum_stock,is_active'),
        supabase.from('orders').select('id,order_number,status,total_amount,order_date').order('order_date', { ascending: false }).limit(1000),
        supabase.from('deliveries').select('id,status,scheduled_date,orders(order_number)').order('scheduled_date', { ascending: true }).limit(1000)
      ]);
      const [properties, crops, fields, harvests, products, orders, deliveries] = results;
      for (const result of results) if (result.error) throw result.error;
      this.cache = {
        properties: properties.data || [],
        crops: crops.data || [],
        fields: fields.data || [],
        harvests: harvests.data || [],
        products: products.data || [],
        orders: orders.data || [],
        deliveries: deliveries.data || []
      };
      this.render();
      const updated = document.getElementById('dashboardLastUpdated');
      if (updated) updated.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch (error) {
      console.error('Agrovia: erro ao carregar painel', error);
      const root = document.getElementById('dashboardContent');
      if (root) root.innerHTML = `<div class="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center"><i class="fa-solid fa-triangle-exclamation text-rose-400 text-2xl mb-2" aria-hidden="true"></i><p class="text-white font-semibold">Não foi possível carregar o painel.</p><p class="text-sm text-slate-400 mt-1">Confira sua conexão e tente novamente.</p><button type="button" id="dashboardRetryBtn" class="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Tentar novamente</button></div>`;
      document.getElementById('dashboardRetryBtn')?.addEventListener('click', () => this.load());
    } finally {
      this.loading = false;
      if (refresh) {
        refresh.disabled = false;
        refresh.innerHTML = '<i class="fa-solid fa-rotate" aria-hidden="true"></i> Atualizar';
      }
    }
  },

  render() {
    const { properties, crops, fields, harvests, products, orders, deliveries } = this.cache;
    const totalArea = properties.reduce((sum, item) => sum + (Number(item.total_area) || 0), 0);
    const cultivatedArea = fields.reduce((sum, item) => sum + (Number(item.area) || 0), 0);
    const active = harvests.filter(item => item.status === 'Em Andamento');
    const planned = harvests.filter(item => item.status === 'Planejada');
    const completed = harvests.filter(item => item.status === 'Concluída');
    const areaPercent = totalArea > 0 ? Math.min(100, (cultivatedArea / totalArea) * 100) : 0;
    const stats = [
      { label: 'Propriedades', value: properties.length, icon: 'fa-map-location-dot', note: 'Fazendas e sítios', tone: 'emerald' },
      { label: 'Área total', value: `${this.formatNumber(totalArea)} ha`, icon: 'fa-expand', note: 'Área cadastrada', tone: 'cyan' },
      { label: 'Talhões', value: fields.length, icon: 'fa-border-all', note: `${this.formatNumber(cultivatedArea)} ha vinculados`, tone: 'violet' },
      { label: 'Safras em andamento', value: active.length, icon: 'fa-wheat-awn', note: `${planned.length} planejada(s)`, tone: 'amber' }
    ];
    const statCards = stats.map(stat => `
      <article class="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
        <div class="flex items-center justify-between gap-3"><span class="text-sm font-medium text-slate-400">${stat.label}</span><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-${stat.tone}-500/10 text-${stat.tone}-400"><i class="fa-solid ${stat.icon}" aria-hidden="true"></i></span></div>
        <p class="mt-4 text-3xl font-bold tracking-tight text-white">${stat.value}</p><p class="mt-1 text-xs text-slate-500">${stat.note}</p>
      </article>`).join('');

    const upcoming = [...harvests]
      .filter(item => item.status === 'Em Andamento' || item.status === 'Planejada')
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Em Andamento' ? -1 : 1;
        return String(a.start_date || '').localeCompare(String(b.start_date || ''));
      }).slice(0, 5);
    const harvestRows = upcoming.length ? upcoming.map(item => {
      const statusClass = item.status === 'Em Andamento' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300';
      return `<div class="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div class="min-w-0"><p class="truncate font-semibold text-white">${UI.escapeHTML(item.name)}</p><p class="mt-1 text-xs text-slate-400">${UI.escapeHTML(item.crops?.name || 'Cultura não informada')} · ${UI.escapeHTML(item.fields?.name || 'Talhão não informado')}</p><p class="mt-1 text-xs text-slate-500">Início: ${this.formatDate(item.start_date)}${item.expected_end_date ? ` · Previsão: ${this.formatDate(item.expected_end_date)}` : ''}</p></div><span class="w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClass}">${UI.escapeHTML(item.status)}</span></div>`;
    }).join('') : '<div class="rounded-xl border border-dashed border-slate-700 p-6 text-center"><p class="text-sm font-medium text-slate-300">Nenhuma safra ativa ou planejada</p><p class="mt-1 text-xs text-slate-500">Quando você cadastrar uma safra, ela aparecerá aqui.</p></div>';

    const propertyRows = properties.slice(0, 4).map(item => `<div class="flex items-center justify-between gap-3 border-b border-slate-800/80 py-3 last:border-0"><div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-200">${UI.escapeHTML(item.name)}</p><p class="truncate text-xs text-slate-500">${UI.escapeHTML(item.location || 'Local não informado')}</p></div><span class="shrink-0 text-sm font-semibold text-emerald-400">${this.formatNumber(item.total_area)} ha</span></div>`).join('');
    const propertyContent = properties.length ? propertyRows : '<p class="py-6 text-center text-sm text-slate-500">Cadastre sua primeira propriedade para começar.</p>';

    const pendingOrders = orders.filter(o => !['Concluído', 'Cancelado'].includes(o.status));
    const completedOrders = orders.filter(o => o.status === 'Concluído');
    const completedTotal = completedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const lowStock = products.filter(p => p.is_active && Number(p.stock_quantity) <= Number(p.minimum_stock));
    const upcomingDeliveries = deliveries.filter(d => !['Entregue', 'Cancelada', 'Cancelado'].includes(d.status));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const inSevenDays = new Date(today); inSevenDays.setDate(inSevenDays.getDate() + 7);
    const datedDeliveries = upcomingDeliveries.map(d => {
      const raw = String(d.scheduled_date || '').slice(0, 10);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : null;
      return { ...d, dueDate: date && !Number.isNaN(date.getTime()) ? date : null };
    });
    const overdue = datedDeliveries.filter(d => d.dueDate && d.dueDate < today);
    const nextDeliveries = datedDeliveries.filter(d => d.dueDate && d.dueDate >= today && d.dueDate <= inSevenDays);
    const priorities = [
      { count: lowStock.length, title: 'Produtos com estoque baixo', detail: 'Confira os produtos que precisam de reposição.', target: 'comercial', action: 'Ver estoque', icon: 'fa-box-open', tone: 'amber' },
      { count: overdue.length, title: 'Entregas atrasadas', detail: 'Há entregas com data prevista já ultrapassada.', target: 'comercial', action: 'Ver entregas', icon: 'fa-truck-fast', tone: 'rose' },
      { count: nextDeliveries.length, title: 'Entregas nos próximos 7 dias', detail: 'Organize as entregas que estão chegando.', target: 'comercial', action: 'Ver entregas', icon: 'fa-calendar-check', tone: 'cyan' },
      { count: pendingOrders.length, title: 'Pedidos em aberto', detail: 'Acompanhe os pedidos que ainda não foram finalizados.', target: 'comercial', action: 'Ver pedidos', icon: 'fa-clipboard-list', tone: 'emerald' }
    ].filter(item => item.count > 0);
    const priorityHTML = priorities.length ? priorities.map(item => `<article class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div class="flex min-w-0 items-center gap-3"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-${item.tone}-500/10 text-${item.tone}-400"><i class="fa-solid ${item.icon}" aria-hidden="true"></i></span><div><p class="text-sm font-semibold text-white">${item.count} · ${item.title}</p><p class="mt-1 text-xs text-slate-400">${item.detail}</p></div></div><button type="button" data-dashboard-target="${item.target}" class="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label="${item.action}: ${item.title}">${item.action} <i class="fa-solid fa-arrow-right ml-1" aria-hidden="true"></i></button></article>`).join('') : '<div class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5"><p class="font-semibold text-emerald-300"><i class="fa-solid fa-circle-check mr-2" aria-hidden="true"></i>Tudo em ordem por enquanto</p><p class="mt-1 text-sm text-slate-400">Nenhuma pendência de estoque, pedidos ou entregas identificada nos registros carregados.</p></div>';
    const commercialCards = [
      ['Produtos ativos', products.filter(p => p.is_active).length, 'Itens disponíveis'],
      ['Estoque baixo', lowStock.length, 'Produtos que precisam de atenção'],
      ['Pedidos em aberto', pendingOrders.length, 'Aguardando atendimento'],
      ['Pedidos concluídos', completedOrders.length, `${this.formatCurrency(completedTotal)} registrados`]
    ].map(([label, value, note]) => `<article class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p class="text-sm text-slate-400">${label}</p><p class="mt-3 text-3xl font-bold text-white">${value}</p><p class="mt-1 text-xs text-slate-500">${note}</p></article>`).join('');
    const commercialAlerts = [
      ...lowStock.slice(0, 4).map(p => `<p class="rounded-lg bg-slate-950 p-3 text-sm text-amber-300"><i class="fa-solid fa-triangle-exclamation mr-2"></i>${UI.escapeHTML(p.name)}: ${this.formatNumber(p.stock_quantity)} em estoque (mín. ${this.formatNumber(p.minimum_stock)})</p>`),
      ...datedDeliveries.filter(d => d.dueDate).sort((a,b) => a.dueDate - b.dueDate).slice(0, 3).map(d => `<p class="rounded-lg bg-slate-950 p-3 text-sm text-slate-300"><i class="fa-solid fa-truck mr-2 text-emerald-400" aria-hidden="true"></i>Entrega do pedido ${UI.escapeHTML(d.orders?.order_number || '—')} · ${UI.escapeHTML(d.status)} · ${UI.escapeHTML(d.dueDate.toLocaleDateString('pt-BR'))}</p>`)
    ].join('') || '<p class="py-5 text-sm text-slate-500">Nenhum alerta comercial no momento.</p>';
    const root = document.getElementById('dashboardContent');
    if (!root) return;
    root.innerHTML = `
      <section aria-labelledby="dashboardPrioritiesHeading" class="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5"><div class="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h4 id="dashboardPrioritiesHeading" class="font-bold text-white">O que precisa da sua atenção</h4><p class="mt-1 text-xs text-slate-400">Um resumo das próximas ações da sua operação</p></div><span class="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">${priorities.length} tipo(s) de aviso</span></div><div class="grid gap-3 lg:grid-cols-2">${priorityHTML}</div></section>
      <div class="mb-3 flex items-center justify-between"><h4 class="font-bold text-white">Indicadores agrícolas</h4></div>
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">${statCards}</section>
      <div class="mb-3 mt-6 flex items-center justify-between"><h4 class="font-bold text-white">Operação comercial</h4><button type="button" data-dashboard-target="comercial" class="text-xs font-semibold text-emerald-400">Abrir gestão comercial</button></div>
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">${commercialCards}</section>
      <section class="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-5"><h4 class="mb-3 font-bold text-white">Atenção à operação</h4><div class="grid gap-2 md:grid-cols-2">${commercialAlerts}</div><p class="mt-3 text-xs text-slate-500">Os totais de pedidos consideram os 1.000 registros mais recentes.</p></section>
      <section class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
        <article class="rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:col-span-2">
          <div class="flex items-center justify-between gap-3"><div><h4 class="font-bold text-white">Uso da área</h4><p class="mt-1 text-xs text-slate-500">Área de talhões em relação à área total</p></div><i class="fa-solid fa-chart-pie text-emerald-400" aria-hidden="true"></i></div>
          <div class="mt-6 flex items-end justify-between gap-3"><p class="text-2xl font-bold text-white">${this.formatNumber(cultivatedArea)} <span class="text-sm font-medium text-slate-400">ha</span></p><p class="text-sm font-semibold text-emerald-400">${this.formatNumber(areaPercent)}%</p></div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full bg-emerald-500 transition-all" style="width:${areaPercent}%"></div></div>
          <div class="mt-3 flex justify-between text-xs text-slate-500"><span>Área em talhões</span><span>${this.formatNumber(totalArea)} ha totais</span></div>
          <p class="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">${crops.length} cultura(s) cadastrada(s) · ${completed.length} safra(s) concluída(s)</p>
        </article>
        <article class="rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:col-span-3"><div class="mb-4 flex items-center justify-between"><div><h4 class="font-bold text-white">Safras em acompanhamento</h4><p class="mt-1 text-xs text-slate-500">Atividades em andamento e planejadas</p></div><i class="fa-solid fa-calendar-days text-emerald-400" aria-hidden="true"></i></div><div class="space-y-3">${harvestRows}</div></article>
      </section>
      <section class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <article class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div class="mb-2 flex items-center justify-between"><h4 class="font-bold text-white">Minhas propriedades</h4><button type="button" data-dashboard-target="propriedades" class="text-xs font-semibold text-emerald-400 hover:text-emerald-300">Ver todas <i class="fa-solid fa-arrow-right ml-1" aria-hidden="true"></i></button></div>${propertyContent}</article>
        <article id="dashboardQuickActions" class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h4 class="font-bold text-white">Acesso rápido</h4><p class="mt-1 text-xs text-slate-500">Continue organizando sua operação</p><div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><button type="button" data-dashboard-target="propriedades" class="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-left hover:border-emerald-500/40"><span class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400"><i class="fa-solid fa-house-chimney" aria-hidden="true"></i></span><span><strong class="block text-sm text-white">Propriedades</strong><small class="text-xs text-slate-500">Gerenciar fazendas</small></span></button><button type="button" data-dashboard-target="lotes-safras" class="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-left hover:border-emerald-500/40"><span class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300"><i class="fa-solid fa-wheat-awn" aria-hidden="true"></i></span><span><strong class="block text-sm text-white">Gestão agrícola</strong><small class="text-xs text-slate-500">Culturas e safras</small></span></button><button type="button" data-dashboard-target="financeiro" class="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-left hover:border-emerald-500/40"><span class="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300"><i class="fa-solid fa-money-bill-trend-up" aria-hidden="true"></i></span><span><strong class="block text-sm text-white">Financeiro</strong><small class="text-xs text-slate-500">Receitas e despesas</small></span></button></div></article>
      </section>`;
  },

  formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
  formatNumber(value) {
    return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  },
  formatDate(value) {
    if (!value) return '—';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
  }
};
