import { Auth } from './modules/auth.js';
import { UI } from './modules/ui.js';
import { PropertiesModule } from './modules/properties.js';
import { AgriculturalModule } from './modules/agricultural.js';
import { DashboardModule } from './modules/dashboard.js';
import { FinanceModule } from './modules/finance.js';
import { ProfileModule } from './modules/profile.js';
import { CommercialModule } from './modules/commercial.js';
import { OnboardingTour } from './modules/onboarding.js';
import { SetupAssistant } from './modules/setup-assistant.js';
import { HelpCenter } from './modules/help.js';

document.addEventListener('DOMContentLoaded', () => {
    Auth.initialize();

    const setupNavigation = () => {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                UI.switchTab(btn.dataset.target);
                if (window.innerWidth < 1024) closeSidebar();
            });
        });
        document.getElementById('toggleSidebarBtn')?.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            if (sidebar && overlay) {
                sidebar.classList.remove('-translate-x-full');
                overlay.classList.remove('opacity-0', 'pointer-events-none');
                overlay.classList.add('opacity-100');
            }
        });
        const closeSidebar = () => {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            if (sidebar && overlay) {
                sidebar.classList.add('-translate-x-full');
                overlay.classList.remove('opacity-100');
                overlay.classList.add('opacity-0', 'pointer-events-none');
            }
        };
        document.getElementById('closeSidebarBtn')?.addEventListener('click', closeSidebar);
        document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && window.innerWidth < 1024) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
                    closeSidebar();
                    document.getElementById('toggleSidebarBtn')?.focus();
                }
            }
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 1024) closeSidebar();
        });
    };

    const setupAuthForms = () => {
        let isSignUpMode = false;
        
        const modeToggle = document.getElementById('toggleModeBtn');
        window.agroviaSetSignUpMode = (desired) => { if (isSignUpMode !== desired) modeToggle?.click(); };
        document.getElementById('landingSignIn')?.addEventListener('click', () => Auth.openLogin(false));
        document.getElementById('landingSignUp')?.addEventListener('click', () => Auth.openLogin(true));
        document.getElementById('backToLanding')?.addEventListener('click', () => Auth.showLoginScreen());

        modeToggle?.addEventListener('click', (e) => {
            e.preventDefault();
            isSignUpMode = !isSignUpMode;
            document.getElementById('loginError')?.classList.add('hidden');
            
            if (isSignUpMode) {
                UI.safeTextUpdate('formTitle', 'Criar Perfil Agrovia');
                document.getElementById('fieldNameContainer')?.classList.remove('hidden');
                document.getElementById('loginName').required = true;
                UI.safeTextUpdate('submitBtn', 'Criar Perfil e Acessar');
                document.getElementById('toggleModeBtn').innerHTML = 'Já tem um perfil? <span class="text-emerald-400 font-semibold underline">Fazer Login</span>';
            } else {
                UI.safeTextUpdate('formTitle', 'Acessar Conta');
                document.getElementById('fieldNameContainer')?.classList.add('hidden');
                document.getElementById('loginName').required = false;
                UI.safeTextUpdate('submitBtn', 'Entrar no Painel');
                document.getElementById('toggleModeBtn').innerHTML = 'Ainda não tem perfil? <span class="text-emerald-400 font-semibold underline">Criar Perfil</span>';
            }
        });

        document.getElementById('forgotPasswordBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.showResetPasswordScreen();
        });

        document.getElementById('backToLoginBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('recoveryScreen').classList.add('hidden');
            document.getElementById('loginScreen').classList.remove('hidden');
        });

        const handleFormSubmit = (formId, handler) => {
            const form = document.getElementById(formId);
            if(form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if(form.dataset.submitting === 'true') return;
                    form.dataset.submitting = 'true';
                    await handler(e);
                    form.dataset.submitting = 'false';
                });
            }
        };

        handleFormSubmit('loginForm', async (e) => {
            const email = document.getElementById('loginEmail')?.value.trim();
            const pass = document.getElementById('loginPassword')?.value;
            const name = document.getElementById('loginName')?.value.trim();
            document.getElementById('loginError')?.classList.add('hidden');

            if (isSignUpMode) {
                if (!name) return UI.showToast('Preencha seu nome.', 'error');
                await Auth.signUp(email, pass, name);
            } else {
                await Auth.signIn(email, pass);
            }
        });

        handleFormSubmit('recoveryForm', async (e) => {
            const email = document.getElementById('recoveryEmail')?.value.trim();
            if (email) await Auth.resetPassword(email);
        });

        handleFormSubmit('updatePasswordForm', async (e) => {
            const newPassword = document.getElementById('newPassword')?.value;
            if (newPassword && newPassword.length >= 6) {
                await Auth.updatePassword(newPassword);
            } else {
                UI.showToast('Mínimo de 6 caracteres.', 'error');
            }
        });

        document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.signOut());
        document.getElementById('profileCard')?.addEventListener('click', () => {
            UI.switchTab('perfil');
            if (window.innerWidth < 1024) closeSidebar();
        });
        document.getElementById('profileBackBtn')?.addEventListener('click', () => UI.switchTab('visao-geral'));
    };

    window.addEventListener('agrovia:userLoggedIn', (e) => {
        ProfileModule.init(e.detail.user);
        DashboardModule.init(e.detail.user);
        PropertiesModule.init(e.detail.user);
        AgriculturalModule.init(e.detail.user).catch(error => {
            console.error('Erro ao carregar Gestão Agrícola:', error);
            UI.showToast('Não foi possível carregar os módulos agrícolas.', 'error');
        });
        FinanceModule.init(e.detail.user).catch(error => {
            console.error('Erro ao carregar Financeiro:', error);
            UI.showToast('Não foi possível carregar o módulo financeiro.', 'error');
        });
        OnboardingTour.onLogin(e.detail.user);
        SetupAssistant.onLogin(e.detail.user);
        CommercialModule.init(e.detail.user).catch(error => {
            console.error('Erro ao carregar Gestão Comercial:', error);
            UI.showToast('Não foi possível carregar a Gestão Comercial.', 'error');
        });
    });

    setupNavigation();
    setupAuthForms();
    OnboardingTour.init();
    SetupAssistant.init();
    HelpCenter.init();
});
