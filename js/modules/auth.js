import { supabase } from '../config/supabase.js';
import { UI } from './ui.js';

export const Auth = {
    isInitialized: false,

    async initialize() {
        if (this.isInitialized) return;
        
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.get('type') === 'recovery') {
            this.showUpdatePasswordScreen();
            window.history.replaceState(null, '', window.location.pathname);
        }

        try {
            // Subscribe before reading the initial session so auth events are not missed.
            supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' && session && !document.getElementById('updatePasswordScreen')?.classList.contains('active')) {
                    this.proceedToDashboard(session.user);
                } else if (event === 'SIGNED_OUT') {
                    this.showLoginScreen();
                } else if (event === 'PASSWORD_RECOVERY') {
                    this.showUpdatePasswordScreen();
                }
            });

            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;

            if (session && hashParams.get('type') !== 'recovery') {
                this.proceedToDashboard(session.user);
            } else if (!hashParams.get('type')) {
                this.showLoginScreen();
            }
            this.isInitialized = true;
        } catch (error) {
            console.error('Erro Auth:', error);
            UI.showToast('Erro de conexão com o servidor.', 'error');
            this.showLoginScreen();
        }
    },

    async signUp(email, password, name) {
        UI.setLoading('submitBtn', true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email, password, options: { data: { full_name: name } }
            });
            if (error) throw error;
            UI.showToast('Conta criada! Verifique seu e-mail ou faça login.', 'success');
            if (data.session) this.proceedToDashboard(data.session.user);
            else document.getElementById('toggleModeBtn').click();
        } catch (error) {
            this.showErrorMsg(error.message);
        } finally {
            UI.setLoading('submitBtn', false);
        }
    },

    async signIn(email, password) {
        UI.setLoading('submitBtn', true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw new Error('E-mail ou senha incorretos.');
        } catch (error) {
            this.showErrorMsg(error.message);
        } finally {
            UI.setLoading('submitBtn', false);
        }
    },

    async resetPassword(email) {
        UI.setLoading('resetBtn', true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin
            });
            if (error) throw error;
            UI.showToast('Link de recuperação enviado!', 'success');
            document.getElementById('backToLoginBtn').click();
        } catch (error) {
            UI.showToast('Erro ao solicitar recuperação.', 'error');
        } finally {
            UI.setLoading('resetBtn', false);
        }
    },

    async updatePassword(newPassword) {
        UI.setLoading('updatePwdBtn', true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            
            UI.showToast('Senha atualizada com sucesso!', 'success');
            document.getElementById('updatePasswordScreen').classList.add('hidden');
            
            const { data: { session } } = await supabase.auth.getSession();
            if (session) this.proceedToDashboard(session.user);
            else this.showLoginScreen();
        } catch (error) {
            console.error(error);
            UI.showToast('Sessão expirada. Tente novamente.', 'error');
        } finally {
            UI.setLoading('updatePwdBtn', false);
        }
    },

    async signOut() {
        try {
            await supabase.auth.signOut();
            window.location.reload();
        } catch (error) {
            window.location.reload();
        }
    },

    proceedToDashboard(user) {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('recoveryScreen').classList.add('hidden');
        document.getElementById('updatePasswordScreen').classList.add('hidden');
        document.getElementById('dashboardApp').classList.remove('hidden');

        const fullName = user.user_metadata?.full_name || 'Produtor';
        UI.safeTextUpdate('userNameDisplay', fullName);
        UI.safeTextUpdate('userNameGreeting', fullName.split(' ')[0]);
        
        const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        UI.safeTextUpdate('userInitialsDisplay', initials || 'P');
        
        window.dispatchEvent(new CustomEvent('agrovia:userLoggedIn', { detail: { user } }));
    },

    showLoginScreen() {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('dashboardApp').classList.add('hidden');
        document.getElementById('recoveryScreen').classList.add('hidden');
        document.getElementById('updatePasswordScreen').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('opacity-0', 'pointer-events-none', 'hidden');
    },
    showResetPasswordScreen() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('recoveryScreen').classList.remove('hidden');
    },
    showUpdatePasswordScreen() {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('loginScreen').classList.add('hidden');
        const updateScreen = document.getElementById('updatePasswordScreen');
        updateScreen.classList.remove('hidden');
        updateScreen.classList.add('active');
    },
    showErrorMsg(msg) {
        const loginError = document.getElementById('loginError');
        if (loginError) {
            UI.safeTextUpdate('loginErrorText', msg);
            loginError.classList.remove('hidden');
        }
    }
};
