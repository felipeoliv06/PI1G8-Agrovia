import { supabase } from '../config/supabase.js';
import { UI } from './ui.js';

export const PropertiesModule = {
    userId: null,
    isInitialized: false,

    init(user) {
        this.userId = user.id;
        if (!this.isInitialized) {
            this.setupListeners();
            this.isInitialized = true;
        }
        this.loadProperties();
    },

    setupListeners() {
        const form = document.getElementById('propertyForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.createProperty();
            });
        }
        const grid = document.getElementById('propertiesGrid');
        if (grid) {
            grid.addEventListener('click', async (e) => {
                const editBtn = e.target.closest('.edit-prop-btn');
                if (editBtn) {
                    if (editBtn.disabled) return;
                    editBtn.disabled = true;
                    const success = await this.editProperty(editBtn.dataset.id);
                    if (!success) editBtn.disabled = false;
                    return;
                }
                const btn = e.target.closest('.delete-prop-btn');
                if (btn) {
                    if (btn.disabled) return;
                    btn.disabled = true;
                    const id = btn.dataset.id;
                    const success = await this.deleteProperty(id);
                    if (!success) btn.disabled = false;
                }
            });
        }
    },

    async loadProperties() {
        const container = document.getElementById('propertiesGrid');
        if (!container) return;
        
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center text-slate-500 py-12" aria-live="polite">
                <i class="fa-solid fa-circle-notch fa-spin text-3xl mb-3 text-emerald-500" aria-hidden="true"></i>
                <p>Sincronizando propriedades...</p>
            </div>
        `;
        try {
            const { data, error } = await supabase
                .from('properties')
                .select('id, name, total_area, location')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.renderProperties(data);
        } catch (error) {
            UI.showToast('Falha na comunicação.', 'error');
            container.innerHTML = `
                <div class="col-span-full bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 text-center text-rose-400">
                    <i class="fa-solid fa-triangle-exclamation text-3xl mb-2" aria-hidden="true"></i>
                    <p class="font-medium">Erro ao carregar dados.</p>
                    <button id="retryLoadBtn" class="mt-3 text-xs bg-rose-500/20 px-4 py-2 rounded-lg hover:bg-rose-500/30 transition-colors focus:ring-2 focus:ring-rose-400">Tentar Novamente</button>
                </div>
            `;
            document.getElementById('retryLoadBtn')?.addEventListener('click', () => this.loadProperties());
        }
    },

    async createProperty() {
        const nameInput = document.getElementById('propName');
        const areaInput = document.getElementById('propArea');
        const locationInput = document.getElementById('propLocation');

        const name = nameInput.value.trim();
        const areaRaw = areaInput.value.trim();
        const area = Number(areaRaw);
        const location = locationInput.value.trim();

        if (!name) return UI.showToast('Nome obrigatório.', 'error');
        if (!areaRaw || !Number.isFinite(area) || area <= 0) return UI.showToast('Área inválida.', 'error');

        UI.setLoading('btnSaveProperty', true);
        try {
            const { error } = await supabase.from('properties').insert([{ user_id: this.userId, name, total_area: area, location }]);
            if (error) throw error;

            UI.showToast('Propriedade registrada!', 'success');
            window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
            document.getElementById('propertyForm').reset();
            this.loadProperties();
        } catch (error) {
            UI.showToast('Erro ao salvar.', 'error');
        } finally {
            UI.setLoading('btnSaveProperty', false);
        }
    },

    async editProperty(id) {
        const property = this.currentProperties?.find(item => item.id === id);
        if (!property) {
            UI.showToast('Propriedade não encontrada. Atualize a lista.', 'error');
            return false;
        }

        const name = prompt('Nome da propriedade:', property.name);
        if (name === null) return false;
        const cleanName = name.trim();
        if (!cleanName) {
            UI.showToast('O nome da propriedade é obrigatório.', 'error');
            return false;
        }

        const areaRaw = prompt('Área total em hectares:', String(property.total_area));
        if (areaRaw === null) return false;
        const area = Number(areaRaw.replace(',', '.').trim());
        if (!Number.isFinite(area) || area <= 0) {
            UI.showToast('Informe uma área válida maior que zero.', 'error');
            return false;
        }

        const location = prompt('Localização (opcional):', property.location || '');
        if (location === null) return false;

        try {
            const { error } = await supabase.from('properties')
                .update({ name: cleanName, total_area: area, location: location.trim() || null })
                .eq('id', id);
            if (error) throw error;
            UI.showToast('Propriedade atualizada.', 'success');
            window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
            await this.loadProperties();
            return true;
        } catch (error) {
            console.error('Agrovia: erro ao atualizar propriedade', error);
            UI.showToast(error?.message || 'Erro ao atualizar propriedade.', 'error');
            return false;
        }
    },

    async deleteProperty(id) {
        if (!id || !confirm('Deseja excluir esta propriedade?')) return false;
        try {
            const { error } = await supabase.from('properties').delete().eq('id', id);
            if (error) throw error;
            
            UI.showToast('Propriedade excluída.', 'success');
            window.dispatchEvent(new CustomEvent('agrovia:dataChanged'));
            this.loadProperties();
            return true;
        } catch (error) {
            UI.showToast('Erro ao excluir.', 'error');
            return false;
        }
    },

    renderProperties(properties) {
        const container = document.getElementById('propertiesGrid');
        if (!container) return;
        
        this.currentProperties = properties || [];
        if (!properties || properties.length === 0) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center bg-slate-900/50 border border-slate-800 rounded-2xl py-12 px-4 text-center h-full min-h-[250px]">
                    <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500 text-2xl mb-4 shadow-inner">
                        <i class="fa-solid fa-map-location-dot" aria-hidden="true"></i>
                    </div>
                    <h4 class="text-white font-bold text-lg mb-1">Nenhuma propriedade</h4>
                    <p class="text-slate-400 text-sm max-w-sm">Cadastre sua primeira fazenda.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = properties.map(prop => `
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative transition-all hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 group flex flex-col justify-between h-full min-h-[160px]">
                <div class="flex justify-between items-start mb-4">
                    <div class="pr-6">
                        <h4 class="text-lg font-bold text-white truncate max-w-[200px]" title="${UI.escapeHTML(prop.name)}">${UI.escapeHTML(prop.name)}</h4>
                        <span class="text-xs text-slate-400 flex items-center gap-1 mt-1 truncate">
                            <i class="fa-solid fa-location-dot text-emerald-500/70" aria-hidden="true"></i> 
                            ${UI.escapeHTML(prop.location) || 'Local não informado'}
                        </span>
                    </div>
                    <div class="absolute top-4 right-4 flex gap-1">
                        <button data-id="${prop.id}" aria-label="Editar ${UI.escapeHTML(prop.name)}" class="edit-prop-btn text-slate-500 hover:text-emerald-400 transition-colors p-2 rounded-lg hover:bg-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500 opacity-0 group-hover:opacity-100 lg:opacity-0 sm:opacity-100">
                            <i class="fa-solid fa-pen" aria-hidden="true"></i>
                        </button>
                        <button data-id="${prop.id}" aria-label="Excluir ${UI.escapeHTML(prop.name)}" class="delete-prop-btn text-slate-500 hover:text-rose-400 transition-colors p-2 rounded-lg hover:bg-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-500 opacity-0 group-hover:opacity-100 lg:opacity-0 sm:opacity-100">
                            <i class="fa-solid fa-trash" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
                <div class="pt-4 border-t border-slate-800/80 mt-auto flex justify-between items-end">
                    <div>
                        <p class="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Área Total</p>
                        <p class="text-emerald-400 font-medium">${parseFloat(prop.total_area).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 2})} <span class="text-xs text-slate-400">ha</span></p>
                    </div>
                </div>
            </div>
        `).join('');
    }
};
