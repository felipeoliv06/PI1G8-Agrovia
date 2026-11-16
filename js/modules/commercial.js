import { supabase } from '../config/supabase.js';
import { UI } from './ui.js';

export const CommercialModule = {
  userId: null,
  tab: 'products',
  products: [],
  customers: [],
  orders: [],
  deliveries: [],
  stockMovements: [],
  properties: [],
  initialized: false,

  async init(user) {
    this.userId = user.id;
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    await this.showTab(this.tab);
  },

  bindEvents() {
    const root = document.getElementById('commercialContent');
    if (!root) return;
    document.querySelectorAll('[data-commercial-tab]').forEach(button => {
      button.addEventListener('click', () => this.showTab(button.dataset.commercialTab));
    });
    root.addEventListener('submit', async event => {
      const form = event.target;
      if (!['commercialProductForm', 'commercialCustomerForm', 'commercialOrderForm', 'commercialDeliveryForm'].includes(form.id)) return;
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        if (form.id === 'commercialProductForm') await this.saveProduct(form);
        else if (form.id === 'commercialCustomerForm') await this.saveCustomer(form);
        else if (form.id === 'commercialDeliveryForm') await this.saveDeliveryDetails(form);
        else await this.saveOrder(form);
      } catch (error) {
        console.error('Agrovia comercial:', error);
        UI.showToast(this.errorMessage(error), 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
    root.addEventListener('click', async event => {
      const action = event.target.closest('[data-commercial-action]');
      if (!action) return;
      const { commercialAction: type, id } = action.dataset;
      action.disabled = true;
      try {
        if (type === 'edit-product') this.editProduct(id);
        if (type === 'toggle-product') await this.toggleProduct(id);
        if (type === 'delete-customer') await this.deleteCustomer(id);
        if (type === 'edit-customer') this.editCustomer(id);
        if (type === 'refresh') await this.showTab(this.tab);
        if (type === 'export-orders') this.exportOrders();
        if (type === 'export-stock') this.exportStock();
        if (type === 'add-order-item') this.addOrderItem();
        if (type === 'remove-order-item') action.closest('[data-order-item-row]')?.remove();
        if (type === 'order-status') await this.changeOrderStatus(id, action.dataset.status);
        if (type === 'delivery-status') await this.changeDeliveryStatus(id, action.dataset.status);
        if (type === 'edit-delivery') this.editDelivery(id);
        if (type === 'cancel-delivery-edit') this.renderDeliveries();
      } catch (error) {
        console.error(error);
        UI.showToast(this.errorMessage(error), 'error');
      } finally {
        action.disabled = false;
      }
    });
    root.addEventListener('invalid', event => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
      field.setAttribute('aria-invalid', 'true');
      const label = field.labels?.[0]?.textContent?.trim() || field.name || 'Campo';
      const help = root.querySelector('[data-form-feedback]');
      if (help) { help.textContent = `Confira o campo “${label}” antes de continuar.`; help.hidden = false; }
    }, true);
    root.addEventListener('change', event => {
      if (event.target.matches('input,select,textarea')) event.target.removeAttribute('aria-invalid');
    });
    root.addEventListener('input', event => {
      if (event.target.id === 'commercialSearch') this.renderCurrentList(event.target.value);
    });
    root.addEventListener('change', event => {
      if (event.target.id === 'commercialOrderFilter') this.renderOrdersFilter();
      if (event.target.id === 'commercialDeliveryFilter') this.renderDeliveriesFilter();
      if (event.target.id === 'commercialStockProductFilter') this.renderStockHistory();
      if (event.target.id === 'commercialOrderFulfillment') this.toggleDeliveryFields();
    });
  },

  errorMessage(error) {
    const message = String(error?.message || '');
    if (/relation .* does not exist|could not find the table/i.test(message)) {
      return 'As tabelas comerciais ainda não existem no Supabase. A migration 06 precisa ser aplicada primeiro.';
    }
    if (/function public\.agrovia_|could not find the function/i.test(message)) return 'A integração de pedidos e financeiro precisa ser instalada no Supabase.';
    if (/row-level security|permission denied/i.test(message)) return 'O Supabase bloqueou a operação pelas regras de segurança. Confira a migration 06 e a sessão.';
    return message || 'Não foi possível concluir a operação.';
  },

  async showTab(tab) {
    this.tab = tab;
    document.querySelectorAll('[data-commercial-tab]').forEach(button => {
      const active = button.dataset.commercialTab === tab;
      button.className = `commercial-tab rounded-xl border px-4 py-2.5 text-sm font-semibold ${active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-300'}`;
      button.setAttribute('aria-selected', String(active));
    });
    const root = document.getElementById('commercialContent');
    if (!root) return;
    root.setAttribute('aria-busy', 'true');
    root.innerHTML = '<div class="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400"><i class="fa-solid fa-circle-notch fa-spin mr-2 text-emerald-400"></i>Carregando informações...</div>';
    try {
      if (tab === 'products') {
        const { data, error } = await supabase.from('products').select('*').eq('user_id', this.userId).order('name');
        if (error) throw error;
        this.products = data || [];
        this.renderProducts();
      } else if (tab === 'stock') {
        await this.loadStockHistory();
      } else if (tab === 'customers') {
        const { data, error } = await supabase.from('customers').select('*').eq('user_id', this.userId).order('name');
        if (error) throw error;
        this.customers = data || [];
        this.renderCustomers();
      } else if (tab === 'reports') {
        await this.loadReports();
      } else if (tab === 'orders') {
        const [customersResult, productsResult, propertiesResult] = await Promise.all([
          supabase.from('customers').select('id,name').eq('user_id', this.userId).order('name'),
          supabase.from('products').select('id,name,unit,sale_price,stock_quantity').eq('user_id', this.userId).eq('is_active', true).order('name'),
          supabase.from('properties').select('id,name').eq('user_id', this.userId).order('name')
        ]);
        if (customersResult.error) throw customersResult.error;
        if (productsResult.error) throw productsResult.error;
        if (propertiesResult.error) throw propertiesResult.error;
        this.properties = propertiesResult.data || [];
        this.customers = customersResult.data || [];
        this.products = productsResult.data || [];
        const { data, error } = await supabase.from('orders').select('id,order_number,order_date,status,fulfillment_type,total_amount,notes,customers(name)').eq('user_id', this.userId).order('order_date', { ascending: false }).limit(100);
        if (error) throw error;
        this.orders = data || [];
        this.renderOrders();
      } else if (tab === 'deliveries') {
        const { data, error } = await supabase.from('deliveries').select('id,status,scheduled_date,delivered_at,address,notes,orders(order_number,status,fulfillment_type,customers(name))').eq('user_id', this.userId).order('scheduled_date', { ascending: true, nullsFirst: false }).limit(100);
        if (error) throw error;
        this.deliveries = data || [];
        this.renderDeliveries();
      }
      root.setAttribute('aria-busy', 'false');
    } catch (error) {
      root.setAttribute('aria-busy', 'false');
      console.error('Carregamento comercial:', error);
      root.innerHTML = `<div class="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center"><i class="fa-solid fa-triangle-exclamation text-2xl text-rose-400"></i><p class="mt-2 font-semibold text-white">Não foi possível carregar este módulo</p><p class="mt-1 text-sm text-slate-400">${UI.escapeHTML(this.errorMessage(error))}</p><button data-commercial-action="refresh" class="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">Tentar novamente</button></div>`;
    }
  },

  money(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
  date(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('pt-BR');
  },
  formGuide(title) {
    const guides = {
      'Cadastro de produto': 'Informe o nome, a unidade e o preço. Você poderá atualizar o estoque depois.',
      'Cadastro de cliente': 'Comece pelo nome. Telefone, endereço e observações podem ser adicionados depois.'
    };
    return `<div class="agrovia-form-guide" role="note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>${guides[title] || 'Preencha os campos indicados com *.'}</span></div>`;
  },
  shell(title, subtitle, form, list) {
    return `<div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <section class="h-fit rounded-2xl border border-slate-800 bg-slate-900 p-5"><div class="mb-4"><h4 class="text-lg font-bold text-white">${title}</h4><p class="mt-1 text-xs text-slate-500">${subtitle}</p></div>${this.formGuide(title)}${form}</section>
      <section class="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:col-span-2"><div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 class="font-bold text-white">Registros cadastrados</h4><p class="text-xs text-slate-500">Informações privadas da sua operação</p></div><input id="commercialSearch" type="search" placeholder="Buscar registros..." aria-label="Buscar nos registros cadastrados" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white sm:max-w-56"></div><div id="commercialList">${list}</div></section>
    </div>`;
  },
  productForm(product = {}) {
    return `<form id="commercialProductForm" class="space-y-3">
      <input type="hidden" name="id" value="${UI.escapeHTML(product.id || '')}">
      <div><label class="commercial-label" for="cProductName">Nome do produto *</label><input class="commercial-input" id="cProductName" name="name" required maxlength="150" value="${UI.escapeHTML(product.name || '')}" placeholder="Ex.: Tomate italiano"></div>
      <div><label class="commercial-label" for="cProductDescription">Descrição</label><textarea class="commercial-input" id="cProductDescription" name="description" rows="2" maxlength="2000">${UI.escapeHTML(product.description || '')}</textarea></div>
      <div class="grid grid-cols-2 gap-3"><div><label class="commercial-label" for="cProductUnit">Unidade *</label><select class="commercial-input" id="cProductUnit" name="unit"><option ${product.unit==='kg'?'selected':''}>kg</option><option ${product.unit==='unidade' || !product.unit?'selected':''}>unidade</option><option ${product.unit==='caixa'?'selected':''}>caixa</option><option ${product.unit==='saco'?'selected':''}>saco</option><option ${product.unit==='litro'?'selected':''}>litro</option><option ${product.unit==='dúzia'?'selected':''}>dúzia</option></select></div><div><label class="commercial-label" for="cProductPrice">Preço (R$) *</label><input class="commercial-input" id="cProductPrice" name="sale_price" type="number" min="0" step="0.01" required value="${product.sale_price ?? '0'}"></div></div>
      <div class="grid grid-cols-2 gap-3"><div><label class="commercial-label" for="cProductStock">Estoque atual *</label><input class="commercial-input" id="cProductStock" name="stock_quantity" type="number" min="0" step="0.001" required value="${product.stock_quantity ?? '0'}"></div><div><label class="commercial-label" for="cProductMin">Estoque mínimo</label><input class="commercial-input" id="cProductMin" name="minimum_stock" type="number" min="0" step="0.001" value="${product.minimum_stock ?? '0'}"></div></div>
      <p class="agrovia-form-feedback" data-form-feedback role="alert" hidden></p>
      <button type="submit" class="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400">${product.id ? 'Salvar alterações' : 'Cadastrar produto'}</button>
      ${product.id ? '<button type="button" id="commercialProductCancel" class="w-full rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300">Cancelar edição</button>' : ''}
    </form>`;
  },
  renderProducts() {
    const root = document.getElementById('commercialContent');
    root.innerHTML = `<style>.commercial-input{width:100%;min-width:0;padding:10px 12px;background:#020617;border:1px solid #334155;border-radius:10px;color:#e2e8f0;font-size:13px}.commercial-label{display:block;margin-bottom:6px;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.commercial-input:focus{outline:2px solid #10b981;outline-offset:1px}</style>` +
      this.shell('Cadastro de produto', 'Registre o que você produz ou comercializa.', this.productForm(), this.productRows(this.products));
    root.querySelector('#commercialProductCancel')?.addEventListener('click', () => this.renderProducts());
  },
  productRows(rows) {
    if (!rows.length) return '<div class="py-10 text-center text-sm text-slate-500"><i class="fa-solid fa-box-open mb-2 block text-2xl"></i>Nenhum produto cadastrado ainda.</div>';
    return `<div class="space-y-2">${rows.map(p => {
      const low = Number(p.stock_quantity) <= Number(p.minimum_stock);
      return `<article class="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h5 class="font-semibold text-white">${UI.escapeHTML(p.name)}</h5><span class="rounded-full px-2 py-0.5 text-[10px] ${p.is_active?'bg-emerald-500/10 text-emerald-300':'bg-slate-800 text-slate-400'}">${p.is_active?'Ativo':'Inativo'}</span>${low && p.is_active?'<span class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">Estoque baixo</span>':''}</div><p class="mt-1 text-xs text-slate-400">${this.money(p.sale_price)} / ${UI.escapeHTML(p.unit)} · Estoque: <strong class="${low?'text-amber-300':'text-slate-200'}">${Number(p.stock_quantity).toLocaleString('pt-BR')} ${UI.escapeHTML(p.unit)}</strong> · Mínimo: ${Number(p.minimum_stock).toLocaleString('pt-BR')}</p></div>
        <div class="flex shrink-0 gap-2"><button data-commercial-action="edit-product" data-id="${p.id}" class="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:text-white">Editar</button><button data-commercial-action="toggle-product" data-id="${p.id}" class="rounded-lg border border-slate-700 px-3 py-2 text-xs ${p.is_active?'text-amber-300':'text-emerald-300'}">${p.is_active?'Inativar':'Ativar'}</button></div>
      </article>`;
    }).join('')}</div>`;
  },
  async saveProduct(form) {
    const data = new FormData(form);
    const id = String(data.get('id') || '');
    const payload = {
      user_id: this.userId, name: String(data.get('name')).trim(),
      description: String(data.get('description') || '').trim() || null,
      unit: String(data.get('unit')), sale_price: Number(data.get('sale_price')),
      stock_quantity: Number(data.get('stock_quantity')), minimum_stock: Number(data.get('minimum_stock') || 0)
    };
    if (!payload.name || !Number.isFinite(payload.sale_price) || payload.sale_price < 0 ||
        !Number.isFinite(payload.stock_quantity) || payload.stock_quantity < 0 ||
        !Number.isFinite(payload.minimum_stock) || payload.minimum_stock < 0) {
      throw new Error('Confira nome, preço e quantidades informadas.');
    }
    const query = id ? supabase.from('products').update(payload).eq('id', id).eq('user_id', this.userId)
      : supabase.from('products').insert(payload);
    const { error } = await query;
    if (error) throw error;
    UI.showToast(id ? 'Produto atualizado.' : 'Produto cadastrado.', 'success');
    await this.showTab('products');
    window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
  },
  editProduct(id) {
    const product = this.products.find(item => item.id === id);
    if (!product) return;
    const root = document.getElementById('commercialContent');
    const form = root.querySelector('section form');
    form.outerHTML = this.productForm(product);
    root.querySelector('#cProductName')?.focus();
    root.querySelector('#commercialProductCancel')?.addEventListener('click', () => this.renderProducts());
    root.querySelector('#cProductName')?.focus();
  },
  async toggleProduct(id) {
    const product = this.products.find(item => item.id === id);
    if (!product) return;
    const { error } = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', id).eq('user_id', this.userId);
    if (error) throw error;
    UI.showToast(product.is_active ? 'Produto inativado.' : 'Produto reativado.', 'success');
    await this.showTab('products');
  },

  customerForm(customer = {}) {
    return `<form id="commercialCustomerForm" class="space-y-3">
      <input type="hidden" name="id" value="${UI.escapeHTML(customer.id || '')}">
      <div><label class="commercial-label" for="cCustomerName">Nome do cliente *</label><input class="commercial-input" id="cCustomerName" name="name" required maxlength="150" value="${UI.escapeHTML(customer.name || '')}" placeholder="Nome completo ou empresa"></div>
      <div><label class="commercial-label" for="cCustomerPhone">Telefone</label><input class="commercial-input" id="cCustomerPhone" name="phone" maxlength="40" value="${UI.escapeHTML(customer.phone || '')}" placeholder="(00) 00000-0000"></div>
      <div><label class="commercial-label" for="cCustomerEmail">E-mail</label><input class="commercial-input" id="cCustomerEmail" name="email" type="email" maxlength="254" value="${UI.escapeHTML(customer.email || '')}"></div>
      <div><label class="commercial-label" for="cCustomerAddress">Endereço</label><textarea class="commercial-input" id="cCustomerAddress" name="address" rows="2" maxlength="2000">${UI.escapeHTML(customer.address || '')}</textarea></div>
      <div><label class="commercial-label" for="cCustomerNotes">Observações</label><textarea class="commercial-input" id="cCustomerNotes" name="notes" rows="2" maxlength="2000">${UI.escapeHTML(customer.notes || '')}</textarea></div>
      <p class="agrovia-form-feedback" data-form-feedback role="alert" hidden></p>
      <button type="submit" class="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400">${customer.id ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
      ${customer.id ? '<button type="button" id="commercialCustomerCancel" class="w-full rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300">Cancelar edição</button>' : ''}
    </form>`;
  },
  renderCustomers() {
    const root = document.getElementById('commercialContent');
    root.innerHTML = `<style>.commercial-input{width:100%;min-width:0;padding:10px 12px;background:#020617;border:1px solid #334155;border-radius:10px;color:#e2e8f0;font-size:13px}.commercial-label{display:block;margin-bottom:6px;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.commercial-input:focus{outline:2px solid #10b981;outline-offset:1px}</style>` +
      this.shell('Cadastro de cliente', 'Mantenha os contatos necessários para registrar e atender pedidos.', this.customerForm(), this.customerRows(this.customers));
    root.querySelector('#commercialCustomerCancel')?.addEventListener('click', () => this.renderCustomers());
  },
  customerRows(rows) {
    if (!rows.length) return '<div class="py-10 text-center text-sm text-slate-500"><i class="fa-solid fa-users mb-2 block text-2xl"></i>Nenhum cliente cadastrado ainda.</div>';
    return `<div class="space-y-2">${rows.map(c => `<article class="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div class="min-w-0"><h5 class="font-semibold text-white">${UI.escapeHTML(c.name)}</h5><p class="mt-1 text-xs text-slate-400">${UI.escapeHTML(c.phone || 'Sem telefone')} · ${UI.escapeHTML(c.email || 'Sem e-mail')}</p><p class="mt-1 truncate text-xs text-slate-500">${UI.escapeHTML(c.address || 'Endereço não informado')}</p></div><div class="flex shrink-0 gap-2"><button data-commercial-action="edit-customer" data-id="${c.id}" class="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Editar</button><button data-commercial-action="delete-customer" data-id="${c.id}" class="rounded-lg border border-slate-700 px-3 py-2 text-xs text-rose-300">Excluir</button></div></article>`).join('')}</div>`;
  },
  async saveCustomer(form) {
    const data = new FormData(form);
    const id = String(data.get('id') || '');
    const payload = { user_id: this.userId, name: String(data.get('name')).trim(), phone: String(data.get('phone') || '').trim() || null, email: String(data.get('email') || '').trim() || null, address: String(data.get('address') || '').trim() || null, notes: String(data.get('notes') || '').trim() || null };
    if (!payload.name) throw new Error('O nome do cliente é obrigatório.');
    const query = id ? supabase.from('customers').update(payload).eq('id', id).eq('user_id', this.userId) : supabase.from('customers').insert(payload);
    const { error } = await query;
    if (error) throw error;
    UI.showToast(id ? 'Cliente atualizado.' : 'Cliente cadastrado.', 'success');
    await this.showTab('customers');
  },
  editCustomer(id) {
    const customer = this.customers.find(item => item.id === id);
    if (!customer) return;
    const root = document.getElementById('commercialContent');
    root.querySelector('section form').outerHTML = this.customerForm(customer);
    root.querySelector('#cCustomerName')?.focus();
    root.querySelector('#commercialCustomerCancel')?.addEventListener('click', () => this.renderCustomers());
  },
  async deleteCustomer(id) {
    if (!confirm('Excluir este cliente? Clientes vinculados a pedidos não podem ser excluídos.')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id).eq('user_id', this.userId);
    if (error) throw error;
    UI.showToast('Cliente excluído.', 'success');
    await this.showTab('customers');
  },

  async loadReports() {
    const root = document.getElementById('commercialContent');
    const filters = this.reportFilters || { property: 'all', start: '', end: '' };
    const [products, customers, deliveries] = await Promise.all([
      supabase.from('products').select('id,name,stock_quantity,minimum_stock,is_active').eq('user_id', this.userId).order('name').limit(1000),
      supabase.from('customers').select('id').eq('user_id', this.userId).limit(1000),
      supabase.from('deliveries').select('id,status').eq('user_id', this.userId).limit(1000)
    ]);
    for (const result of [products, customers, deliveries]) if (result.error) throw result.error;
    // Paginação explícita: relatórios não ficam silenciosamente limitados a 1.000 pedidos.
    const orders = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('orders')
        .select('id,order_number,status,total_amount,order_date,property_id,customers(name)')
        .eq('user_id', this.userId).order('order_date', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + 499);
      if (error) throw error;
      orders.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    const p = products.data || [], c = customers.data || [], d = deliveries.data || [];
    const filtered = orders.filter(item => {
      const day = String(item.order_date || '').slice(0,10);
      return (filters.property === 'all' || item.property_id === filters.property) &&
        (!filters.start || day >= filters.start) && (!filters.end || day <= filters.end);
    });
    const finished = filtered.filter(item => item.status === 'Concluído');
    const revenue = finished.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
    const low = p.filter(item => item.is_active && Number(item.stock_quantity) <= Number(item.minimum_stock));
    const statuses = ['Pendente', 'Em separação', 'Pronto', 'Concluído', 'Cancelado'];
    const properties = this.properties || [];
    root.innerHTML = `<div class="space-y-5">
      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div class="mb-3 flex items-center justify-between"><h4 class="font-bold text-white">Filtrar relatórios</h4><button data-commercial-action="clear-report-filters" type="button" class="text-xs text-emerald-300">Limpar</button></div><div class="grid gap-3 sm:grid-cols-3"><div><label class="commercial-label" for="commercialReportProperty">Propriedade</label><select id="commercialReportProperty" class="commercial-input"><option value="all">Todas</option>${properties.map(item => `<option value="${item.id}" ${filters.property === item.id ? 'selected' : ''}>${UI.escapeHTML(item.name)}</option>`).join('')}</select></div><div><label class="commercial-label" for="commercialReportStart">Data inicial</label><input id="commercialReportStart" type="date" class="commercial-input" value="${filters.start}"></div><div><label class="commercial-label" for="commercialReportEnd">Data final</label><input id="commercialReportEnd" type="date" class="commercial-input" value="${filters.end}"></div></div></section>
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">${[
        ['Pedidos no período', filtered.length],
        ['Concluídos', finished.length],
        ['Em aberto', filtered.filter(item => ['Pendente','Em separação','Pronto'].includes(item.status)).length],
        ['Valor concluído', this.money(revenue)]
      ].map(([label,value]) => `<article class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p class="text-xs text-slate-400">${label}</p><p class="mt-2 text-2xl font-bold text-white">${value}</p></article>`).join('')}</div>
      <div class="grid gap-5 lg:grid-cols-2">
        <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h4 class="mb-4 font-bold text-white">Pedidos por situação</h4>${statuses.map(status => `<div class="mb-3 flex justify-between border-b border-slate-800 pb-2 text-sm"><span class="text-slate-300">${status}</span><strong class="text-white">${filtered.filter(item => item.status === status).length}</strong></div>`).join('')}<p class="mt-3 text-xs text-slate-500">Entregas em aberto (total geral): ${d.filter(item => ['Pendente','Em andamento'].includes(item.status)).length}</p></section>
        <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h4 class="mb-4 font-bold text-white">Estoque que precisa de atenção (total geral)</h4>${low.length ? low.slice(0, 12).map(item => `<div class="mb-3 flex justify-between gap-3 border-b border-slate-800 pb-2 text-sm"><span class="text-slate-200">${UI.escapeHTML(item.name)}</span><span class="shrink-0 text-amber-300">${Number(item.stock_quantity).toLocaleString('pt-BR')} / ${Number(item.minimum_stock).toLocaleString('pt-BR')}</span></div>`).join('') : '<p class="text-sm text-slate-500">Nenhum produto abaixo do estoque mínimo.</p>'}</section>
      </div>
      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div class="mb-4 flex flex-wrap items-center justify-between gap-3"><h4 class="font-bold text-white">Pedidos recentes no período</h4><button data-commercial-action="export-orders" class="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-emerald-300">Exportar CSV filtrado</button></div>${filtered.length ? filtered.slice(0, 15).map(item => `<div class="flex flex-wrap justify-between gap-3 border-b border-slate-800 py-3 text-sm"><span class="text-white">${UI.escapeHTML(item.order_number)} · ${UI.escapeHTML(item.customers?.name || 'Cliente')}</span><span class="text-slate-400">${UI.escapeHTML(item.status)} · ${this.money(item.total_amount)}</span></div>`).join('') : '<p class="text-sm text-slate-500">Nenhum pedido no período selecionado.</p>'}</section>
      <p class="text-xs text-slate-500">Produtos e entregas são indicadores gerais; os filtros de propriedade e data aplicam-se aos pedidos e ao CSV.</p>
      <style>.commercial-input{width:100%;min-width:0;padding:10px 12px;background:#020617;border:1px solid #334155;border-radius:10px;color:#e2e8f0;font-size:13px}.commercial-label{display:block;margin-bottom:6px;color:#94a3b8;font-size:11px;font-weight:700}</style>
    </div>`;
    this.reportOrders = filtered;
    for (const id of ['commercialReportProperty','commercialReportStart','commercialReportEnd']) {
      root.querySelector('#' + id)?.addEventListener('change', event => {
        const key = ({ commercialReportProperty:'property', commercialReportStart:'start', commercialReportEnd:'end' })[id];
        this.reportFilters = { ...filters, [key]: event.target.value };
        this.loadReports().catch(error => UI.showToast(this.errorMessage(error), 'error'));
      });
    }
    root.querySelector('[data-commercial-action="clear-report-filters"]')?.addEventListener('click', () => {
      this.reportFilters = { property:'all', start:'', end:'' };
      this.loadReports().catch(error => UI.showToast(this.errorMessage(error), 'error'));
    });
  },

  exportOrders() {
    const clean = value => { const raw = String(value ?? '').replace(/\r?\n/g, ' '); return `"${(/^[\s]*[=+@-]/.test(raw) ? "'" : '') + raw.replace(/"/g, '""')}"`; };
    const rows = [['Pedido', 'Data', 'Cliente', 'Situação', 'Total'], ...(this.reportOrders || []).map(o => [o.order_number, o.order_date, o.customers?.name || '', o.status, o.total_amount])];
    const csv = '\uFEFF' + rows.map(row => row.map(clean).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'agrovia_pedidos.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  renderOrders() {
    const root = document.getElementById('commercialContent');
    const customers = this.customers.map(c => `<option value="${c.id}">${UI.escapeHTML(c.name)}</option>`).join('');
    const canCreate = this.customers.length && this.products.length && this.properties.length;
    root.innerHTML = `<div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <section class="h-fit rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h4 class="mb-1 text-lg font-bold text-white">Registrar pedido recebido</h4>
        <p class="mb-4 text-xs text-slate-400">Registro interno, sem checkout ou venda pela internet. O estoque é reservado ao salvar.</p><div class="agrovia-form-guide" role="note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>Escolha o cliente e a propriedade, adicione os produtos e confira as quantidades antes de registrar.</span></div>
        ${canCreate ? `<form id="commercialOrderForm" class="space-y-3">
          <label class="commercial-label" for="commercialOrderCustomer">Cliente</label><select class="commercial-input" id="commercialOrderCustomer" name="customer_id" required>${customers}</select>
          <label class="commercial-label" for="commercialOrderProperty">Propriedade vinculada *</label><select class="commercial-input" id="commercialOrderProperty" name="property_id" required><option value="">Selecione a propriedade</option>${this.properties.map(p => `<option value="${p.id}">${UI.escapeHTML(p.name)}</option>`).join('')}</select>
          <p class="text-xs text-slate-500">Ao concluir o pedido, uma receita será registrada automaticamente nesta propriedade.</p>
          <label class="commercial-label" for="commercialOrderFulfillment">Atendimento</label><select class="commercial-input" id="commercialOrderFulfillment" name="fulfillment_type"><option>Entrega</option><option>Retirada</option></select>
          <div id="commercialDeliveryFields"><label class="commercial-label" for="commercialOrderAddress">Endereço da entrega</label><textarea class="commercial-input" id="commercialOrderAddress" name="address" rows="2" maxlength="1000"></textarea><label class="commercial-label" for="commercialOrderDate">Data prevista</label><input class="commercial-input" id="commercialOrderDate" name="scheduled_date" type="date"></div>
          <div class="flex items-center justify-between"><span class="commercial-label">Itens do pedido</span><button type="button" data-commercial-action="add-order-item" class="text-xs font-semibold text-emerald-400">+ Produto</button></div>
          <div id="commercialOrderItems" class="space-y-2"></div>
          <label class="commercial-label" for="commercialOrderNotes">Observações</label><textarea class="commercial-input" id="commercialOrderNotes" name="notes" rows="2" maxlength="2000"></textarea>
          <p class="agrovia-form-feedback" data-form-feedback role="alert" hidden></p>
          <button type="submit" class="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950">Registrar pedido</button>
        </form>` : `<p class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">Cadastre uma propriedade, um cliente e um produto ativo antes de registrar pedidos.</p>`}
      </section>
      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:col-span-2"><div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 class="text-lg font-bold text-white">Pedidos registrados</h4><p class="text-xs text-slate-500">Histórico de pedidos recebidos pelo produtor.</p></div><select id="commercialOrderFilter" class="commercial-input sm:max-w-52"><option value="Todos">Todos os status</option>${['Pendente','Em separação','Pronto','Concluído','Cancelado'].map(v=>`<option>${v}</option>`).join('')}</select></div><div id="commercialList">${this.orderRows(this.orders)}</div></section>
    </div>`;
    if (canCreate) this.addOrderItem();
  },
  addOrderItem() {
    const container = document.getElementById('commercialOrderItems');
    if (!container || container.children.length >= 50) return;
    const options = this.products.map(p => `<option value="${p.id}">${UI.escapeHTML(p.name)} · ${this.money(p.sale_price)} / ${UI.escapeHTML(p.unit)} · ${Number(p.stock_quantity).toLocaleString('pt-BR')} disponíveis</option>`).join('');
    container.insertAdjacentHTML('beforeend', `<div data-order-item-row class="flex items-end gap-2 rounded-lg border border-slate-800 p-2"><div class="min-w-0 flex-1"><label class="commercial-label">Produto</label><select data-order-product class="commercial-input" required>${options}</select></div><div class="w-24"><label class="commercial-label">Qtd.</label><input data-order-quantity type="number" min="0.001" step="0.001" value="1" required class="commercial-input"></div><button type="button" aria-label="Remover item" data-commercial-action="remove-order-item" class="rounded-lg border border-slate-700 px-3 py-2 text-rose-300">×</button></div>`);
  },
  toggleDeliveryFields() {
    document.getElementById('commercialDeliveryFields')?.classList.toggle('hidden', document.getElementById('commercialOrderFulfillment')?.value !== 'Entrega');
  },
  async saveOrder(form) {
    const data = new FormData(form);
    const rows = [...form.querySelectorAll('[data-order-item-row]')];
    if (!rows.length) throw new Error('Adicione pelo menos um produto.');
    const items = rows.map(row => ({ product_id: row.querySelector('[data-order-product]').value, quantity: Number(row.querySelector('[data-order-quantity]').value) }));
    if (items.some(i => !Number.isFinite(i.quantity) || i.quantity <= 0 || Math.abs(Math.round(i.quantity * 1000) - i.quantity * 1000) > 1e-7)) throw new Error('Confira as quantidades (até três casas decimais).');
    if (new Set(items.map(i => i.product_id)).size !== items.length) throw new Error('Não repita o mesmo produto: some as quantidades em um item.');
    const fulfillment = String(data.get('fulfillment_type'));
    const propertyId = String(data.get('property_id') || '');
    if (!this.properties.some(p => p.id === propertyId)) throw new Error('Selecione uma propriedade válida.');
    const { error } = await supabase.rpc('agrovia_create_order_with_property', {
      p_property_id: propertyId,
      p_customer_id: String(data.get('customer_id')),
      p_fulfillment_type: fulfillment,
      p_items: items,
      p_notes: String(data.get('notes') || '').trim() || null,
      p_address: fulfillment === 'Entrega' ? String(data.get('address') || '').trim() || null : null,
      p_scheduled_date: fulfillment === 'Entrega' && data.get('scheduled_date') ? `${data.get('scheduled_date')}T12:00:00-03:00` : null
    });
    if (error) throw error;
    UI.showToast('Pedido registrado e estoque reservado.', 'success');
    await this.showTab('orders');
    window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
  },
  orderRows(rows) {
    const filter = document.getElementById('commercialOrderFilter')?.value || 'Todos';
    const visible = rows.filter(o => filter === 'Todos' || o.status === filter);
    if (!visible.length) return '<div class="py-10 text-center text-sm text-slate-500">Nenhum pedido encontrado.</div>';
    return `<div class="space-y-2">${visible.map(o => {
      const next = { 'Pendente':'Em separação', 'Em separação':'Pronto', 'Pronto': o.fulfillment_type === 'Retirada' ? 'Concluído' : null }[o.status];
      return `<article class="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h5 class="font-semibold text-white">Pedido ${UI.escapeHTML(o.order_number)}</h5><p class="mt-1 text-xs text-slate-400">${UI.escapeHTML(o.customers?.name || 'Cliente')} · ${this.date(o.order_date)} · ${UI.escapeHTML(o.fulfillment_type)}</p></div><div class="sm:text-right"><p class="font-semibold text-emerald-300">${this.money(o.total_amount)}</p><span class="text-xs text-slate-400">${UI.escapeHTML(o.status)}</span></div></div>${next || !['Cancelado','Concluído'].includes(o.status) ? `<div class="mt-3 flex flex-wrap gap-2">${next ? `<button data-commercial-action="order-status" data-id="${o.id}" data-status="${next}" class="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300">${UI.escapeHTML(next)}</button>` : ''}${!['Cancelado','Concluído'].includes(o.status) ? `<button data-commercial-action="order-status" data-id="${o.id}" data-status="Cancelado" class="rounded-lg border border-rose-500/30 px-3 py-2 text-xs text-rose-300">Cancelar e devolver estoque</button>` : ''}</div>` : ''}</article>`;
    }).join('')}</div>`;
  },
  async changeOrderStatus(id, status) {
    if (status === 'Cancelado' && !confirm('Cancelar o pedido e devolver as quantidades ao estoque?')) return;
    const { error } = await supabase.rpc('agrovia_change_order_status', { p_order_id: id, p_new_status: status });
    if (error) throw error;
    UI.showToast('Status do pedido atualizado.', 'success');
    await this.showTab('orders');
    window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
  },
  renderDeliveries() {
    const root = document.getElementById('commercialContent');
    root.innerHTML = `<section class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 class="text-lg font-bold text-white">Entregas</h4><p class="text-xs text-slate-500">Atendimento de pedidos registrados, sem rastreamento público.</p></div><select id="commercialDeliveryFilter" class="commercial-input sm:max-w-52"><option value="Todos">Todos os status</option>${['Pendente','Em andamento','Entregue','Cancelada'].map(v=>`<option>${v}</option>`).join('')}</select></div><div id="commercialList">${this.deliveryRows(this.deliveries)}</div></section>`;
  },
  deliveryRows(rows) {
    const filter = document.getElementById('commercialDeliveryFilter')?.value || 'Todos';
    const visible = rows.filter(d => filter === 'Todos' || d.status === filter);
    if (!visible.length) return '<div class="py-10 text-center text-sm text-slate-500">Nenhuma entrega registrada.</div>';
    return `<div class="space-y-2">${visible.map(d => {
      const next = { 'Pendente':'Em andamento', 'Em andamento':'Entregue' }[d.status];
      return `<article class="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h5 class="font-semibold text-white">Pedido ${UI.escapeHTML(d.orders?.order_number || '—')} · ${UI.escapeHTML(d.orders?.customers?.name || 'Cliente')}</h5><p class="mt-1 text-xs text-slate-400">${this.date(d.scheduled_date)} · ${UI.escapeHTML(d.address || 'Endereço não informado')}</p></div><span class="text-xs text-slate-300">${UI.escapeHTML(d.status)}</span></div>${next ? `<button data-commercial-action="delivery-status" data-id="${d.id}" data-status="${next}" class="mt-3 rounded-lg border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300">Marcar: ${UI.escapeHTML(next)}</button>` : ''}${next && !['Cancelado','Concluído'].includes(d.orders?.status) ? `<button data-commercial-action="edit-delivery" data-id="${d.id}" class="mt-3 ml-2 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200">Editar dados</button>` : ''}<p class="mt-2 text-xs text-slate-500">${UI.escapeHTML(d.notes || 'Sem observações')}</p></article>`;
    }).join('')}</div>`;
  },
  editDelivery(id) {
    const delivery = this.deliveries.find(item => item.id === id);
    if (!delivery || ['Entregue','Cancelada'].includes(delivery.status) || ['Concluído','Cancelado'].includes(delivery.orders?.status)) return;
    const root = document.getElementById('commercialContent');
    const date = delivery.scheduled_date ? new Date(delivery.scheduled_date).toISOString().slice(0, 10) : '';
    root.innerHTML = `<section class="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h4 class="mb-1 text-lg font-bold text-white">Editar entrega</h4><p class="mb-5 text-sm text-slate-400">Pedido ${UI.escapeHTML(delivery.orders?.order_number || '')}</p>
      <div class="agrovia-form-guide" role="note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>Atualize apenas os dados que precisam mudar. As informações serão salvas nesta entrega.</span></div><form id="commercialDeliveryForm" class="space-y-4">
      <input type="hidden" name="id" value="${delivery.id}">
      <div><label class="commercial-label" for="deliveryAddress">Endereço</label><textarea id="deliveryAddress" name="address" maxlength="1000" rows="3" class="commercial-input">${UI.escapeHTML(delivery.address || '')}</textarea></div>
      <div><label class="commercial-label" for="deliveryDate">Data prevista</label><input id="deliveryDate" name="scheduled_date" type="date" class="commercial-input" value="${date}"></div>
      <div><label class="commercial-label" for="deliveryNotes">Observações</label><textarea id="deliveryNotes" name="notes" maxlength="2000" rows="3" class="commercial-input">${UI.escapeHTML(delivery.notes || '')}</textarea></div>
      <p class="agrovia-form-feedback" data-form-feedback role="alert" hidden></p><div class="flex flex-wrap gap-2"><button type="submit" class="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950">Salvar alterações</button><button type="button" data-commercial-action="cancel-delivery-edit" class="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300">Voltar</button></div>
      </form></section>`;
    root.querySelector('#deliveryAddress')?.focus();
  },
  async saveDeliveryDetails(form) {
    const data = new FormData(form);
    const date = String(data.get('scheduled_date') || '');
    const { error } = await supabase.rpc('agrovia_update_delivery_details', {
      p_delivery_id: String(data.get('id')),
      p_address: String(data.get('address') || '').trim() || null,
      p_scheduled_date: date ? `${date}T12:00:00-03:00` : null,
      p_notes: String(data.get('notes') || '').trim() || null
    });
    if (error) throw error;
    UI.showToast('Dados da entrega atualizados.', 'success');
    await this.showTab('deliveries');
    window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
  },
  async changeDeliveryStatus(id, status) {
    if (status === 'Entregue' && !confirm('Confirmar que a entrega foi concluída?')) return;
    const { error } = await supabase.rpc('agrovia_change_delivery_status', { p_delivery_id: id, p_new_status: status });
    if (error) throw error;
    UI.showToast('Entrega atualizada.', 'success');
    await this.showTab('deliveries');
    window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
  },
  async loadStockHistory() {
    const [movements, products] = await Promise.all([
      supabase.from('stock_movements').select('id,product_id,movement_type,quantity_change,previous_quantity,new_quantity,reason,created_at').eq('user_id',this.userId).order('created_at',{ascending:false}).limit(500),
      supabase.from('products').select('id,name,unit').eq('user_id',this.userId).order('name')
    ]);
    if (movements.error) throw movements.error;
    if (products.error) throw products.error;
    this.stockMovements = movements.data || [];
    this.stockProducts = products.data || [];
    const root=document.getElementById('commercialContent');
    root.innerHTML=`<section class="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h4 class="text-lg font-bold text-white">Histórico de movimentações</h4><p class="text-xs text-slate-400">Entradas, saídas e alterações de estoque registradas automaticamente. Últimos 500 registros.</p></div><button type="button" data-commercial-action="export-stock" class="rounded-lg border border-emerald-500/30 px-3 py-2 text-sm text-emerald-300">Exportar CSV</button></div>
      <label class="mb-2 block text-xs text-slate-400" for="commercialStockProductFilter">Filtrar por produto</label>
      <select id="commercialStockProductFilter" class="mb-4 w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Todos os produtos</option>${this.stockProducts.map(p=>`<option value="${p.id}">${UI.escapeHTML(p.name)}</option>`).join('')}</select>
      <div id="commercialStockList"></div></section>`;
    this.renderStockHistory();
  },
  filteredStockMovements() {
    const selected=document.getElementById('commercialStockProductFilter')?.value || '';
    return this.stockMovements.filter(m=>!selected || m.product_id===selected);
  },
  renderStockHistory() {
    const list=document.getElementById('commercialStockList');
    if (!list) return;
    const movements=this.filteredStockMovements();
    const productMap=new Map(this.stockProducts.map(p=>[p.id,p]));
    list.innerHTML=movements.length ? `<div class="space-y-2">${movements.map(m=>{
      const product=productMap.get(m.product_id);
      const qty=Number(m.quantity_change);
      const formatted=(qty>0?'+':'')+qty.toLocaleString('pt-BR',{maximumFractionDigits:3});
      return `<article class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div><h5 class="font-semibold text-white">${UI.escapeHTML(product?.name || 'Produto indisponível')}</h5><p class="mt-1 text-xs text-slate-400">${UI.escapeHTML(m.movement_type)} · ${UI.escapeHTML(m.reason)} · ${new Date(m.created_at).toLocaleString('pt-BR')}</p><p class="mt-1 text-xs text-slate-500">Antes: ${Number(m.previous_quantity).toLocaleString('pt-BR')} · Depois: ${Number(m.new_quantity).toLocaleString('pt-BR')} ${UI.escapeHTML(product?.unit||'')}</p></div><strong class="${qty>=0?'text-emerald-300':'text-amber-300'}">${formatted} ${UI.escapeHTML(product?.unit||'')}</strong></article>`;
    }).join('')}</div>`:'<p class="py-10 text-center text-sm text-slate-400">Nenhuma movimentação encontrada.</p>';
  },
  exportStock() {
    const productMap=new Map(this.stockProducts.map(p=>[p.id,p]));
    const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const rows=[['Data','Produto','Tipo','Variação','Antes','Depois','Motivo'],...this.filteredStockMovements().map(m=>[new Date(m.created_at).toLocaleString('pt-BR'),productMap.get(m.product_id)?.name||'',m.movement_type,m.quantity_change,m.previous_quantity,m.new_quantity,m.reason])];
    const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(esc).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='agrovia_historico_estoque.csv';a.click();URL.revokeObjectURL(url);
  },
  renderCurrentList(query) {
    const list = document.getElementById('commercialList');
    if (!list) return;
    const q = String(query || '').trim().toLocaleLowerCase('pt-BR');
    if (this.tab === 'products') list.innerHTML = this.productRows(this.products.filter(p => `${p.name} ${p.description || ''}`.toLocaleLowerCase('pt-BR').includes(q)));
    if (this.tab === 'customers') list.innerHTML = this.customerRows(this.customers.filter(c => `${c.name} ${c.phone || ''} ${c.email || ''}`.toLocaleLowerCase('pt-BR').includes(q)));
  },
  renderOrdersFilter() {
    const list = document.getElementById('commercialList');
    if (list) list.innerHTML = this.orderRows(this.orders);
  },
  renderDeliveriesFilter() {
    const list = document.getElementById('commercialList');
    if (list) list.innerHTML = this.deliveryRows(this.deliveries);
  }
};
