-- =============================================================================
-- MAIDAN — PostgreSQL Database Initialization
-- Run once when container starts for the first time.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fast text search
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- For Arabic/accented text search

-- Create the public schema tables will be handled by django-tenants migrations.
-- This script only sets up extensions and any manual config needed.

-- Allow case-insensitive text search (for Arabic transliteration)
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS arabic (COPY = simple);

COMMENT ON DATABASE maidan IS 'MAIDAN Sports Club Management System — Multi-tenant PostgreSQL database';
