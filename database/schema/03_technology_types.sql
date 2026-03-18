-- ############################################################################
-- # FILE: 03_technology_types.sql
-- # PURPOSE: Static registry of supported technologies and categories.
-- ############################################################################

BEGIN;

CREATE TABLE meta.technology_types (
    tech_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tech_code         TEXT NOT NULL UNIQUE, -- e.g. 'POSTGRESQL', 'AWS_S3'
    display_name      TEXT NOT NULL,        -- e.g. 'PostgreSQL', 'Amazon S3'
    category          TEXT NOT NULL,        -- e.g. 'RDBMS', 'CLOUD_STORAGE', 'FILE_FORMAT'
    icon_name         TEXT,                 -- Lucide icon name or similar (Database, Cloud, FileText)
    tech_desc_text    TEXT,
    created_dtm       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  meta.technology_types               IS 'Static registry of supported technologies (RDBMS, Cloud Storage, File Formats, etc.).';
COMMENT ON COLUMN meta.technology_types.tech_id       IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN meta.technology_types.tech_code     IS 'Machine-readable unique code matching connector_type_code.';
COMMENT ON COLUMN meta.technology_types.display_name  IS 'Human-readable label for the technology.';
COMMENT ON COLUMN meta.technology_types.category      IS 'Grouping category for the technology UI (e.g., RDBMS, CLOUD_STORAGE, ANALYTICS, FILES).';
COMMENT ON COLUMN meta.technology_types.icon_name     IS 'Logical icon name for UI rendering (Lucide icon identifier).';
COMMENT ON COLUMN meta.technology_types.tech_desc_text IS 'Brief description of the technology and its typical use case.';

-- Add technology_id to catalog.connectors
ALTER TABLE catalog.connectors
    ADD COLUMN technology_id UUID REFERENCES meta.technology_types(tech_id) ON DELETE SET NULL;

COMMENT ON COLUMN catalog.connectors.technology_id IS 'FK to the static technology type record. Ensures connections are grouped by technology.';

COMMIT;
