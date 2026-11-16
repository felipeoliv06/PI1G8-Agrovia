import { UI } from './ui.js';

export const ProfileModule = {
    init(user) {
        if (!user) return;

        const fullName = user.user_metadata?.full_name?.trim() || 'Produtor';
        const initials = fullName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0])
            .join('')
            .toUpperCase() || 'P';

        const createdAt = user.created_at
            ? new Date(user.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric'
            })
            : 'Não disponível';

        UI.safeTextUpdate('profileInitials', initials);
        UI.safeTextUpdate('profileName', fullName);
        UI.safeTextUpdate('profileFullName', fullName);
        UI.safeTextUpdate('profileEmail', user.email || 'Não disponível');
        UI.safeTextUpdate('profileCreatedAt', createdAt);
        UI.safeTextUpdate(
            'profileStatus',
            user.email_confirmed_at ? 'E-mail confirmado' : 'Aguardando confirmação do e-mail'
        );
    }
};
