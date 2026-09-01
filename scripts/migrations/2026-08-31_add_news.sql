\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS public.news (
    id SERIAL PRIMARY KEY,
    public_id VARCHAR(32) NOT NULL UNIQUE,
    scope VARCHAR(20) NOT NULL,
    organization_id INTEGER REFERENCES public.organizations(id) ON DELETE CASCADE,
    laboratory_id INTEGER REFERENCES public.laboratories_organizations(id) ON DELETE CASCADE,
    author_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,
    cover_url TEXT,
    gallery_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_news_scope CHECK (scope IN ('platform', 'organization', 'laboratory')),
    CONSTRAINT ck_news_status CHECK (status IN ('draft', 'published', 'blocked')),
    CONSTRAINT ck_news_owner CHECK (
        (scope = 'platform' AND organization_id IS NULL AND laboratory_id IS NULL)
        OR (scope = 'organization' AND organization_id IS NOT NULL AND laboratory_id IS NULL)
        OR (scope = 'laboratory' AND organization_id IS NULL AND laboratory_id IS NOT NULL)
    )
);

ALTER TABLE public.news
    ADD COLUMN IF NOT EXISTS gallery_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.news
    ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_news_status_published
    ON public.news (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_organization
    ON public.news (organization_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_laboratory
    ON public.news (laboratory_id, status, published_at DESC);

CREATE TABLE IF NOT EXISTS public.news_employees (
    news_id INTEGER NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_news_employees_employee
    ON public.news_employees (employee_id);

COMMENT ON TABLE public.news IS 'Platform, organization, and laboratory news';
COMMENT ON COLUMN public.news.content IS 'Validated TipTap JSON document';
COMMENT ON COLUMN public.news.gallery_urls IS 'Validated photo album image URLs';
COMMENT ON COLUMN public.news.attachments IS 'Validated attachment metadata';
COMMENT ON TABLE public.news_employees IS 'Employees mentioned in a news publication';

COMMIT;
