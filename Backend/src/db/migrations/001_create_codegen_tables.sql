-- =============================================================================
-- Migration: 001_create_codegen_tables.sql
-- Creates all tables required by the Code Generation Engine
-- =============================================================================

-- ─── Pipelines ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipelines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    version         VARCHAR(50)  NOT NULL DEFAULT '1.0.0',
    description     TEXT,
    technology      VARCHAR(50)  NOT NULL,   -- 'pyspark' | 'scala-spark' | 'sql' | 'pandas'
    spark_version   VARCHAR(20),
    definition      JSONB        NOT NULL,   -- full PipelineDefinition JSON
    tags            JSONB,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_by      VARCHAR(255),
    updated_by      VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipelines_technology ON pipelines(technology);
CREATE INDEX idx_pipelines_name       ON pipelines(name);
CREATE INDEX idx_pipelines_active     ON pipelines(is_active);
CREATE INDEX idx_pipelines_tags       ON pipelines USING GIN(tags);

-- ─── Pipeline Versions (audit trail) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id     UUID         NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    version         VARCHAR(50)  NOT NULL,
    definition      JSONB        NOT NULL,
    change_summary  TEXT,
    created_by      VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_versions_pipeline_id ON pipeline_versions(pipeline_id);
CREATE INDEX idx_pipeline_versions_created_at  ON pipeline_versions(created_at DESC);

-- ─── Generated Artifacts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_artifacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id     UUID         NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    pipeline_version VARCHAR(50) NOT NULL,
    technology      VARCHAR(50)  NOT NULL,
    spark_version   VARCHAR(20),
    generation_options JSONB,
    metadata        JSONB        NOT NULL,   -- ArtifactMetadata
    files           JSONB        NOT NULL,   -- CodeFile[]
    warning_count   INT          NOT NULL DEFAULT 0,
    error_count     INT          NOT NULL DEFAULT 0,
    generated_by    VARCHAR(255),
    generated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_artifacts_pipeline_id   ON generated_artifacts(pipeline_id);
CREATE INDEX idx_artifacts_generated_at  ON generated_artifacts(generated_at DESC);
CREATE INDEX idx_artifacts_technology    ON generated_artifacts(technology);

-- ─── Pipeline Executions ──────────────────────────────────────────────────────
-- Tracks actual run metadata (linked from orchestrator callbacks)
CREATE TABLE IF NOT EXISTS pipeline_executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id     UUID         NOT NULL REFERENCES pipelines(id),
    artifact_id     UUID         REFERENCES generated_artifacts(id),
    execution_id    VARCHAR(255),            -- external orchestrator ID (Airflow DAG run, etc.)
    status          VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
    environment     VARCHAR(50),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    duration_seconds NUMERIC(10, 2),
    row_counts      JSONB,                   -- nodeId → rowCount
    error_message   TEXT,
    triggered_by    VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_executions_pipeline_id ON pipeline_executions(pipeline_id);
CREATE INDEX idx_executions_status      ON pipeline_executions(status);
CREATE INDEX idx_executions_started_at  ON pipeline_executions(started_at DESC);

-- ─── Node Templates / Reusable Snippets ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    category        VARCHAR(100),            -- 'source' | 'transformation' | 'sink'
    sub_type        VARCHAR(100),            -- 'jdbc' | 'filter' | 'delta' etc.
    technology      VARCHAR(50),             -- null = technology-agnostic
    description     TEXT,
    config_template JSONB        NOT NULL,
    tags            JSONB,
    is_public       BOOLEAN      NOT NULL DEFAULT true,
    created_by      VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_node_templates_category  ON node_templates(category);
CREATE INDEX idx_node_templates_sub_type  ON node_templates(sub_type);
CREATE INDEX idx_node_templates_tech      ON node_templates(technology);

-- ─── Auto-update updated_at trigger ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pipelines_updated_at
    BEFORE UPDATE ON pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_node_templates_updated_at
    BEFORE UPDATE ON node_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
