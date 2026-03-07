-- ############################################################################
-- # FILE: persistence_logic.sql (formerly 11_persistence_logic.sql)
-- # PURPOSE: Step 12 of 12. Unsaved changes / draft tracking using etl schema.
-- #          Law 15: Autosave and session recovery support.
-- ############################################################################

BEGIN;

-- ============================================================================
-- READ OPERATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION etl.fn_get_user_draft(
    p_user_id UUID,
    p_entity_type_code TEXT,
    p_entity_id UUID DEFAULT NULL
)
RETURNS TABLE (draft_id UUID, draft_payload_json JSONB, updated_dtm TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
    SELECT draft_id, draft_payload_json, updated_dtm
    FROM etl.user_work_drafts
    WHERE user_id = p_user_id
      AND entity_type_code = p_entity_type_code
      AND (p_entity_id IS NULL OR entity_id = p_entity_id);
$$;
COMMENT ON FUNCTION etl.fn_get_user_draft(UUID, TEXT, UUID) IS 'Law 15: Retrieves the latest unsaved session state for a user. Called when the user reopens an asset they were editing.';
;
CREATE OR REPLACE FUNCTION etl.fn_get_all_user_drafts(p_user_id UUID)
RETURNS TABLE (draft_id UUID, entity_type_code TEXT, entity_id UUID, updated_dtm TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
    SELECT draft_id, entity_type_code, entity_id, updated_dtm
    FROM etl.user_work_drafts
    WHERE user_id = p_user_id
    ORDER BY updated_dtm DESC;
$$;
COMMENT ON FUNCTION etl.fn_get_all_user_drafts(UUID) IS 'Law 15: Returns all unsaved drafts for a user, enabling the "Recover unsaved work" UI panel.';
;
-- ============================================================================
-- WRITE OPERATIONS
-- ============================================================================

CREATE OR REPLACE PROCEDURE etl.pr_autosave_draft(
    p_user_id UUID,
    p_entity_type_code TEXT,
    p_entity_id UUID,
    p_draft_payload_json JSONB
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Law 15: Upsert ensures only one draft per user/entity combination
    INSERT INTO etl.user_work_drafts (user_id, entity_type_code, entity_id, draft_payload_json)
    VALUES (p_user_id, p_entity_type_code, p_entity_id, p_draft_payload_json)
    ON CONFLICT (user_id, entity_type_code, entity_id) DO UPDATE SET
        draft_payload_json = EXCLUDED.draft_payload_json,
        updated_dtm = CURRENT_TIMESTAMP;
END;
$$;
COMMENT ON PROCEDURE etl.pr_autosave_draft(UUID, TEXT, UUID, JSONB) IS 'Law 15: Called on every autosave keystroke. Upserts the draft payload for the user+entity combination. Idempotent — safe to call repeatedly.';
;
CREATE OR REPLACE PROCEDURE etl.pr_discard_draft(
    p_user_id UUID,
    p_entity_type_code TEXT,
    p_entity_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Physical delete — user has committed or explicitly rolled back
    DELETE FROM etl.user_work_drafts
    WHERE user_id = p_user_id
      AND entity_type_code = p_entity_type_code
      AND entity_id = p_entity_id;
END;
$$;
COMMENT ON PROCEDURE etl.pr_discard_draft(UUID, TEXT, UUID) IS 'Law 15: Called after a successful commit (pr_commit_pipeline_version) or explicit rollback. Physically removes the draft.';
;
COMMIT;
