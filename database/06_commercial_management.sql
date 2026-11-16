-- Agrovia | Integração ao escopo original de gestão comercial do produtor
-- Acrescenta produtos/estoque, clientes, pedidos, itens e entregas.
-- Migration incremental: não apaga nem altera os módulos agrícolas/financeiros.
-- Execute somente após revisar e fazer backup do projeto Supabase.

BEGIN;

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL CHECK (char_length(trim(name)) > 0),
  description TEXT,
  unit VARCHAR(30) NOT NULL DEFAULT 'unidade' CHECK (char_length(trim(unit)) > 0),
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  stock_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL CHECK (char_length(trim(name)) > 0),
  phone VARCHAR(40),
  email VARCHAR(254),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  order_number VARCHAR(40) NOT NULL,
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(24) NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Em separação', 'Pronto', 'Concluído', 'Cancelado')),
  fulfillment_type VARCHAR(16) NOT NULL DEFAULT 'Entrega'
    CHECK (fulfillment_type IN ('Entrega', 'Retirada')),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT orders_customer_same_user_fk FOREIGN KEY (customer_id, user_id)
    REFERENCES public.customers(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT orders_number_per_user_unique UNIQUE (user_id, order_number)
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(14,2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_items_order_same_user_fk FOREIGN KEY (order_id, user_id)
    REFERENCES public.orders(id, user_id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_same_user_fk FOREIGN KEY (product_id, user_id)
    REFERENCES public.products(id, user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Em andamento', 'Entregue', 'Cancelada')),
  scheduled_date TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deliveries_order_same_user_fk FOREIGN KEY (order_id, user_id)
    REFERENCES public.orders(id, user_id) ON DELETE CASCADE,
  CONSTRAINT deliveries_one_per_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_products_user_active_name
  ON public.products (user_id, is_active, name);
CREATE INDEX IF NOT EXISTS idx_products_user_stock
  ON public.products (user_id, stock_quantity, minimum_stock);
CREATE INDEX IF NOT EXISTS idx_customers_user_name
  ON public.customers (user_id, name);
CREATE INDEX IF NOT EXISTS idx_orders_user_date
  ON public.orders (user_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_status
  ON public.orders (user_id, status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (user_id, order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_user_status_date
  ON public.deliveries (user_id, status, scheduled_date);

-- Timestamps consistentes com os módulos já existentes.
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

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();
DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();
DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();
DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER trg_deliveries_updated_at BEFORE UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.agrovia_set_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
DECLARE action TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','customers','orders','order_items','deliveries'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id)', t || '_select_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id)', t || '_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)', t || '_update_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id)', t || '_delete_own', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products, public.customers,
  public.orders, public.order_items, public.deliveries TO authenticated;
GRANT ALL ON public.products, public.customers, public.orders,
  public.order_items, public.deliveries TO service_role;
REVOKE ALL ON public.products, public.customers, public.orders,
  public.order_items, public.deliveries FROM anon;

COMMIT;
