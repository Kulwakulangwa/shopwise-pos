
-- ===== roles & profiles =====
CREATE TYPE public.app_role AS ENUM ('owner','manager','cashier','storekeeper');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  job_title text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roles (
  name public.app_role PRIMARY KEY,
  description text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner')
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'owner'::public.app_role ELSE 'cashier'::public.app_role END);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.roles (name, description, permissions) VALUES
 ('owner','Full access to every module including finance and admin','["*"]'::jsonb),
 ('manager','Inventory, sales, purchasing, customers, suppliers','["inventory","sales","purchasing","customers","suppliers","reports"]'::jsonb),
 ('cashier','POS, sales and stock level viewing','["pos","sales","stock_view"]'::jsonb),
 ('storekeeper','Inventory, stock movements and goods receiving','["inventory","stock_in","stock_out","adjustments","receiving"]'::jsonb);

-- ===== inventory =====
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  brand text,
  model text,
  unit text NOT NULL DEFAULT 'pcs',
  cost_price numeric(14,2) NOT NULL DEFAULT 0,
  selling_price numeric(14,2) NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  tracks_serial boolean NOT NULL DEFAULT false,
  warranty_months integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id)
);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in','out','adjustment')),
  quantity integer NOT NULL,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.serial_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  serial text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold','returned','defective')),
  invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== customers & suppliers =====
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  tin text,
  credit_limit numeric(14,2) NOT NULL DEFAULT 0,
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== sales =====
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','converted')),
  valid_until date,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','fulfilled','cancelled','invoiced')),
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('draft','completed','partially_paid','paid','cancelled')),
  is_credit_sale boolean NOT NULL DEFAULT false,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text,
  due_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  cost_price numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  serials text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE public.sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL UNIQUE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  reason text,
  restock boolean NOT NULL DEFAULT true,
  refund_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_return_id uuid NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bank_name text,
  account_number text,
  account_type text NOT NULL DEFAULT 'bank' CHECK (account_type IN ('bank','cash','mobile')),
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'cash',
  reference text,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT now()
);

-- ===== purchasing =====
CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','converted')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  estimated_cost numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_request_id uuid REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','partially_received','received','cancelled')),
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  expected_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  received_quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  notes text,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partially_paid','paid')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_invoice_id uuid REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'cash',
  reference text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT now()
);

-- ===== warranty =====
CREATE TABLE public.warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_item_id uuid REFERENCES public.invoice_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  serial text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','void')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_id uuid NOT NULL REFERENCES public.warranties(id) ON DELETE CASCADE,
  claim_number text NOT NULL UNIQUE,
  issue text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_service','resolved','rejected')),
  resolution text,
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== finance =====
CREATE TABLE public.incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'other',
  description text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'other',
  description text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  spent_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  description text,
  reference_type text,
  reference_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (key, value) VALUES
 ('company', '{"name":"My Shop","currency":"TZS","phone":"","address":""}'::jsonb),
 ('credit_policy', '{"mode":"warn"}'::jsonb),
 ('tax', '{"rate":0}'::jsonb);

-- ===== grants, RLS, policies =====
DO $$
DECLARE t text;
  staff_tables text[] := ARRAY[
    'profiles','categories','warehouses','products','stock_levels','stock_movements','serial_numbers',
    'customers','suppliers','quotations','quotation_items','sales_orders','sales_order_items',
    'invoices','invoice_items','sales_returns','sales_return_items','bank_accounts','customer_payments',
    'purchase_requests','purchase_request_items','purchase_orders','purchase_order_items',
    'goods_receipts','goods_receipt_items','supplier_invoices','supplier_payments',
    'warranties','warranty_claims','incomes','expenses','cash_transactions'
  ];
  owner_tables text[] := ARRAY['roles','user_roles','system_settings'];
BEGIN
  FOREACH t IN ARRAY staff_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "staff_read_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY "staff_write_%1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY "staff_update_%1$s" ON public.%1$I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY "staff_delete_%1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.is_owner() OR public.has_role(auth.uid(), ''manager''))', t);
  END LOOP;

  FOREACH t IN ARRAY owner_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "read_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY "owner_write_%1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner())', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_read" ON public.activity_logs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "logs_insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_stock_levels_product ON public.stock_levels(product_id);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX idx_invoices_created ON public.invoices(created_at);
