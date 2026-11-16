-- =============================================================
-- AGROVIA - MIGRATION 04
-- Integridade referencial, índices e endurecimento de RLS.
-- Execute depois da migration 03 no SQL Editor do Supabase.
-- Esta migration NÃO apaga registros.
-- =============================================================

BEGIN;

-- 0. Pré-requisitos: a migration depende da tabela properties já existente.
DO $$
BEGIN
    IF to_regclass('public.properties') IS NULL THEN
        RAISE EXCEPTION 'Tabela public.properties não encontrada. Execute primeiro a migration responsável pelas propriedades.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'id'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'user_id'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'total_area'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'created_at'
    ) THEN
        RAISE EXCEPTION 'A tabela public.properties precisa conter id, user_id e total_area. Ajuste o schema antes de executar esta migration.';
    END IF;
END $$;

-- 1. Metadados de atualização para culturas.
ALTER TABLE public.crops
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Garantir constraints essenciais, inclusive em instalações antigas.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.properties WHERE total_area IS NULL OR total_area <= 0) THEN
        RAISE EXCEPTION 'Existem propriedades com total_area menor ou igual a zero. Corrija os dados antes de executar esta migration.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.properties'::regclass AND conname = 'properties_total_area_positive_check') THEN
        ALTER TABLE public.properties ADD CONSTRAINT properties_total_area_positive_check CHECK (total_area > 0);
    END IF;

    IF EXISTS (SELECT 1 FROM public.harvests WHERE status IS NULL) THEN
        RAISE EXCEPTION 'Existem safras sem status. Defina um status válido antes de executar esta migration.';
    END IF;

    ALTER TABLE public.properties ALTER COLUMN total_area SET NOT NULL;
    ALTER TABLE public.harvests ALTER COLUMN status SET NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.fields'::regclass AND conname = 'fields_area_positive_check') THEN
        ALTER TABLE public.fields ADD CONSTRAINT fields_area_positive_check CHECK (area > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.harvests'::regclass AND conname = 'harvests_status_allowed_check') THEN
        ALTER TABLE public.harvests ADD CONSTRAINT harvests_status_allowed_check
            CHECK (status IN ('Planejada', 'Em Andamento', 'Concluída', 'Cancelada'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.harvests'::regclass AND conname = 'harvests_expected_after_start_check') THEN
        ALTER TABLE public.harvests ADD CONSTRAINT harvests_expected_after_start_check
            CHECK (expected_end_date IS NULL OR expected_end_date >= start_date);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.harvests'::regclass AND conname = 'harvests_actual_after_start_check') THEN
        ALTER TABLE public.harvests ADD CONSTRAINT harvests_actual_after_start_check
            CHECK (actual_end_date IS NULL OR actual_end_date >= start_date);
    END IF;
END $$;

-- 3. Evitar duplicidade de nomes dentro do mesmo proprietário/propriedade.
-- Se houver duplicados antigos, a migration para com uma mensagem clara;
-- nenhum registro é removido automaticamente.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.crops
        GROUP BY user_id, lower(trim(name)) HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Existem culturas com nomes duplicados para o mesmo usuário. Corrija os duplicados em public.crops e execute novamente.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.fields
        GROUP BY property_id, lower(trim(name)) HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Existem talhões com nomes duplicados na mesma propriedade. Corrija os duplicados em public.fields e execute novamente.';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crops_user_name
    ON public.crops (user_id, lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_fields_property_name
    ON public.fields (property_id, lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_fields_property_identification
    ON public.fields (property_id, lower(trim(identification)))
    WHERE identification IS NOT NULL AND trim(identification) <> '';

-- 4. Índices para consultas frequentes e relacionamentos.
CREATE INDEX IF NOT EXISTS idx_properties_user_created
    ON public.properties (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fields_property_created
    ON public.fields (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_harvests_field_status_start
    ON public.harvests (field_id, status, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_harvests_crop
    ON public.harvests (crop_id);

-- 5. Atualização automática de updated_at.
CREATE OR REPLACE FUNCTION public.agrovia_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crops_updated_at ON public.crops;
CREATE TRIGGER trg_crops_updated_at
    BEFORE UPDATE ON public.crops
    FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();

DROP TRIGGER IF EXISTS trg_fields_updated_at ON public.fields;
CREATE TRIGGER trg_fields_updated_at
    BEFORE UPDATE ON public.fields
    FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();

DROP TRIGGER IF EXISTS trg_harvests_updated_at ON public.harvests;
CREATE TRIGGER trg_harvests_updated_at
    BEFORE UPDATE ON public.harvests
    FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();

-- 6. Integridade adicional: uma safra só pode relacionar um talhão e uma
-- cultura pertencentes ao mesmo usuário. Também protege gravações feitas
-- por caminhos que não dependam das políticas RLS (ex.: service role).
CREATE OR REPLACE FUNCTION public.agrovia_validate_harvest_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    field_owner UUID;
    crop_owner UUID;
BEGIN
    SELECT p.user_id INTO field_owner
    FROM public.fields f
    JOIN public.properties p ON p.id = f.property_id
    WHERE f.id = NEW.field_id;

    SELECT c.user_id INTO crop_owner
    FROM public.crops c
    WHERE c.id = NEW.crop_id;

    IF field_owner IS NULL OR crop_owner IS NULL OR field_owner <> crop_owner THEN
        RAISE EXCEPTION 'A safra deve relacionar um talhão e uma cultura do mesmo usuário.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_harvests_validate_ownership ON public.harvests;
CREATE TRIGGER trg_harvests_validate_ownership
    BEFORE INSERT OR UPDATE OF field_id, crop_id ON public.harvests
    FOR EACH ROW EXECUTE FUNCTION public.agrovia_validate_harvest_ownership();

-- 7. RLS: remover TODAS as políticas antigas das quatro tabelas gerenciadas.
-- Políticas permissivas antigas poderiam continuar liberando acesso por OR.
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('properties', 'crops', 'fields', 'harvests')
    LOOP
        EXECUTE format('DROP POLICY %I ON %I.%I',
            policy_record.policyname, policy_record.schemaname, policy_record.tablename);
    END LOOP;
END $$;

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvests ENABLE ROW LEVEL SECURITY;

-- PROPRIEDADES: base de isolamento de todos os dados agrícolas.
CREATE POLICY properties_select_own ON public.properties
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY properties_insert_own ON public.properties
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY properties_update_own ON public.properties
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY properties_delete_own ON public.properties
    FOR DELETE USING (auth.uid() = user_id);

-- CULTURAS: cada usuário acessa somente as próprias culturas.
CREATE POLICY crops_select_own ON public.crops
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY crops_insert_own ON public.crops
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY crops_update_own ON public.crops
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY crops_delete_own ON public.crops
    FOR DELETE USING (auth.uid() = user_id);

-- TALHÕES: o acesso depende da propriedade pertencer ao usuário.
CREATE POLICY fields_select_own_property ON public.fields
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_id AND p.user_id = auth.uid()
        )
    );
CREATE POLICY fields_insert_own_property ON public.fields
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_id AND p.user_id = auth.uid()
        )
    );
CREATE POLICY fields_update_own_property ON public.fields
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_id AND p.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_id AND p.user_id = auth.uid()
        )
    );
CREATE POLICY fields_delete_own_property ON public.fields
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_id AND p.user_id = auth.uid()
        )
    );

-- SAFRAS: exige propriedade do talhão e da cultura em todas as operações.
CREATE POLICY harvests_select_own ON public.harvests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.fields f
            JOIN public.properties p ON p.id = f.property_id
            WHERE f.id = field_id AND p.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.crops c
            WHERE c.id = crop_id AND c.user_id = auth.uid()
        )
    );
CREATE POLICY harvests_insert_own ON public.harvests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.fields f
            JOIN public.properties p ON p.id = f.property_id
            WHERE f.id = field_id AND p.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.crops c
            WHERE c.id = crop_id AND c.user_id = auth.uid()
        )
    );
CREATE POLICY harvests_update_own ON public.harvests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.fields f
            JOIN public.properties p ON p.id = f.property_id
            WHERE f.id = field_id AND p.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.crops c
            WHERE c.id = crop_id AND c.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.fields f
            JOIN public.properties p ON p.id = f.property_id
            WHERE f.id = field_id AND p.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.crops c
            WHERE c.id = crop_id AND c.user_id = auth.uid()
        )
    );
CREATE POLICY harvests_delete_own ON public.harvests
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.fields f
            JOIN public.properties p ON p.id = f.property_id
            WHERE f.id = field_id AND p.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.crops c
            WHERE c.id = crop_id AND c.user_id = auth.uid()
        )
    );

COMMIT;
