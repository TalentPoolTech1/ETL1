-- Migration 010: Allow NULL project_id in history.pipelines_history
--
-- Root cause: history.pipelines_history was created via LIKE catalog.pipelines,
-- inheriting the NOT NULL constraint on project_id. catalog.pipelines allows
-- global pipelines (project_id IS NULL) for the "Global Pipelines" feature.
-- Every save of a global pipeline fires the audit trigger, which fails because
-- history.pipelines_history.project_id cannot be NULL.
--
-- Fix: Drop the NOT NULL constraint from the history table only.
-- The source table (catalog.pipelines) retains its own rules.

ALTER TABLE history.pipelines_history
    ALTER COLUMN project_id DROP NOT NULL;
