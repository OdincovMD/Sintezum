\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.equipment_organizations
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.employees
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.equipment_organizations
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

COMMENT ON COLUMN public.employees.created_at
    IS 'Creation timestamp; NULL for records created before migration';

COMMENT ON COLUMN public.equipment_organizations.created_at
    IS 'Creation timestamp; NULL for records created before migration';

COMMIT;
