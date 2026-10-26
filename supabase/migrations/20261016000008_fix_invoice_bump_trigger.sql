-- Migration: Fix erroneous BEFORE ROW trigger on invoices
-- Issue: trg_bump_data_version was created as a BEFORE ROW trigger with a function that returned NULL,
-- causing Postgres to abort all row inserts into invoices and leaving v_new_inv as NULL,
-- which triggered: null value in column "invoice_id" of relation "invoice_audit" violates not-null constraint.

DROP TRIGGER IF EXISTS trg_bump_data_version ON public.invoices;

CREATE OR REPLACE FUNCTION public.fn_bump_data_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.data_version
    SET version = version + 1
    WHERE id = 1;
    RETURN COALESCE(NEW, OLD);
END;
$$;
