-- Agrovia 1.11 | Fluxo transacional de pedidos (executar DEPOIS da migration 06).
-- A migration não remove registros. Faça backup e revise antes de executar.
BEGIN;

-- Evita alterações parciais em pedidos/itens/entregas pelo cliente HTTP.
REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items, public.deliveries FROM authenticated;

CREATE OR REPLACE FUNCTION public.agrovia_create_order(
  p_customer_id uuid, p_fulfillment_type text, p_items jsonb,
  p_notes text DEFAULT NULL, p_address text DEFAULT NULL,
  p_scheduled_date timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_item record;
  v_product record;
  v_total numeric(14,2) := 0;
  v_number text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Faça login para registrar um pedido.'; END IF;
  IF p_fulfillment_type NOT IN ('Entrega', 'Retirada') OR p_fulfillment_type IS NULL THEN
    RAISE EXCEPTION 'Tipo de atendimento inválido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0
    OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Informe entre 1 e 50 produtos.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) e
    WHERE jsonb_typeof(e) <> 'object'
       OR NOT (e ? 'product_id' AND e ? 'quantity')
       OR jsonb_typeof(e->'product_id') <> 'string'
       OR jsonb_typeof(e->'quantity') <> 'number'
  ) THEN RAISE EXCEPTION 'Itens do pedido inválidos.'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity numeric)
    GROUP BY product_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Produto repetido no pedido.'; END IF;

  -- Bloqueia as linhas na ordem de UUID para evitar venda simultânea acima do estoque.
  FOR v_item IN
    SELECT product_id, quantity FROM jsonb_to_recordset(p_items)
      AS i(product_id uuid, quantity numeric) ORDER BY product_id
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity <= 0
      OR v_item.quantity > 99999999999 OR round(v_item.quantity, 3) <> v_item.quantity THEN
      RAISE EXCEPTION 'Quantidade inválida.';
    END IF;
    SELECT id, name, sale_price, stock_quantity, is_active INTO v_product
      FROM public.products WHERE id = v_item.product_id AND user_id = v_user FOR UPDATE;
    IF NOT FOUND OR NOT v_product.is_active THEN RAISE EXCEPTION 'Produto indisponível.'; END IF;
    IF v_product.stock_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para %.', v_product.name;
    END IF;
    v_total := v_total + round(v_item.quantity * v_product.sale_price, 2);
  END LOOP;
  IF v_total > 999999999999.99 THEN RAISE EXCEPTION 'Total do pedido acima do permitido.'; END IF;

  v_id := gen_random_uuid();
  v_number := 'AG-' || upper(substr(replace(v_id::text, '-', ''), 1, 12));
  INSERT INTO public.orders(id, user_id, customer_id, order_number, fulfillment_type, total_amount, notes)
    VALUES (v_id, v_user, p_customer_id, v_number, p_fulfillment_type, v_total, nullif(trim(p_notes), ''));

  FOR v_item IN
    SELECT product_id, quantity FROM jsonb_to_recordset(p_items)
      AS i(product_id uuid, quantity numeric) ORDER BY product_id
  LOOP
    SELECT sale_price INTO v_product FROM public.products
      WHERE id = v_item.product_id AND user_id = v_user;
    INSERT INTO public.order_items(user_id, order_id, product_id, quantity, unit_price)
      VALUES (v_user, v_id, v_item.product_id, v_item.quantity, v_product.sale_price);
    UPDATE public.products SET stock_quantity = stock_quantity - v_item.quantity
      WHERE id = v_item.product_id AND user_id = v_user;
  END LOOP;
  IF p_fulfillment_type = 'Entrega' THEN
    INSERT INTO public.deliveries(user_id, order_id, scheduled_date, address)
      VALUES (v_user, v_id, p_scheduled_date, nullif(trim(p_address), ''));
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.agrovia_change_order_status(
  p_order_id uuid, p_new_status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_old text;
  v_fulfillment text;
  v_item record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  SELECT status, fulfillment_type INTO v_old, v_fulfillment FROM public.orders
    WHERE id = p_order_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF p_new_status NOT IN ('Em separação','Pronto','Concluído','Cancelado') THEN
    RAISE EXCEPTION 'Status inválido.';
  END IF;
  IF v_old IN ('Cancelado','Concluído') THEN RAISE EXCEPTION 'Pedido já finalizado.'; END IF;
  IF NOT (
    (v_old = 'Pendente' AND p_new_status IN ('Em separação','Cancelado')) OR
    (v_old = 'Em separação' AND p_new_status IN ('Pronto','Cancelado')) OR
    (v_old = 'Pronto' AND p_new_status IN ('Concluído','Cancelado'))
  ) THEN RAISE EXCEPTION 'Transição de status não permitida.'; END IF;
  IF p_new_status = 'Concluído' AND v_fulfillment = 'Entrega' THEN
    RAISE EXCEPTION 'Pedidos para entrega são concluídos na tela Entregas.';
  END IF;
  IF p_new_status = 'Cancelado' THEN
    FOR v_item IN SELECT product_id, quantity FROM public.order_items
      WHERE order_id = p_order_id AND user_id = v_user ORDER BY product_id
    LOOP
      UPDATE public.products SET stock_quantity = stock_quantity + v_item.quantity
        WHERE id = v_item.product_id AND user_id = v_user;
    END LOOP;
    UPDATE public.deliveries SET status = 'Cancelada'
      WHERE order_id = p_order_id AND user_id = v_user AND status <> 'Entregue';
  END IF;
  UPDATE public.orders SET status = p_new_status
    WHERE id = p_order_id AND user_id = v_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.agrovia_change_delivery_status(
  p_delivery_id uuid, p_new_status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order uuid;
  v_old text;
  v_order_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  -- Ordem consistente: trava primeiro o pedido e depois a entrega.
  SELECT d.order_id INTO v_order FROM public.deliveries d
    WHERE d.id = p_delivery_id AND d.user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrega não encontrada.'; END IF;
  SELECT status INTO v_order_status FROM public.orders
    WHERE id = v_order AND user_id = v_user FOR UPDATE;
  SELECT status INTO v_old FROM public.deliveries
    WHERE id = p_delivery_id AND user_id = v_user FOR UPDATE;
  IF v_old IN ('Entregue','Cancelada') OR v_order_status IN ('Cancelado','Concluído') THEN
    RAISE EXCEPTION 'Atendimento já finalizado.';
  END IF;
  IF NOT (
    (v_old = 'Pendente' AND p_new_status = 'Em andamento') OR
    (v_old = 'Em andamento' AND p_new_status = 'Entregue')
  ) THEN RAISE EXCEPTION 'Transição de entrega inválida.'; END IF;
  IF p_new_status = 'Entregue' AND v_order_status <> 'Pronto' THEN
    RAISE EXCEPTION 'Marque o pedido como Pronto antes de concluir a entrega.';
  END IF;
  UPDATE public.deliveries SET status = p_new_status,
    delivered_at = CASE WHEN p_new_status = 'Entregue' THEN now() ELSE delivered_at END
    WHERE id = p_delivery_id AND user_id = v_user;
  IF p_new_status = 'Entregue' THEN
    UPDATE public.orders SET status = 'Concluído' WHERE id = v_order AND user_id = v_user;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.agrovia_create_order(uuid,text,jsonb,text,text,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agrovia_change_order_status(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agrovia_change_delivery_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agrovia_create_order(uuid,text,jsonb,text,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agrovia_change_order_status(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agrovia_change_delivery_status(uuid,text) TO authenticated;
COMMIT;
