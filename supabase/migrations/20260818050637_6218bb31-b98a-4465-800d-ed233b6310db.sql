
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','sales','production');
CREATE TYPE public.order_status AS ENUM ('draft','confirmed','in_production','quality_check','alteration_required','ready_for_delivery','delivered','completed','cancelled');
CREATE TYPE public.order_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.stage_status AS ENUM ('not_started','in_progress','completed','blocked');
CREATE TYPE public.production_stage AS ENUM ('fabric_procurement','cutting','stitching','embroidery_printing','packing');
CREATE TYPE public.quality_status AS ENUM ('pending_inspection','passed','failed','alteration_required','ready_for_delivery','delivered','completed');
CREATE TYPE public.alteration_status AS ENUM ('open','in_progress','completed','verified');

-- UTIL
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.can_sell() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales');
$$;

CREATE OR REPLACE FUNCTION public.can_produce() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production');
$$;

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth_user_id = auth.uid() OR public.is_admin()) WITH CHECK (auth_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "admin insert profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin delete profile" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- signup handler: first user becomes admin, others get sales/production from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE requested TEXT; final_role public.app_role; admin_exists BOOLEAN;
BEGIN
  INSERT INTO public.profiles (auth_user_id, full_name, organization, email)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'organization',''),
    COALESCE(NEW.email,''));

  requested := COALESCE(NEW.raw_user_meta_data->>'role','sales');
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') INTO admin_exists;
  IF NOT admin_exists THEN
    final_role := 'admin';
  ELSIF requested = 'production' THEN
    final_role := 'production';
  ELSE
    final_role := 'sales';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, final_role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  organization TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers read" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.can_sell());
CREATE POLICY "customers update" ON public.customers FOR UPDATE TO authenticated USING (public.can_sell()) WITH CHECK (public.can_sell());
CREATE POLICY "customers delete" ON public.customers FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_customers_name ON public.customers (customer_name);

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  batch_number TEXT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  created_by UUID,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status public.order_status NOT NULL DEFAULT 'draft',
  priority public.order_priority NOT NULL DEFAULT 'normal',
  product_name TEXT,
  product_category TEXT,
  total_quantity INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  fabric_details TEXT,
  accessory_details TEXT,
  customization_details TEXT,
  special_instructions TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders read" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.can_sell());
CREATE POLICY "orders update" ON public.orders FOR UPDATE TO authenticated USING (public.can_sell() OR public.can_produce()) WITH CHECK (public.can_sell() OR public.can_produce());
CREATE POLICY "orders delete" ON public.orders FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_orders_number ON public.orders (order_number);
CREATE INDEX idx_orders_batch ON public.orders (batch_number);
CREATE INDEX idx_orders_customer ON public.orders (customer_id);
CREATE INDEX idx_orders_status ON public.orders (status);
CREATE INDEX idx_orders_delivery ON public.orders (expected_delivery_date);
CREATE INDEX idx_orders_created_at ON public.orders (created_at DESC);

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_type TEXT,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  fabric TEXT,
  color TEXT,
  customization TEXT,
  size_quantities JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items read" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items write" ON public.order_items FOR ALL TO authenticated USING (public.can_sell()) WITH CHECK (public.can_sell());
CREATE INDEX idx_items_order ON public.order_items (order_id);

-- PRODUCTION STAGES
CREATE TABLE public.production_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage public.production_stage NOT NULL,
  status public.stage_status NOT NULL DEFAULT 'not_started',
  started_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  assigned_to UUID,
  notes TEXT,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  issues TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, stage)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_stages TO authenticated;
GRANT ALL ON public.production_stages TO service_role;
ALTER TABLE public.production_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stages read" ON public.production_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "stages write" ON public.production_stages FOR ALL TO authenticated USING (public.can_produce() OR public.can_sell()) WITH CHECK (public.can_produce() OR public.can_sell());
CREATE TRIGGER stages_updated_at BEFORE UPDATE ON public.production_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_stages_order ON public.production_stages (order_id);
CREATE INDEX idx_stages_status ON public.production_stages (status);

-- auto create stages on order insert
CREATE OR REPLACE FUNCTION public.seed_production_stages() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.production_stages (order_id, stage)
  SELECT NEW.id, s FROM unnest(ARRAY['fabric_procurement','cutting','stitching','embroidery_printing','packing']::public.production_stage[]) AS s
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER orders_seed_stages AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.seed_production_stages();

-- PRODUCTION IMAGES
CREATE TABLE public.production_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage public.production_stage,
  image_path TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_images TO authenticated;
GRANT ALL ON public.production_images TO service_role;
ALTER TABLE public.production_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "images read" ON public.production_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "images insert" ON public.production_images FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "images delete" ON public.production_images FOR DELETE TO authenticated USING (public.is_admin() OR uploaded_by = auth.uid());
CREATE INDEX idx_images_order ON public.production_images (order_id);

-- QUALITY
CREATE TABLE public.quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inspector_id UUID,
  quantity_inspected INTEGER NOT NULL DEFAULT 0 CHECK (quantity_inspected >= 0),
  quantity_passed INTEGER NOT NULL DEFAULT 0 CHECK (quantity_passed >= 0),
  quantity_failed INTEGER NOT NULL DEFAULT 0 CHECK (quantity_failed >= 0),
  defect_count INTEGER NOT NULL DEFAULT 0 CHECK (defect_count >= 0),
  client_feedback TEXT,
  quality_notes TEXT,
  status public.quality_status NOT NULL DEFAULT 'pending_inspection',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_inspections TO authenticated;
GRANT ALL ON public.quality_inspections TO service_role;
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qc read" ON public.quality_inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "qc write" ON public.quality_inspections FOR ALL TO authenticated USING (public.can_produce() OR public.can_sell()) WITH CHECK (public.can_produce() OR public.can_sell());
CREATE TRIGGER qc_updated_at BEFORE UPDATE ON public.quality_inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_qc_order ON public.quality_inspections (order_id);

-- ALTERATIONS
CREATE TABLE public.alterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  issue_description TEXT NOT NULL,
  affected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (affected_quantity >= 0),
  correction_required TEXT,
  assigned_to UUID,
  priority public.order_priority NOT NULL DEFAULT 'normal',
  status public.alteration_status NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alterations TO authenticated;
GRANT ALL ON public.alterations TO service_role;
ALTER TABLE public.alterations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alt read" ON public.alterations FOR SELECT TO authenticated USING (true);
CREATE POLICY "alt write" ON public.alterations FOR ALL TO authenticated USING (public.can_produce() OR public.can_sell()) WITH CHECK (public.can_produce() OR public.can_sell());
CREATE TRIGGER alt_updated_at BEFORE UPDATE ON public.alterations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_alt_order ON public.alterations (order_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif read own" ON public.notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "notif insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notif update own" ON public.notifications FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
CREATE POLICY "notif delete own" ON public.notifications FOR DELETE TO authenticated USING (recipient_id = auth.uid() OR public.is_admin());
CREATE INDEX idx_notif_recipient ON public.notifications (recipient_id, is_read);

-- ACTIVITY LOG
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity read" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_activity_order ON public.activity_log (order_id, created_at DESC);

-- SETTINGS
CREATE TABLE public.org_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'Uniform Studio 81',
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.org_settings TO authenticated;
GRANT ALL ON public.org_settings TO service_role;
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.org_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings write" ON public.org_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.org_settings (id, company_name, address, phone, email)
VALUES (1, 'Uniform Studio 81', 'Plot 81, Industrial Estate', '+91 98000 00081', 'orders@uniformstudio81.com');

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_stages;

-- DEMO CUSTOMERS + ORDERS
INSERT INTO public.customers (customer_code, customer_name, organization, phone, email, address, city, state, notes) VALUES
('CUS-001','Ravi Menon','Greenfield International School','+91 98450 11223','ravi@greenfield.edu','12 Campus Road','Bengaluru','Karnataka','Annual school uniform contract'),
('CUS-002','Priya Nair','Apex Hospitality Group','+91 98765 44556','priya@apexhotels.in','5 Marine Drive','Mumbai','Maharashtra','Hotel staff uniforms, quarterly'),
('CUS-003','Imran Sheikh','Precision Auto Works','+91 99887 66554','imran@precisionauto.in','Plot 44 MIDC','Pune','Maharashtra','Industrial coveralls'),
('CUS-004','Anita Desai','CareWell Hospitals','+91 90123 45678','anita@carewell.org','88 Health Avenue','Hyderabad','Telangana','Scrubs and lab coats');

INSERT INTO public.orders (order_number, batch_number, customer_id, order_date, expected_delivery_date, status, priority, product_name, product_category, total_quantity, fabric_details, accessory_details, customization_details, special_instructions, remarks)
SELECT 'ORD-1001','B-24A', id, CURRENT_DATE - 20, CURRENT_DATE + 10, 'in_production','high','Boys Formal Shirt','School Uniform', 130, 'Poly-cotton 65/35, white', 'Pearl buttons, woven label', 'School crest embroidery on pocket', 'Pack size-wise in labelled bundles', 'Repeat of last year spec' FROM public.customers WHERE customer_code='CUS-001';
INSERT INTO public.orders (order_number, batch_number, customer_id, order_date, expected_delivery_date, status, priority, product_name, product_category, total_quantity, fabric_details, accessory_details, customization_details)
SELECT 'ORD-1002','B-24B', id, CURRENT_DATE - 12, CURRENT_DATE + 4, 'quality_check','urgent','Front Office Blazer','Hospitality', 60, 'Terry-rayon, navy', 'Metal buttons, satin lining', 'Gold thread monogram' FROM public.customers WHERE customer_code='CUS-002';
INSERT INTO public.orders (order_number, batch_number, customer_id, order_date, expected_delivery_date, status, priority, product_name, product_category, total_quantity, fabric_details, accessory_details)
SELECT 'ORD-1003','B-24C', id, CURRENT_DATE - 30, CURRENT_DATE - 2, 'alteration_required','high','Industrial Coverall','Industrial', 90, 'Cotton drill 240 GSM, grey', 'Reflective tape, heavy zipper' FROM public.customers WHERE customer_code='CUS-003';
INSERT INTO public.orders (order_number, batch_number, customer_id, order_date, expected_delivery_date, status, priority, product_name, product_category, total_quantity, fabric_details)
SELECT 'ORD-1004','B-24D', id, CURRENT_DATE - 5, CURRENT_DATE + 20, 'confirmed','normal','Medical Scrub Set','Healthcare', 200, 'Poly-viscose stretch, teal' FROM public.customers WHERE customer_code='CUS-004';
INSERT INTO public.orders (order_number, batch_number, customer_id, order_date, expected_delivery_date, status, priority, product_name, product_category, total_quantity)
SELECT 'ORD-1005','B-23Z', id, CURRENT_DATE - 60, CURRENT_DATE - 25, 'completed','normal','Girls Pinafore','School Uniform', 150 FROM public.customers WHERE customer_code='CUS-001';

INSERT INTO public.order_items (order_id, product_name, product_type, description, quantity, unit_price, total_price, fabric, color, customization, size_quantities)
SELECT id,'Boys Formal Shirt','Shirt','Half sleeve formal shirt',130,320,41600,'Poly-cotton','White','Crest embroidery','{"XS":10,"S":25,"M":40,"L":35,"XL":20}'::jsonb FROM public.orders WHERE order_number='ORD-1001';
INSERT INTO public.order_items (order_id, product_name, product_type, description, quantity, unit_price, total_price, fabric, color, customization, size_quantities)
SELECT id,'Front Office Blazer','Blazer','Single breasted blazer',60,2400,144000,'Terry-rayon','Navy','Gold monogram','{"S":10,"M":20,"L":20,"XL":10}'::jsonb FROM public.orders WHERE order_number='ORD-1002';
INSERT INTO public.order_items (order_id, product_name, product_type, description, quantity, unit_price, total_price, fabric, color, customization, size_quantities)
SELECT id,'Industrial Coverall','Coverall','Full body coverall',90,1150,103500,'Cotton drill','Grey','Reflective tape','{"M":30,"L":35,"XL":25}'::jsonb FROM public.orders WHERE order_number='ORD-1003';
INSERT INTO public.order_items (order_id, product_name, product_type, description, quantity, unit_price, total_price, fabric, color, size_quantities)
SELECT id,'Medical Scrub Set','Scrub','Top and trouser set',200,890,178000,'Poly-viscose','Teal','{"S":40,"M":70,"L":60,"XL":30}'::jsonb FROM public.orders WHERE order_number='ORD-1004';

UPDATE public.production_stages ps SET status='completed', progress=100, started_date=now()-interval '18 days', completed_date=now()-interval '12 days'
FROM public.orders o WHERE ps.order_id=o.id AND o.order_number='ORD-1001' AND ps.stage IN ('fabric_procurement','cutting');
UPDATE public.production_stages ps SET status='in_progress', progress=55, started_date=now()-interval '10 days', notes='Line 2 running'
FROM public.orders o WHERE ps.order_id=o.id AND o.order_number='ORD-1001' AND ps.stage='stitching';
UPDATE public.production_stages ps SET status='completed', progress=100, started_date=now()-interval '11 days', completed_date=now()-interval '3 days'
FROM public.orders o WHERE ps.order_id=o.id AND o.order_number='ORD-1002';
UPDATE public.production_stages ps SET status='blocked', progress=40, issues='Reflective tape stock short', started_date=now()-interval '20 days'
FROM public.orders o WHERE ps.order_id=o.id AND o.order_number='ORD-1003' AND ps.stage='stitching';
UPDATE public.production_stages ps SET status='completed', progress=100, completed_date=now()-interval '40 days'
FROM public.orders o WHERE ps.order_id=o.id AND o.order_number='ORD-1005';

INSERT INTO public.quality_inspections (order_id, inspection_date, quantity_inspected, quantity_passed, quantity_failed, defect_count, quality_notes, status)
SELECT id, CURRENT_DATE - 2, 60, 54, 6, 8, 'Six blazers with uneven lapel stitching', 'failed' FROM public.orders WHERE order_number='ORD-1002';
INSERT INTO public.quality_inspections (order_id, inspection_date, quantity_inspected, quantity_passed, quantity_failed, defect_count, quality_notes, status)
SELECT id, CURRENT_DATE - 30, 150, 150, 0, 0, 'All units passed', 'completed' FROM public.orders WHERE order_number='ORD-1005';

INSERT INTO public.alterations (order_id, issue_description, affected_quantity, correction_required, priority, status)
SELECT id, 'Uneven lapel stitching on six blazers', 6, 'Re-stitch lapels and press', 'high', 'in_progress' FROM public.orders WHERE order_number='ORD-1002';
INSERT INTO public.alterations (order_id, issue_description, affected_quantity, correction_required, priority, status)
SELECT id, 'Reflective tape missing on sleeves', 25, 'Attach reflective tape as per spec', 'urgent', 'open' FROM public.orders WHERE order_number='ORD-1003';

INSERT INTO public.activity_log (order_id, actor_name, action)
SELECT id, 'System', 'Order created' FROM public.orders;
