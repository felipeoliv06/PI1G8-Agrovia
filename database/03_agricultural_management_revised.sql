-- ==========================================
-- AGROVIA - MIGRATION 03 REVISADA: GESTÃO AGRÍCOLA (FASE 3.1)
-- Compatível com instalações existentes, com validação de status
-- e correção estrita de RLS para UPDATE de safras.
-- ==========================================

BEGIN;

-- 1. TABELA DE CULTURAS (crops)
CREATE TABLE IF NOT EXISTS public.crops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL CHECK (char_length(trim(name)) > 0),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE TALHÕES (fields)
CREATE TABLE IF NOT EXISTS public.fields (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL CHECK (char_length(trim(name)) > 0),
    identification VARCHAR(100),
    area DECIMAL(10,2) NOT NULL CHECK (area > 0),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE SAFRAS (harvests)
-- Inclui CHECK de status permitidos: 'Planejada', 'Em Andamento', 'Concluída', 'Cancelada'
CREATE TABLE IF NOT EXISTS public.harvests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    field_id UUID REFERENCES public.fields(id) ON DELETE CASCADE NOT NULL,
    crop_id UUID REFERENCES public.crops(id) ON DELETE RESTRICT NOT NULL,
    name VARCHAR(255) NOT NULL CHECK (char_length(trim(name)) > 0),
    start_date DATE NOT NULL,
    expected_end_date DATE,
    actual_end_date DATE,
    status VARCHAR(50) DEFAULT 'Planejada' CHECK (status IN ('Planejada', 'Em Andamento', 'Concluída', 'Cancelada')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_expected_dates CHECK (expected_end_date IS NULL OR expected_end_date >= start_date),
    CONSTRAINT valid_actual_dates CHECK (actual_end_date IS NULL OR actual_end_date >= start_date)
);

-- Se a tabela harvests já existia sem a constraint de status, adicionamos de forma segura:
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'harvests_status_check') THEN
    ALTER TABLE public.harvests ADD CONSTRAINT harvests_status_check CHECK (status IN ('Planejada', 'Em Andamento', 'Concluída', 'Cancelada'));
  END IF;
END $$;

-- 4. TRIGGERS PARA UPDATED_AT
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_fields_updated_at ON public.fields;
CREATE TRIGGER update_fields_updated_at 
    BEFORE UPDATE ON public.fields 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_harvests_updated_at ON public.harvests;
CREATE TRIGGER update_harvests_updated_at 
    BEFORE UPDATE ON public.harvests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_crops_user_id ON public.crops(user_id);
CREATE INDEX IF NOT EXISTS idx_fields_property_id ON public.fields(property_id);
CREATE INDEX IF NOT EXISTS idx_harvests_field_id ON public.harvests(field_id);
CREATE INDEX IF NOT EXISTS idx_harvests_crop_id ON public.harvests(crop_id);

-- 6. HABILITAR RLS NAS NOVAS TABELAS
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvests ENABLE ROW LEVEL SECURITY;

-- =======================================================
-- 7. POLÍTICAS RLS (SECURITY REVISADA)
-- =======================================================

-- CULTURAS
DROP POLICY IF EXISTS "Usuários gerenciam próprias culturas" ON public.crops;
CREATE POLICY "Usuários gerenciam próprias culturas" ON public.crops 
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TALHÕES
DROP POLICY IF EXISTS "Usuários leem talhões de suas propriedades" ON public.fields;
CREATE POLICY "Usuários leem talhões de suas propriedades" ON public.fields 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.properties p 
            WHERE p.id = property_id AND p.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Usuários inserem talhões em suas propriedades" ON public.fields;
CREATE POLICY "Usuários inserem talhões em suas propriedades" ON public.fields 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.properties p 
            WHERE p.id = property_id AND p.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Usuários atualizam talhões de suas propriedades" ON public.fields;
CREATE POLICY "Usuários atualizam talhões de suas propriedades" ON public.fields 
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

DROP POLICY IF EXISTS "Usuários deletam talhões de suas propriedades" ON public.fields;
CREATE POLICY "Usuários deletam talhões de suas propriedades" ON public.fields 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.properties p 
            WHERE p.id = property_id AND p.user_id = auth.uid()
        )
    );

-- SAFRAS (Harvests) - Com validação rigorosa de propriedade do Talhão E da Cultura no SELECT, INSERT e UPDATE
DROP POLICY IF EXISTS "Usuários leem safras de seus talhões" ON public.harvests;
CREATE POLICY "Usuários leem safras de seus talhões" ON public.harvests 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.fields f
            JOIN public.properties p ON f.property_id = p.id
            WHERE f.id = field_id AND p.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Usuários inserem safras em seus talhões e suas culturas" ON public.harvests;
CREATE POLICY "Usuários inserem safras em seus talhões e suas culturas" ON public.harvests 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.fields f
            JOIN public.properties p ON f.property_id = p.id
            WHERE f.id = field_id AND p.user_id = auth.uid()
        )
        AND 
        EXISTS (
            SELECT 1 FROM public.crops c
            WHERE c.id = crop_id AND c.user_id = auth.uid()
        )
    );

-- Correção aplicada: Na política de UPDATE, validamos tanto o talhão de destino quanto se a nova cultura pertence ao usuário autenticado.
DROP POLICY IF EXISTS "Usuários atualizam safras de seus talhões" ON public.harvests;
CREATE POLICY "Usuários atualizam safras de seus talhões" ON public.harvests 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.fields f
            JOIN public.properties p ON f.property_id = p.id
            WHERE f.id = field_id AND p.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.fields f
            JOIN public.properties p ON f.property_id = p.id
            WHERE f.id = field_id AND p.user_id = auth.uid()
        )
        AND
        EXISTS (
            SELECT 1 FROM public.crops c
            WHERE c.id = crop_id AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Usuários deletam safras de seus talhões" ON public.harvests;
CREATE POLICY "Usuários deletam safras de seus talhões" ON public.harvests 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.fields f
            JOIN public.properties p ON f.property_id = p.id
            WHERE f.id = field_id AND p.user_id = auth.uid()
        )
    );

COMMIT;
