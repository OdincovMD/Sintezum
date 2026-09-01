\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS hidden_public_sections JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.laboratories_organizations
    ADD COLUMN IF NOT EXISTS hidden_public_sections JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.organizations.hidden_public_sections
    IS 'Public profile sections hidden by the organization owner';

COMMENT ON COLUMN public.laboratories_organizations.hidden_public_sections
    IS 'Public profile sections hidden by the laboratory owner';

COMMIT;
