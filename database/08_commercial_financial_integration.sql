BEGIN;
ALTER TABLE public.properties ADD CONSTRAINT properties_id_user_unique UNIQUE (id,user_id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_property_owner_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_property_owner_fkey FOREIGN KEY (property_id,user_id) REFERENCES public.properties(id,user_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_orders_property_owner_fk ON public.orders(property_id,user_id);
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS source_order_id uuid;
ALTER TABLE public.financial_transactions DROP CONSTRAINT IF EXISTS finance_order_owner_fkey;
ALTER TABLE public.financial_transactions ADD CONSTRAINT finance_order_owner_fkey FOREIGN KEY(source_order_id,user_id) REFERENCES public.orders(id,user_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_unique_order ON public.financial_transactions(source_order_id) WHERE source_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_order_owner_fk ON public.financial_transactions(source_order_id,user_id);

-- Create a commercial order with an explicitly selected, owned property.
CREATE OR REPLACE FUNCTION public.agrovia_create_order_with_property(
 p_customer_id uuid,p_property_id uuid,p_fulfillment_type text,p_items jsonb,
 p_notes text DEFAULT NULL,p_address text DEFAULT NULL,p_scheduled_date timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_order uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Faça login para registrar o pedido.'; END IF;
 IF p_property_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties WHERE id=p_property_id AND user_id=v_user) THEN
   RAISE EXCEPTION 'Selecione uma propriedade válida.';
 END IF;
 v_order:=public.agrovia_create_order(p_customer_id,p_fulfillment_type,p_items,p_notes,p_address,p_scheduled_date);
 UPDATE public.orders SET property_id=p_property_id WHERE id=v_order AND user_id=v_user;
 RETURN v_order;
END $$;
REVOKE ALL ON FUNCTION public.agrovia_create_order_with_property(uuid,uuid,text,jsonb,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agrovia_create_order_with_property(uuid,uuid,text,jsonb,text,text,timestamptz) TO authenticated;

-- Automatically register the financial revenue only when the order is completed.
CREATE OR REPLACE FUNCTION public.agrovia_order_finance_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='Concluído' AND OLD.status IS DISTINCT FROM 'Concluído' THEN
   IF NEW.property_id IS NULL THEN
     RAISE EXCEPTION 'Selecione a propriedade do pedido antes de concluí-lo.';
   END IF;
   IF NEW.total_amount>0 THEN
     INSERT INTO public.financial_transactions
       (user_id,property_id,source_order_id,transaction_type,category,description,amount,transaction_date,status,notes)
     VALUES (NEW.user_id,NEW.property_id,NEW.id,'receita','Venda de produção',
       'Pedido '||NEW.order_number,NEW.total_amount,CURRENT_DATE,'confirmado',
       'Receita gerada automaticamente pela conclusão do pedido.')
     ON CONFLICT (source_order_id) WHERE source_order_id IS NOT NULL DO NOTHING;
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.agrovia_order_finance_sync() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_order_finance_sync ON public.orders;
CREATE TRIGGER trg_order_finance_sync AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.agrovia_order_finance_sync();

-- Prevent users from altering automatically generated revenues through normal finance CRUD.
CREATE OR REPLACE FUNCTION public.agrovia_protect_order_revenue() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' AND OLD.source_order_id IS NOT NULL THEN
   RAISE EXCEPTION 'Receita vinculada a pedido não pode ser excluída.';
 END IF;
 IF TG_OP='UPDATE' AND OLD.source_order_id IS NOT NULL THEN
   RAISE EXCEPTION 'Receita vinculada a pedido não pode ser editada.';
 END IF;
 IF TG_OP='INSERT' AND NEW.source_order_id IS NOT NULL AND current_user <> 'postgres' THEN
   RAISE EXCEPTION 'Vínculo de pedido reservado ao sistema.';
 END IF;
 IF TG_OP='UPDATE' AND NEW.source_order_id IS NOT NULL AND OLD.source_order_id IS NULL THEN
   RAISE EXCEPTION 'Vínculo de pedido reservado ao sistema.';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION public.agrovia_protect_order_revenue() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_protect_order_revenue ON public.financial_transactions;
CREATE TRIGGER trg_protect_order_revenue BEFORE INSERT OR UPDATE OR DELETE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.agrovia_protect_order_revenue();
COMMIT;
