import { supabase } from '../config/supabase.js';
import { UI } from './ui.js';

export const AgriculturalModule = {
  userId: null,
  initialized: false,
  cache: { properties: [], crops: [], fields: [], harvests: [] },

  async init(user) {
    this.userId = user.id;
    this.renderShell();
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    await this.reload();
  },

  renderShell() {
    const root = document.getElementById('lotes-safras');
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';
    root.className = 'view-section hidden animate-fade-in';
    root.innerHTML = `
      <div class="mb-6"><h3 class="font-bold text-white text-2xl tracking-tight">Gestão Agrícola</h3><p class="text-sm text-slate-400 mt-1">Culturas, talhões e safras da sua operação</p></div>
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section class="bg-slate-900 border border-slate-800 rounded-2xl p-5"><h4 class="text-lg font-bold mb-4 text-white">Culturas</h4>
          <form id="cropForm" class="space-y-3 mb-5"><input id="cropName" required maxlength="255" placeholder="Nome da cultura (ex.: Soja)" class="ag-input"><textarea id="cropDescription" rows="2" placeholder="Descrição (opcional)" class="ag-input"></textarea><button class="ag-submit" type="submit">Cadastrar cultura</button></form><div id="cropList" class="space-y-2" aria-live="polite"></div>
        </section>
        <section class="bg-slate-900 border border-slate-800 rounded-2xl p-5"><h4 class="text-lg font-bold mb-4 text-white">Talhões</h4>
          <form id="fieldForm" class="space-y-3 mb-5"><select id="fieldProperty" required class="ag-input"><option value="">Selecione a propriedade</option></select><input id="fieldName" required maxlength="255" placeholder="Nome do talhão" class="ag-input"><input id="fieldCode" maxlength="100" placeholder="Identificação (opcional)" class="ag-input"><input id="fieldArea" type="number" min="0.01" step="0.01" required placeholder="Área em hectares" class="ag-input"><textarea id="fieldDescription" rows="2" placeholder="Descrição (opcional)" class="ag-input"></textarea><button class="ag-submit" type="submit">Cadastrar talhão</button></form><div id="fieldList" class="space-y-2" aria-live="polite"></div>
        </section>
        <section class="bg-slate-900 border border-slate-800 rounded-2xl p-5"><h4 class="text-lg font-bold mb-4 text-white">Safras</h4>
          <form id="harvestForm" class="space-y-3 mb-5"><input id="harvestName" required maxlength="255" placeholder="Nome da safra (ex.: Safra 2026/27)" class="ag-input"><select id="harvestField" required class="ag-input"><option value="">Selecione o talhão</option></select><select id="harvestCrop" required class="ag-input"><option value="">Selecione a cultura</option></select><label class="block text-xs text-slate-400">Início<input id="harvestStart" type="date" required class="ag-input mt-1"></label><label class="block text-xs text-slate-400">Previsão de término<input id="harvestEnd" type="date" class="ag-input mt-1"></label><select id="harvestStatus" class="ag-input"><option>Planejada</option><option>Em Andamento</option><option>Concluída</option><option>Cancelada</option></select><textarea id="harvestNotes" rows="2" placeholder="Observações (opcional)" class="ag-input"></textarea><button class="ag-submit" type="submit">Cadastrar safra</button></form><div id="harvestList" class="space-y-2" aria-live="polite"></div>
        </section>
      </div>
      <style>.ag-input{width:100%;padding:10px 12px;background:#020617;border:1px solid #334155;border-radius:10px;color:#e2e8f0;font-size:13px}.ag-input:focus{outline:2px solid #10b981;outline-offset:1px}.ag-submit{width:100%;padding:10px;background:#10b981;color:#022c22;font-weight:700;border-radius:10px;font-size:13px}.ag-submit:disabled{opacity:.55}.ag-item{padding:11px;background:#0f172a;border:1px solid #1e293b;border-radius:10px}.ag-delete{color:#fb7185;font-size:12px;padding:4px 7px}.ag-empty{font-size:12px;color:#94a3b8;padding:12px;text-align:center}</style>`;
  },

  bindEvents() {
    const root = document.getElementById('lotes-safras');
    root.addEventListener('submit', async (event) => {
      const form = event.target;
      if (!['cropForm', 'fieldForm', 'harvestForm'].includes(form.id)) return;
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        if (form.id === 'cropForm') await this.createCrop();
        if (form.id === 'fieldForm') await this.createField();
        if (form.id === 'harvestForm') await this.createHarvest();
        form.reset();
        await this.reload();
        window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
        UI.showToast('Cadastro salvo com sucesso!', 'success');
      } catch (error) {
        console.error('Agrovia:', error);
        UI.showToast(this.errorMessage(error), 'error');
      } finally { button.disabled = false; }
    });
    root.addEventListener('click', async (event) => {
      const editButton = event.target.closest('[data-edit-type]');
      if (editButton && !editButton.disabled) {
        editButton.disabled = true;
        try { await this.editRecord(editButton.dataset.editType, editButton.dataset.id); }
        finally { editButton.disabled = false; }
        return;
      }
      const button = event.target.closest('[data-delete-type]');
      if (!button || button.disabled) return;
      const type = button.dataset.deleteType;
      const id = button.dataset.id;
      if (!['crops', 'fields', 'harvests'].includes(type)) return;
      if (!confirm('Confirma a exclusão deste registro?')) return;
      button.disabled = true;
      try {
        const { error } = await supabase.from(type).delete().eq('id', id);
        if (error) throw error;
        await this.reload();
        window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
        UI.showToast('Registro excluído.', 'success');
      } catch (error) {
        UI.showToast(this.errorMessage(error), 'error');
        button.disabled = false;
      }
    });
    root.addEventListener('change', async (event) => {
      const select = event.target.closest('[data-harvest-status]');
      if (!select) return;
      const { error } = await supabase.from('harvests').update({ status: select.value }).eq('id', select.dataset.harvestStatus);
      if (error) { UI.showToast(this.errorMessage(error), 'error'); await this.reload(); }
      else { window.dispatchEvent(new CustomEvent('agrovia:dataChanged')); UI.showToast('Status da safra atualizado.', 'success'); }
    });
  },

  async reload() {
    const queries = await Promise.all([
      supabase.from('properties').select('id,name,total_area').order('name'),
      supabase.from('crops').select('id,name,description').order('name'),
      supabase.from('fields').select('id,name,identification,area,property_id,properties(name)').order('name'),
      supabase.from('harvests').select('id,name,start_date,expected_end_date,status,notes,field_id,crop_id,fields(name),crops(name)').order('start_date', { ascending: false })
    ]);
    const [properties, crops, fields, harvests] = queries;
    for (const result of queries) if (result.error) throw result.error;
    this.cache = { properties: properties.data || [], crops: crops.data || [], fields: fields.data || [], harvests: harvests.data || [] };
    this.renderLists();
  },

  async editRecord(type, id) {
    const collection = { crops: 'crops', fields: 'fields', harvests: 'harvests' }[type];
    const record = this.cache[collection]?.find(item => item.id === id);
    if (!record) { UI.showToast('Registro não encontrado. Atualize a lista.', 'error'); return; }

    const ask = (label, current) => prompt(label, current ?? '');
    const updates = {};
    if (type === 'crops') {
      const name = ask('Nome da cultura:', record.name);
      if (name === null) return;
      if (!name.trim()) throw new Error('O nome da cultura é obrigatório.');
      const description = ask('Descrição (opcional):', record.description || '');
      if (description === null) return;
      Object.assign(updates, { name: name.trim(), description: description.trim() || null });
    } else if (type === 'fields') {
      const name = ask('Nome do talhão:', record.name);
      if (name === null) return;
      if (!name.trim()) throw new Error('O nome do talhão é obrigatório.');
      const identification = ask('Identificação (opcional):', record.identification || '');
      if (identification === null) return;
      const areaRaw = ask('Área em hectares:', String(record.area));
      if (areaRaw === null) return;
      const area = Number(areaRaw.replace(',', '.').trim());
      if (!Number.isFinite(area) || area <= 0) throw new Error('Informe uma área válida maior que zero.');
      Object.assign(updates, { name: name.trim(), identification: identification.trim() || null, area });
    } else {
      const name = ask('Nome da safra:', record.name);
      if (name === null) return;
      if (!name.trim()) throw new Error('O nome da safra é obrigatório.');
      const start = ask('Data de início (AAAA-MM-DD):', record.start_date);
      if (start === null) return;
      const end = ask('Previsão de término (AAAA-MM-DD, opcional):', record.expected_end_date || '');
      if (end === null) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || (end.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(end.trim()))) throw new Error('Informe datas no formato AAAA-MM-DD.');
      if (end.trim() && end.trim() < start) throw new Error('A previsão de término não pode ser anterior ao início.');
      const notes = ask('Observações (opcional):', record.notes || '');
      if (notes === null) return;
      Object.assign(updates, { name: name.trim(), start_date: start, expected_end_date: end.trim() || null, notes: notes.trim() || null });
    }

    try {
      const { error } = await supabase.from(collection).update(updates).eq('id', id);
      if (error) throw error;
      await this.reload();
      window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
      UI.showToast('Registro atualizado com sucesso.', 'success');
    } catch (error) {
      UI.showToast(this.errorMessage(error), 'error');
    }
  },

  async createCrop() {
    const name = document.getElementById('cropName').value.trim();
    if (!name) throw new Error('Informe o nome da cultura.');
    const { error } = await supabase.from('crops').insert({ user_id: this.userId, name, description: document.getElementById('cropDescription').value.trim() || null });
    if (error) throw error;
  },
  async createField() {
    const area = Number(document.getElementById('fieldArea').value);
    if (!Number.isFinite(area) || area <= 0) throw new Error('Informe uma área válida.');
    const { error } = await supabase.from('fields').insert({ property_id: document.getElementById('fieldProperty').value, name: document.getElementById('fieldName').value.trim(), identification: document.getElementById('fieldCode').value.trim() || null, area, description: document.getElementById('fieldDescription').value.trim() || null });
    if (error) throw error;
  },
  async createHarvest() {
    const start = document.getElementById('harvestStart').value;
    const end = document.getElementById('harvestEnd').value || null;
    if (end && end < start) throw new Error('A previsão de término não pode ser anterior ao início.');
    const { error } = await supabase.from('harvests').insert({ name: document.getElementById('harvestName').value.trim(), field_id: document.getElementById('harvestField').value, crop_id: document.getElementById('harvestCrop').value, start_date: start, expected_end_date: end, status: document.getElementById('harvestStatus').value, notes: document.getElementById('harvestNotes').value.trim() || null });
    if (error) throw error;
  },

  renderLists() {
    const { properties, crops, fields, harvests } = this.cache;
    const setOptions = (id, rows, label) => {
      const select = document.getElementById(id);
      const old = select.value;
      select.innerHTML = `<option value="">${label}</option>` + rows.map(row => `<option value="${row.id}">${UI.escapeHTML(row.name)}</option>`).join('');
      if (rows.some(row => row.id === old)) select.value = old;
    };
    setOptions('fieldProperty', properties, 'Selecione a propriedade');
    setOptions('harvestField', fields, 'Selecione o talhão');
    setOptions('harvestCrop', crops, 'Selecione a cultura');
    const render = (id, rows, type, detail) => {
      document.getElementById(id).innerHTML = rows.length ? rows.map(row => `<div class="ag-item flex justify-between gap-2 items-start"><div class="min-w-0"><p class="text-sm text-slate-100 font-semibold break-words">${UI.escapeHTML(row.name)}</p><p class="text-xs text-slate-400 mt-1">${detail(row)}</p></div><div class="flex gap-2 shrink-0"><button type="button" class="text-xs text-emerald-400 px-1" data-edit-type="${type}" data-id="${row.id}" aria-label="Editar ${UI.escapeHTML(row.name)}">Editar</button><button type="button" class="ag-delete" data-delete-type="${type}" data-id="${row.id}" aria-label="Excluir ${UI.escapeHTML(row.name)}">Excluir</button></div></div>`).join('') : '<p class="ag-empty">Nenhum registro cadastrado.</p>';
    };
    render('cropList', crops, 'crops', row => UI.escapeHTML(row.description || 'Cultura cadastrada'));
    render('fieldList', fields, 'fields', row => `${UI.escapeHTML(row.properties?.name || 'Propriedade')} · ${Number(row.area).toLocaleString('pt-BR')} ha${row.identification ? ` · ${UI.escapeHTML(row.identification)}` : ''}`);
    document.getElementById('harvestList').innerHTML = harvests.length ? harvests.map(row => `<div class="ag-item"><div class="flex justify-between gap-2"><div class="min-w-0"><p class="text-sm text-slate-100 font-semibold">${UI.escapeHTML(row.name)}</p><p class="text-xs text-slate-400 mt-1">${UI.escapeHTML(row.crops?.name || 'Cultura')} · ${UI.escapeHTML(row.fields?.name || 'Talhão')}</p><p class="text-xs text-slate-500 mt-1">Início: ${this.formatDate(row.start_date)}${row.expected_end_date ? ` · Previsão: ${this.formatDate(row.expected_end_date)}` : ''}</p></div><div class="flex gap-2 shrink-0"><button type="button" class="text-xs text-emerald-400" data-edit-type="harvests" data-id="${row.id}">Editar</button><button type="button" class="ag-delete" data-delete-type="harvests" data-id="${row.id}">Excluir</button></div></div><select class="ag-input mt-3" data-harvest-status="${row.id}" aria-label="Status de ${UI.escapeHTML(row.name)}">${['Planejada','Em Andamento','Concluída','Cancelada'].map(s => `<option ${s === row.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>`).join('') : '<p class="ag-empty">Nenhuma safra cadastrada.</p>';
    const hasProperties = properties.length > 0;
    document.getElementById('fieldForm').querySelector('button').disabled = !hasProperties;
    document.getElementById('harvestForm').querySelector('button').disabled = !fields.length || !crops.length;
  },
  formatDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '—'; },
  errorMessage(error) {
    if (error?.code === '23505') return 'Já existe um cadastro com esse nome.';
    if (error?.code === '23503') return 'Não foi possível excluir: há registros vinculados a este item.';
    if (error?.code === '42501') return 'Acesso não autorizado. Confira sua sessão.';
    return error?.message || 'Não foi possível concluir a operação.';
  }
};
