-- Prisma uses quoted camelCase column names. The original trigger referenced
-- NEW.updated_at, which breaks every User update on the live database.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_updated_at ON public."User";
CREATE TRIGGER update_user_updated_at
BEFORE UPDATE ON public."User"
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
