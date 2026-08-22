-- ============================================================
-- Uniform Studio 81
-- Order Sheet Fields Migration
-- ============================================================
--
-- Purpose:
-- Extend the existing orders / order_items tables so the
-- application can reproduce the EFZEE Fashion order-sheet
-- workflow without replacing the existing schema.
--
-- IMPORTANT:
-- This migration is intentionally additive.
-- Existing order data is preserved.
-- ============================================================


-- ============================================================
-- 1. ORDER-LEVEL FIELDS
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_owner UUID;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subject TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS brand TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS contact_person TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS po_number TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quotation_number TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deal_reference TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pps_production TEXT;


-- ============================================================
-- 2. ORDER-LEVEL INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_order_owner
  ON public.orders (order_owner);

CREATE INDEX IF NOT EXISTS idx_orders_po_number
  ON public.orders (po_number);

CREATE INDEX IF NOT EXISTS idx_orders_quotation_number
  ON public.orders (quotation_number);

CREATE INDEX IF NOT EXISTS idx_orders_brand
  ON public.orders (brand);

CREATE INDEX IF NOT EXISTS idx_orders_contact_person
  ON public.orders (contact_person);

CREATE INDEX IF NOT EXISTS idx_orders_order_type
  ON public.orders (order_type);


-- ============================================================
-- 3. ITEM-LEVEL ORDER-SHEET FIELDS
-- ============================================================
--
-- These fields correspond to the columns shown on the
-- company's original order sheet:
--
-- FABRIC SUPPLIER / CM UNIT
-- FABRIC / COLOR
-- EMB/PRINT
-- UNIT
-- STYLE COMMENTS
--
-- size_quantities remains JSONB because it already exists and
-- allows XS, S, M, L, XL, 2XL, 3XL, 42, MTM and custom sizes.
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS fabric_supplier TEXT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cm_unit TEXT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS fabric_color TEXT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS emb_print TEXT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit TEXT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS style_comments TEXT;


-- ============================================================
-- 4. BACKWARD COMPATIBILITY
-- ============================================================
--
-- Existing records may already have values in:
--
-- order_items.fabric
-- order_items.color
-- order_items.customization
--
-- The new explicit fields are populated from those old fields
-- where possible.
--
-- We do NOT overwrite existing new values.
-- ============================================================

UPDATE public.order_items
SET
  fabric_color = COALESCE(
    NULLIF(
      CONCAT_WS(
        CASE
          WHEN fabric IS NOT NULL AND color IS NOT NULL
            THEN ' / '
          ELSE ''
        END,
        NULLIF(fabric, ''),
        NULLIF(color, '')
      ),
      ''
    ),
    fabric_color
  )
WHERE fabric_color IS NULL
  AND (fabric IS NOT NULL OR color IS NOT NULL);


UPDATE public.order_items
SET
  emb_print = customization
WHERE emb_print IS NULL
  AND customization IS NOT NULL;


-- ============================================================
-- 5. COMMENTS
-- ============================================================

COMMENT ON COLUMN public.orders.order_owner IS
  'User responsible for owning/managing the order.';

COMMENT ON COLUMN public.orders.subject IS
  'Internal order subject/title.';

COMMENT ON COLUMN public.orders.brand IS
  'Brand shown on the company order sheet.';

COMMENT ON COLUMN public.orders.contact_person IS
  'Customer contact person shown on the order sheet.';

COMMENT ON COLUMN public.orders.po_number IS
  'Customer purchase order / LPO reference number.';

COMMENT ON COLUMN public.orders.quotation_number IS
  'Quotation reference associated with the order.';

COMMENT ON COLUMN public.orders.deal_reference IS
  'Optional sales/deal reference associated with the order.';

COMMENT ON COLUMN public.orders.delivery_address IS
  'Delivery address printed on the order sheet.';

COMMENT ON COLUMN public.orders.payment_terms IS
  'Payment terms associated with the order.';

COMMENT ON COLUMN public.orders.order_type IS
  'Operational order/production type.';

COMMENT ON COLUMN public.orders.pps_production IS
  'PPS / production state shown on the order sheet.';


COMMENT ON COLUMN public.order_items.fabric_supplier IS
  'Fabric supplier for this ordered item.';

COMMENT ON COLUMN public.order_items.cm_unit IS
  'CM unit for this ordered item.';

COMMENT ON COLUMN public.order_items.fabric_color IS
  'Fabric / colour specification for this ordered item.';

COMMENT ON COLUMN public.order_items.emb_print IS
  'Embroidery / printing specification.';

COMMENT ON COLUMN public.order_items.unit IS
  'Unit information for the ordered item.';

COMMENT ON COLUMN public.order_items.style_comments IS
  'Style-specific comments/instructions for the ordered item.';


-- ============================================================
-- 6. REALTIME
-- ============================================================
--
-- orders is already part of the realtime publication in the
-- existing schema. No additional publication change is needed.
--
-- order_items is intentionally not added here because the
-- current application does not require realtime item-level
-- updates.
-- ============================================================


-- ============================================================
-- END
-- ============================================================