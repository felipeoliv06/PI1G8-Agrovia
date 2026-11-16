-- Auditoria e Reforço de RLS
BEGIN;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.properties;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.properties;
DROP POLICY IF EXISTS "Permitir leitura publica" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem ver suas próprias propriedades" ON public.properties;
CREATE POLICY "Usuários podem ver suas próprias propriedades" ON public.properties FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem criar suas próprias propriedades" ON public.properties;
CREATE POLICY "Usuários podem criar suas próprias propriedades" ON public.properties FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias propriedades" ON public.properties;
CREATE POLICY "Usuários podem atualizar suas próprias propriedades" ON public.properties FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem deletar suas próprias propriedades" ON public.properties;
CREATE POLICY "Usuários podem deletar suas próprias propriedades" ON public.properties FOR DELETE USING (auth.uid() = user_id);

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_total_area_check') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_total_area_check CHECK (total_area > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_name_check') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_name_check CHECK (char_length(trim(name)) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON public.properties(created_at DESC);

COMMIT;
