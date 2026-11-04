-- Fineract keeps a tenant registry DB plus one DB per tenant.
CREATE DATABASE fineract_tenants;
CREATE DATABASE fineract_default;
-- The back office's own database (services/backoffice/server/postgresStore.ts).
CREATE DATABASE micobro_backoffice;
-- The live suite's own copy, so test businesses never reach the real one.
CREATE DATABASE micobro_backoffice_test;
