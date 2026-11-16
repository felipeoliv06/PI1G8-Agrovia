-- Agrovia 1.11.1: índices complementares para chaves estrangeiras compostas.
-- Migration incremental, não remove dados.
CREATE INDEX IF NOT EXISTS idx_orders_customer_owner_fk ON public.orders(customer_id,user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_owner_fk ON public.order_items(order_id,user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_owner_fk ON public.order_items(product_id,user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_owner_fk ON public.deliveries(order_id,user_id);
