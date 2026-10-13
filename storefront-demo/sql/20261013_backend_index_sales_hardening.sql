-- Early Storefront schema performance and idempotent sales hardening.
-- Scoped entirely to early_storefront; no changes to Exam Bank tables.
CREATE INDEX IF NOT EXISTS es_sales_store_created_desc
 ON early_storefront.sales (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS es_movements_store_created_desc
 ON early_storefront.stock_movements (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS es_products_store_created_active
 ON early_storefront.products (store_id, created_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS es_stores_published_name
 ON early_storefront.stores (name, id) WHERE status = 'published';
-- Duplicate indexes with identical predicates create unnecessary write overhead.
DROP INDEX IF EXISTS early_storefront.es_products_active;
DROP INDEX IF EXISTS early_storefront.early_storefront_product_visible_idx;

CREATE OR REPLACE FUNCTION early_storefront.record_sale(
 p_store uuid,p_product uuid,p_unit uuid,p_quantity bigint,p_request_key uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 v_unit record;
 v_prior record;
 v_id uuid;
 v_remaining bigint;
 v_base bigint;
BEGIN
 IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 100000 OR p_request_key IS NULL THEN
  RAISE EXCEPTION 'Invalid sale request' USING ERRCODE='22023';
 END IF;
 SELECT id,product_id,unit_id,quantity INTO v_prior
 FROM early_storefront.sales WHERE store_id=p_store AND request_key=p_request_key;
 IF FOUND THEN
  IF v_prior.product_id<>p_product OR v_prior.unit_id<>p_unit OR v_prior.quantity<>p_quantity THEN
   RAISE EXCEPTION 'Idempotency key reused for a different sale' USING ERRCODE='22023';
  END IF;
  RETURN v_prior.id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM early_storefront.products
  WHERE id=p_product AND store_id=p_store AND archived_at IS NULL) THEN
  RAISE EXCEPTION 'Product not found';
 END IF;
 SELECT factor,price_ngn INTO v_unit FROM early_storefront.units
 WHERE id=p_unit AND store_id=p_store AND product_id=p_product AND active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Selling unit not found'; END IF;
 v_base:=p_quantity*v_unit.factor;
 UPDATE early_storefront.stock SET quantity_base=quantity_base-v_base
 WHERE store_id=p_store AND product_id=p_product AND quantity_base>=v_base
 RETURNING quantity_base INTO v_remaining;
 IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
 INSERT INTO early_storefront.sales(store_id,product_id,unit_id,quantity,quantity_base,price_ngn,request_key)
 VALUES(p_store,p_product,p_unit,p_quantity,v_base,v_unit.price_ngn,p_request_key)
 RETURNING id INTO v_id;
 INSERT INTO early_storefront.stock_movements(store_id,product_id,delta_base,reason)
 VALUES(p_store,p_product,-v_base,'sale');
 RETURN v_id;
EXCEPTION WHEN unique_violation THEN
 SELECT id,product_id,unit_id,quantity INTO v_prior FROM early_storefront.sales
 WHERE store_id=p_store AND request_key=p_request_key;
 IF FOUND THEN
  IF v_prior.product_id<>p_product OR v_prior.unit_id<>p_unit OR v_prior.quantity<>p_quantity THEN
   RAISE EXCEPTION 'Idempotency key reused for a different sale' USING ERRCODE='22023';
  END IF;
  RETURN v_prior.id;
 END IF;
 RAISE;
END $$;
