-- =====================================================
-- ADD ORGANIZATION BRANDING (LOGO & BRAND COLOR)
-- =====================================================
-- Adds logo_url and brand_color fields to organizations table
-- =====================================================

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#3B82F6';

-- Add comment
COMMENT ON COLUMN public.organizations.logo_url IS 'URL to organization logo image (optional)';
COMMENT ON COLUMN public.organizations.brand_color IS 'Primary brand color in hex format (e.g., #3B82F6). Default: #3B82F6';

