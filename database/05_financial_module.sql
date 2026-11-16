-- Agrovia | Módulo financeiro rural
-- Cria lançamentos de receitas e despesas com isolamento por usuário.
-- Seguro para execução repetida: não apaga dados nem altera tabelas existentes.

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  harvest_id UUID NULL REFERENCES public.harvests(id) ON DELETE SET NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('receita', 'despesa')),
  category VARCHAR(100) NOT NULL CHECK (char_length(trim(category)) > 0),
  description VARCHAR(255) NOT NULL CHECK (char_length(trim(description)) > 0),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'pendente', 'cancelado')),
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_date
  ON public.financial_transactions (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_property_date
  ON public.financial_transactions (property_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_harvest
  ON public.financial_transactions (harvest_id)
  WHERE harvest_id IS NOT NULL;

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_transactions_select_own ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_insert_own ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_update_own ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_delete_own ON public.financial_transactions;

CREATE POLICY financial_transactions_select_own
ON public.financial_transactions FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.user_id = (SELECT auth.uid())
  )
  AND (
    harvest_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.harvests h
      JOIN public.fields f ON f.id = h.field_id
      JOIN public.properties p ON p.id = f.property_id
      WHERE h.id = harvest_id
        AND f.property_id = financial_transactions.property_id
        AND p.user_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY financial_transactions_insert_own
ON public.financial_transactions FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.user_id = (SELECT auth.uid())
  )
  AND (
    harvest_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.harvests h
      JOIN public.fields f ON f.id = h.field_id
      JOIN public.properties p ON p.id = f.property_id
      WHERE h.id = harvest_id
        AND f.property_id = financial_transactions.property_id
        AND p.user_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY financial_transactions_update_own
ON public.financial_transactions FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.user_id = (SELECT auth.uid())
  )
  AND (
    harvest_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.harvests h
      JOIN public.fields f ON f.id = h.field_id
      JOIN public.properties p ON p.id = f.property_id
      WHERE h.id = harvest_id
        AND f.property_id = financial_transactions.property_id
        AND p.user_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY financial_transactions_delete_own
ON public.financial_transactions FOR DELETE TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.user_id = (SELECT auth.uid())
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;
REVOKE ALL ON public.financial_transactions FROM anon;
