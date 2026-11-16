-- ============================================================================
-- AGROVIA | INSTALAÇÃO COMPLETA DO BANCO (Supabase / PostgreSQL)
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- Compatível com instalação nova e com o schema Agrovia das migrations 01-04.
-- Não apaga tabelas nem registros. Recria somente as políticas RLS gerenciadas
-- pelo Agrovia nas cinco tabelas abaixo.
-- ============================================================================

BEGIN;

-- 0. Verificações do ambiente -------------------------------------------------
DO $$
BEGIN
    IF to_regclass('auth.users') IS NULL THEN
        RAISE EXCEPTION 'Este script precisa ser executado em um projeto Supabase (tabela auth.users não encontrada).';
    END IF;
END;
$$;

-- 1. Schema principal ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    total_area NUMERIC(12,2) NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    identification VARCHAR(100),
    area NUMERIC(12,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.harvests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
    crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    expected_end_date DATE,
    actual_end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Planejada',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Completar instalações antigas sem sobrescrever dados --------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS total_area NUMERIC(12,2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS property_id UUID;
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS identification VARCHAR(100);
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS area NUMERIC(12,2);
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS field_id UUID;
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS crop_id UUID;
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS expected_end_date DATE;
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS actual_end_date DATE;
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Planejada';
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Não tenta adivinhar nem corrigir registros incompletos automaticamente.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.properties WHERE user_id IS NULL OR name IS NULL OR trim(name) = '' OR total_area IS NULL OR total_area <= 0) THEN
        RAISE EXCEPTION 'Há propriedades com usuário, nome ou área inválidos. Corrija esses registros antes de instalar o banco.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.crops WHERE user_id IS NULL OR name IS NULL OR trim(name) = '') THEN
        RAISE EXCEPTION 'Há culturas com usuário ou nome inválido. Corrija esses registros antes de instalar o banco.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.fields WHERE property_id IS NULL OR name IS NULL OR trim(name) = '' OR area IS NULL OR area <= 0) THEN
        RAISE EXCEPTION 'Há talhões com propriedade, nome ou área inválidos. Corrija esses registros antes de instalar o banco.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.harvests WHERE field_id IS NULL OR crop_id IS NULL OR name IS NULL OR trim(name) = '' OR start_date IS NULL) THEN
        RAISE EXCEPTION 'Há safras com talhão, cultura, nome ou data inicial inválidos. Corrija esses registros antes de instalar o banco.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.harvests WHERE status IS NULL OR status NOT IN ('Planejada', 'Em Andamento', 'Concluída', 'Cancelada')) THEN
        RAISE EXCEPTION 'Há safras com status inválido. Use: Planejada, Em Andamento, Concluída ou Cancelada.';
    END IF;
END;
$$;

-- 3. Garantir FKs e constraints em bancos que já tinham tabelas ---------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.properties'::regclass AND conname = 'properties_user_id_fkey') THEN
        ALTER TABLE public.properties ADD CONSTRAINT properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.crops'::regclass AND conname = 'crops_user_id_fkey') THEN
        ALTER TABLE public.crops ADD CONSTRAINT crops_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.fields'::regclass AND conname = 'fields_property_id_fkey') THEN
        ALTER TABLE public.fields ADD CONSTRAINT fields_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.harvests'::regclass AND conname = 'harvests_field_id_fkey') THEN
        ALTER TABLE public.harvests ADD CONSTRAINT harvests_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.harvests'::regclass AND conname = 'harvests_crop_id_fkey') THEN
        ALTER TABLE public.harvests ADD CONSTRAINT harvests_crop_id_fkey FOREIGN KEY (crop_id) REFERENCES public.crops(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.properties'::regclass AND conname = 'properties_name_nonempty_check') THEN
        ALTER TABLE public.properties ADD CONSTRAINT properties_name_nonempty_check CHECK (char_length(trim(name)) > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.properties'::regclass AND conname = 'properties_total_area_positive_check') THEN
        ALTER TABLE public.properties ADD CONSTRAINT properties_total_area_positive_check CHECK (total_area > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.crops'::regclass AND conname = 'crops_name_nonempty_check') THEN
        ALTER TABLE public.crops ADD CONSTRAINT crops_name_nonempty_check CHECK (char_length(trim(name)) > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.fields'::regclass AND conname = 'fields_name_nonempty_check') THEN
        ALTER TABLE public.fields ADD CONSTRAINT fields_name_nonempty_check CHECK (char_length(trim(name)) > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.fields'::regclass AND conname = 'fields_area_positive_check') THEN
        ALTER TABLE public.fields ADD CONSTRAINT fields_area_positive_check CHECK (area > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.harvests'::regclass AND conname = 'harvests_name_nonempty_check') THEN
        ALTER TABLE public.harvests ADD CONSTRAINT harvests_name_nonempty_check CHECK (char_length(trim(name)) > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.harvests'::regclass AND conname = 'harvests_status_allowed_check') THEN
        ALTER TABLE public.harvests ADD CONSTRAINT harvests_status_allowed_check CHECK (status IN ('Planejada', 'Em Andamento', 'Concluída', 'Cancelada'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.harvests'::regclass AND conname = 'harvests_expected_after_start_check') THEN
        ALTER TABLE public.harvests ADD CONSTRAINT harvests_expected_after_start_check CHECK (expected_end_date IS NULL OR expected_end_date >= start_date);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.harvests'::regclass AND conname = 'harvests_actual_after_start_check') THEN
        ALTER TABLE public.harvests ADD CONSTRAINT harvests_actual_after_start_check CHECK (actual_end_date IS NULL OR actual_end_date >= start_date);
    END IF;

    ALTER TABLE public.profiles ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE public.profiles ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE public.profiles ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.profiles ALTER COLUMN updated_at SET NOT NULL;
    ALTER TABLE public.properties ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE public.properties ALTER COLUMN name SET NOT NULL;
    ALTER TABLE public.properties ALTER COLUMN total_area SET NOT NULL;
    ALTER TABLE public.properties ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE public.properties ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE public.properties ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.properties ALTER COLUMN updated_at SET NOT NULL;
    ALTER TABLE public.crops ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE public.crops ALTER COLUMN name SET NOT NULL;
    ALTER TABLE public.crops ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE public.crops ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE public.crops ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.crops ALTER COLUMN updated_at SET NOT NULL;
    ALTER TABLE public.fields ALTER COLUMN property_id SET NOT NULL;
    ALTER TABLE public.fields ALTER COLUMN name SET NOT NULL;
    ALTER TABLE public.fields ALTER COLUMN area SET NOT NULL;
    ALTER TABLE public.fields ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE public.fields ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE public.fields ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.fields ALTER COLUMN updated_at SET NOT NULL;
    ALTER TABLE public.harvests ALTER COLUMN field_id SET NOT NULL;
    ALTER TABLE public.harvests ALTER COLUMN crop_id SET NOT NULL;
    ALTER TABLE public.harvests ALTER COLUMN name SET NOT NULL;
    ALTER TABLE public.harvests ALTER COLUMN start_date SET NOT NULL;
    ALTER TABLE public.harvests ALTER COLUMN status SET DEFAULT 'Planejada';
    ALTER TABLE public.harvests ALTER COLUMN status SET NOT NULL;
    ALTER TABLE public.harvests ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE public.harvests ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE public.harvests ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.harvests ALTER COLUMN updated_at SET NOT NULL;
END;
$$;

-- 4. Unicidade e índices de desempenho ---------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.crops GROUP BY user_id, lower(trim(name)) HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Há culturas duplicadas para o mesmo usuário (ignorando maiúsculas/minúsculas). Corrija os duplicados e execute novamente.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.fields GROUP BY property_id, lower(trim(name)) HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Há talhões com nomes duplicados na mesma propriedade. Corrija os duplicados e execute novamente.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.fields WHERE identification IS NOT NULL AND trim(identification) <> '' GROUP BY property_id, lower(trim(identification)) HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Há identificações de talhão duplicadas dentro da mesma propriedade. Corrija os duplicados e execute novamente.';
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crops_user_name ON public.crops (user_id, lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_fields_property_name ON public.fields (property_id, lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_fields_property_identification ON public.fields (property_id, lower(trim(identification))) WHERE identification IS NOT NULL AND trim(identification) <> '';
CREATE INDEX IF NOT EXISTS idx_properties_user_created ON public.properties (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crops_user_created ON public.crops (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fields_property_created ON public.fields (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_harvests_field_status_start ON public.harvests (field_id, status, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_harvests_crop ON public.harvests (crop_id);

-- 5. Triggers: timestamps, perfil automático e validação entre usuários ------
CREATE OR REPLACE FUNCTION public.agrovia_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();
DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();
DROP TRIGGER IF EXISTS trg_crops_updated_at ON public.crops;
CREATE TRIGGER trg_crops_updated_at BEFORE UPDATE ON public.crops FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();
DROP TRIGGER IF EXISTS trg_fields_updated_at ON public.fields;
CREATE TRIGGER trg_fields_updated_at BEFORE UPDATE ON public.fields FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();
DROP TRIGGER IF EXISTS trg_harvests_updated_at ON public.harvests;
CREATE TRIGGER trg_harvests_updated_at BEFORE UPDATE ON public.harvests FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();

CREATE OR REPLACE FUNCTION public.agrovia_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.agrovia_handle_new_user();

-- Garante perfil para contas criadas antes da instalação desta versão.
INSERT INTO public.profiles (id, full_name)
SELECT u.id, NULLIF(trim(u.raw_user_meta_data ->> 'full_name'), '')
FROM auth.users AS u
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.agrovia_validate_harvest_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_field_owner UUID;
    v_crop_owner UUID;
BEGIN
    SELECT p.user_id INTO v_field_owner
    FROM public.fields AS f
    JOIN public.properties AS p ON p.id = f.property_id
    WHERE f.id = NEW.field_id;

    SELECT c.user_id INTO v_crop_owner
    FROM public.crops AS c
    WHERE c.id = NEW.crop_id;

    IF v_field_owner IS NULL OR v_crop_owner IS NULL OR v_field_owner <> v_crop_owner THEN
        RAISE EXCEPTION 'A safra deve relacionar um talhão e uma cultura pertencentes ao mesmo usuário.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_harvests_validate_ownership ON public.harvests;
CREATE TRIGGER trg_harvests_validate_ownership BEFORE INSERT OR UPDATE OF field_id, crop_id ON public.harvests FOR EACH ROW EXECUTE FUNCTION public.agrovia_validate_harvest_ownership();

-- Funções chamadas apenas por triggers: não devem ser executáveis via API.
REVOKE ALL ON FUNCTION public.agrovia_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agrovia_handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agrovia_validate_harvest_ownership() FROM PUBLIC, anon, authenticated;

-- 6. Segurança RLS ------------------------------------------------------------
-- Remove políticas antigas apenas das tabelas administradas por este schema.
DO $$
DECLARE
    v_policy RECORD;
BEGIN
    FOR v_policy IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('profiles', 'properties', 'crops', 'fields', 'harvests')
    LOOP
        EXECUTE format('DROP POLICY %I ON %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
    END LOOP;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvests ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY properties_select_own ON public.properties FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY properties_insert_own ON public.properties FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY properties_update_own ON public.properties FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY properties_delete_own ON public.properties FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY crops_select_own ON public.crops FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY crops_insert_own ON public.crops FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY crops_update_own ON public.crops FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY crops_delete_own ON public.crops FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY fields_select_own_property ON public.fields FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.properties AS p WHERE p.id = property_id AND p.user_id = (SELECT auth.uid()))
);
CREATE POLICY fields_insert_own_property ON public.fields FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties AS p WHERE p.id = property_id AND p.user_id = (SELECT auth.uid()))
);
CREATE POLICY fields_update_own_property ON public.fields FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.properties AS p WHERE p.id = property_id AND p.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.properties AS p WHERE p.id = property_id AND p.user_id = (SELECT auth.uid())));
CREATE POLICY fields_delete_own_property ON public.fields FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.properties AS p WHERE p.id = property_id AND p.user_id = (SELECT auth.uid()))
);

CREATE POLICY harvests_select_own ON public.harvests FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.fields AS f JOIN public.properties AS p ON p.id = f.property_id WHERE f.id = field_id AND p.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.crops AS c WHERE c.id = crop_id AND c.user_id = (SELECT auth.uid()))
);
CREATE POLICY harvests_insert_own ON public.harvests FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.fields AS f JOIN public.properties AS p ON p.id = f.property_id WHERE f.id = field_id AND p.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.crops AS c WHERE c.id = crop_id AND c.user_id = (SELECT auth.uid()))
);
CREATE POLICY harvests_update_own ON public.harvests FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.fields AS f JOIN public.properties AS p ON p.id = f.property_id WHERE f.id = field_id AND p.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.crops AS c WHERE c.id = crop_id AND c.user_id = (SELECT auth.uid()))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.fields AS f JOIN public.properties AS p ON p.id = f.property_id WHERE f.id = field_id AND p.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.crops AS c WHERE c.id = crop_id AND c.user_id = (SELECT auth.uid()))
);
CREATE POLICY harvests_delete_own ON public.harvests FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.fields AS f JOIN public.properties AS p ON p.id = f.property_id WHERE f.id = field_id AND p.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.crops AS c WHERE c.id = crop_id AND c.user_id = (SELECT auth.uid()))
);

-- 7. Privilégios mínimos para o frontend autenticado -------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties, public.crops, public.fields, public.harvests TO authenticated;
GRANT ALL ON public.profiles, public.properties, public.crops, public.fields, public.harvests TO service_role;
REVOKE ALL ON public.profiles, public.properties, public.crops, public.fields, public.harvests FROM anon;

COMMIT;

-- Fim: execute database/99_verify_installation.sql para conferir o resultado.
