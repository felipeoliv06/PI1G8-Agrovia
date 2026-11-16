-- Agrovia 1.15 - edicao segura de dados operacionais da entrega.
CREATE OR REPLACE FUNCTION public.agrovia_update_delivery_details(
 p_delivery_id uuid, p_address text, p_scheduled_date timestamptz, p_notes text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_status text; v_order_status text;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Faça login para editar entregas.'; END IF;
 SELECT d.status, o.status INTO v_status,v_order_status
 FROM public.deliveries d JOIN public.orders o ON o.id=d.order_id AND o.user_id=d.user_id
 WHERE d.id=p_delivery_id AND d.user_id=v_user FOR UPDATE OF d,o;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega não encontrada.'; END IF;
 IF v_status IN ('Entregue','Cancelada') OR v_order_status IN ('Concluído','Cancelado') THEN
  RAISE EXCEPTION 'Não é possível editar uma entrega finalizada.';
 END IF;
 IF length(coalesce(p_address,''))>1000 OR length(coalesce(p_notes,''))>2000 THEN
  RAISE EXCEPTION 'Endereço ou observações excedem o limite.';
 END IF;
 UPDATE public.deliveries SET address=nullif(trim(p_address),''),
 scheduled_date=p_scheduled_date,notes=nullif(trim(p_notes),'')
 WHERE id=p_delivery_id AND user_id=v_user;
END $$;
REVOKE ALL ON FUNCTION public.agrovia_update_delivery_details(uuid,text,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agrovia_update_delivery_details(uuid,text,timestamptz,text) TO authenticated;
