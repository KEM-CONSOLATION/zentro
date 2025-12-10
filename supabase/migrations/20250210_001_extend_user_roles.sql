-- Extend user_role enum to include additional roles used by the app
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'branch_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'tenant_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';

