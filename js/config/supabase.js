import { ENV } from './env.js';

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error('Supabase não configurado. Confira js/config/env.js.');
}
if (!window.supabase?.createClient) {
    throw new Error('Biblioteca Supabase não carregada. Verifique a conexão e o CDN.');
}

export const supabase = window.supabase.createClient(
    ENV.SUPABASE_URL,
    ENV.SUPABASE_ANON_KEY
);
