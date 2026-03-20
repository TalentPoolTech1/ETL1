-- ############################################################################
-- # FILE: catalog_logic.sql (formerly 06_catalog_logic.sql)
-- # PURPOSE: Step 7 of 12. Connector, dataset, health monitoring, and
-- #          file format option CRUD using catalog schema.
-- ############################################################################

BEGIN;

-- Drop functions that have changed return types to allow CREATE OR REPLACE
DROP FUNCTION IF EXISTS catalog.fn_get_connectors();
DROP FUNCTION IF EXISTS catalog.fn_get_connectors_by_tech(TEXT, INTEGER, UUID);
DROP FUNCTION IF EXISTS catalog.fn_get_connector_by_id(UUID);

-- ============================================================================
-- READ OPERATIONS — CONNECTORS
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_get_connectors()
RETURNS TABLE (
    connector_id           UUID,
    connector_display_name TEXT,
    connector_type_code    TEXT,
    conn_ssl_mode          TEXT,
    conn_max_pool_size_num INTEGER,
    health_status_code     TEXT,
    created_by_full_name   TEXT,
    updated_dtm            TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT c.connector_id, c.connector_display_name, c.connector_type_code,
           c.conn_ssl_mode, c.conn_max_pool_size_num,
           COALESCE(h.health_status_code, 'UNKNOWN') AS health_status_code,
           u.user_full_name AS created_by_full_name, c.updated_dtm
    FROM catalog.connectors c
    LEFT JOIN etl.users u ON c.created_by_user_id = u.user_id
    LEFT JOIN catalog.connector_health h ON c.connector_id = h.connector_id
    ORDER BY c.connector_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_connectors() IS 'Lists all registered connectors with their type, SSL mode, pool size, and current health status. Config decryption only at execution time.';
;

-- Filtered connector list by technology code with keyset pagination
CREATE OR REPLACE FUNCTION catalog.fn_get_connectors_by_tech(
    p_tech_code   TEXT,
    p_limit       INTEGER DEFAULT 50,
    p_after_id    UUID    DEFAULT NULL
)
RETURNS TABLE (
    connector_id           UUID,
    connector_display_name TEXT,
    connector_type_code    TEXT,
    conn_ssl_mode          TEXT,
    conn_max_pool_size_num INTEGER,
    health_status_code     TEXT,
    created_by_full_name   TEXT,
    updated_dtm            TIMESTAMPTZ,
    technology_id          UUID
)
LANGUAGE sql STABLE AS $$
    SELECT c.connector_id, c.connector_display_name, c.connector_type_code,
           c.conn_ssl_mode, c.conn_max_pool_size_num,
           COALESCE(h.health_status_code, 'UNKNOWN') AS health_status_code,
           u.user_full_name AS created_by_full_name, c.updated_dtm,
           c.technology_id
    FROM catalog.connectors c
    LEFT JOIN etl.users u ON c.created_by_user_id = u.user_id
    LEFT JOIN catalog.connector_health h ON c.connector_id = h.connector_id
    LEFT JOIN meta.technology_types t ON c.technology_id = t.tech_id
    WHERE (p_tech_code IS NULL
           OR t.tech_code = p_tech_code
           OR (c.technology_id IS NULL AND c.connector_type_code ILIKE '%' || p_tech_code || '%'))
      AND (p_after_id IS NULL OR c.connector_id > p_after_id)
    ORDER BY c.connector_id
    LIMIT p_limit;
$$;
COMMENT ON FUNCTION catalog.fn_get_connectors_by_tech(TEXT, INTEGER, UUID) IS 'Lazy-loads connectors filtered by technology code with keyset pagination. p_after_id is the last connector_id from the previous page.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_connector_by_id(p_connector_id UUID)
RETURNS TABLE (
    connector_id           UUID,
    connector_display_name TEXT,
    connector_type_code    TEXT,
    conn_jdbc_driver_class TEXT,
    conn_test_query        TEXT,
    conn_spark_config_json JSONB,
    conn_ssl_mode          TEXT,
    conn_max_pool_size_num INTEGER,
    conn_idle_timeout_sec  INTEGER,
    health_status_code     TEXT,
    created_dtm            TIMESTAMPTZ,
    updated_dtm            TIMESTAMPTZ,
    created_by_user_id     UUID,
    updated_by_user_id     UUID,
    technology_id          UUID
)
LANGUAGE sql STABLE AS $$
    SELECT c.connector_id, c.connector_display_name, c.connector_type_code,
           c.conn_jdbc_driver_class, c.conn_test_query, c.conn_spark_config_json,
           c.conn_ssl_mode, c.conn_max_pool_size_num, c.conn_idle_timeout_sec,
           COALESCE(h.health_status_code, 'UNKNOWN'),
           c.created_dtm, c.updated_dtm, c.created_by_user_id, c.updated_by_user_id,
           c.technology_id
    FROM catalog.connectors c
    LEFT JOIN catalog.connector_health h ON c.connector_id = h.connector_id
    WHERE c.connector_id = p_connector_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_connector_by_id(UUID) IS 'Returns a single connector record with non-sensitive fields and health status. Encrypted blobs are NOT returned — use fn_get_connector_config_decrypted / fn_get_connector_secrets_decrypted for execution.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_connector_config_decrypted(p_connector_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $$
    SELECT pgp_sym_decrypt(conn_config_json_encrypted::BYTEA, current_setting('app.encryption_key'))::JSONB
    FROM catalog.connectors WHERE connector_id = p_connector_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_connector_config_decrypted(UUID) IS 'Law 3: Decrypts and returns the connector non-secret config as JSONB. Only callable by the execution engine or connection test service; never exposed to the UI.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_connector_secrets_decrypted(p_connector_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $$
    SELECT CASE
        WHEN conn_secrets_json_encrypted IS NOT NULL
        THEN pgp_sym_decrypt(conn_secrets_json_encrypted::BYTEA, current_setting('app.encryption_key'))::JSONB
        ELSE NULL
    END
    FROM catalog.connectors WHERE connector_id = p_connector_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_connector_secrets_decrypted(UUID) IS 'Law 3: Decrypts and returns the connector secrets blob as JSONB. Returns NULL for identity-based auth connectors. Only callable by the execution engine; never exposed to the UI. No PII in logs.';
;
-- ============================================================================
-- WRITE OPERATIONS — CONNECTORS
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_create_connector(
    p_connector_display_name     TEXT,
    p_connector_type_code        TEXT,
    p_conn_config_plain          JSONB,
    p_conn_secrets_plain         JSONB,
    p_conn_jdbc_driver_class     TEXT,
    p_conn_test_query            TEXT,
    p_conn_spark_config_json     JSONB,
    p_conn_ssl_mode              TEXT,
    p_conn_ssh_tunnel_plain      JSONB,
    p_conn_proxy_plain           JSONB,
    p_conn_max_pool_size_num     INTEGER,
    p_conn_idle_timeout_sec      INTEGER,
    p_created_by_user_id         UUID,
    p_technology_id              UUID,
    OUT p_connector_id           UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_enc_key TEXT := current_setting('app.encryption_key');
BEGIN
    -- Law 3: Encrypt all sensitive blobs before storage
    INSERT INTO catalog.connectors (
        connector_display_name, connector_type_code,
        conn_config_json_encrypted, conn_secrets_json_encrypted,
        conn_jdbc_driver_class, conn_test_query, conn_spark_config_json,
        conn_ssl_mode,
        conn_ssh_tunnel_json_encrypted, conn_proxy_json_encrypted,
        conn_max_pool_size_num, conn_idle_timeout_sec,
        created_by_user_id,
        technology_id
    )
    VALUES (
        p_connector_display_name,
        p_connector_type_code,
        pgp_sym_encrypt(p_conn_config_plain::TEXT, v_enc_key),
        CASE WHEN p_conn_secrets_plain IS NOT NULL
             THEN pgp_sym_encrypt(p_conn_secrets_plain::TEXT, v_enc_key)
             ELSE NULL END,
        p_conn_jdbc_driver_class,
        p_conn_test_query,
        p_conn_spark_config_json,
        COALESCE(p_conn_ssl_mode, 'REQUIRE'),
        CASE WHEN p_conn_ssh_tunnel_plain IS NOT NULL
             THEN pgp_sym_encrypt(p_conn_ssh_tunnel_plain::TEXT, v_enc_key)
             ELSE NULL END,
        CASE WHEN p_conn_proxy_plain IS NOT NULL
             THEN pgp_sym_encrypt(p_conn_proxy_plain::TEXT, v_enc_key)
             ELSE NULL END,
        COALESCE(p_conn_max_pool_size_num, 5),
        COALESCE(p_conn_idle_timeout_sec, 600),
        p_created_by_user_id,
        p_technology_id
    ) RETURNING connector_id INTO p_connector_id;

    -- Initialize health record as UNKNOWN
    INSERT INTO catalog.connector_health (connector_id, health_status_code)
    VALUES (p_connector_id, 'UNKNOWN');
END;
$$;
COMMENT ON PROCEDURE catalog.pr_create_connector(TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, INTEGER, INTEGER, UUID) IS 'Law 3: Registers a new connector with config, secrets, SSH tunnel, and proxy all encrypted via pgcrypto before storage. Initializes a health record in UNKNOWN state.';
;
DROP PROCEDURE IF EXISTS catalog.pr_update_connector(UUID, TEXT, JSONB, JSONB, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, INTEGER, INTEGER, UUID);
CREATE OR REPLACE PROCEDURE catalog.pr_update_connector(
    p_connector_id               UUID,
    p_connector_display_name     TEXT,
    p_conn_config_plain          JSONB,
    p_conn_secrets_plain         JSONB,
    p_conn_jdbc_driver_class     TEXT,
    p_conn_test_query            TEXT,
    p_conn_spark_config_json     JSONB,
    p_conn_ssl_mode              TEXT,
    p_conn_ssh_tunnel_plain      JSONB,
    p_conn_proxy_plain           JSONB,
    p_conn_max_pool_size_num     INTEGER,
    p_conn_idle_timeout_sec      INTEGER,
    p_updated_by_user_id         UUID,
    p_technology_id              UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_enc_key TEXT := current_setting('app.encryption_key');
BEGIN
    UPDATE catalog.connectors SET
        connector_display_name        = COALESCE(p_connector_display_name, connector_display_name),
        conn_config_json_encrypted    = CASE WHEN p_conn_config_plain IS NOT NULL
                                            THEN pgp_sym_encrypt(p_conn_config_plain::TEXT, v_enc_key)::TEXT
                                            ELSE conn_config_json_encrypted END,
        conn_secrets_json_encrypted   = CASE WHEN p_conn_secrets_plain IS NOT NULL
                                            THEN pgp_sym_encrypt(p_conn_secrets_plain::TEXT, v_enc_key)::TEXT
                                            ELSE conn_secrets_json_encrypted END,
        conn_jdbc_driver_class        = COALESCE(p_conn_jdbc_driver_class, conn_jdbc_driver_class),
        conn_test_query               = COALESCE(p_conn_test_query, conn_test_query),
        conn_spark_config_json        = COALESCE(p_conn_spark_config_json, conn_spark_config_json),
        conn_ssl_mode                 = COALESCE(p_conn_ssl_mode, conn_ssl_mode),
        conn_ssh_tunnel_json_encrypted = CASE WHEN p_conn_ssh_tunnel_plain IS NOT NULL
                                             THEN pgp_sym_encrypt(p_conn_ssh_tunnel_plain::TEXT, v_enc_key)::TEXT
                                             ELSE conn_ssh_tunnel_json_encrypted END,
        conn_proxy_json_encrypted     = CASE WHEN p_conn_proxy_plain IS NOT NULL
                                            THEN pgp_sym_encrypt(p_conn_proxy_plain::TEXT, v_enc_key)::TEXT
                                            ELSE conn_proxy_json_encrypted END,
        conn_max_pool_size_num        = COALESCE(p_conn_max_pool_size_num, conn_max_pool_size_num),
        conn_idle_timeout_sec         = COALESCE(p_conn_idle_timeout_sec, conn_idle_timeout_sec),
        updated_by_user_id            = p_updated_by_user_id,
        technology_id                 = COALESCE(p_technology_id, technology_id)
    WHERE connector_id = p_connector_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_update_connector(UUID, TEXT, JSONB, JSONB, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, INTEGER, INTEGER, UUID, UUID) IS 'Updates an existing connector. Only non-NULL parameters overwrite existing values. Re-encrypts config, secrets, SSH tunnel, and proxy if new plaintext is provided.';
;
CREATE OR REPLACE PROCEDURE catalog.pr_delete_connector(p_connector_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    -- Law 4: Physical delete. History trigger captures row before removal.
    -- CASCADE removes associated datasets, dataset_columns, health, file_format_options.
    DELETE FROM catalog.connectors WHERE connector_id = p_connector_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_delete_connector(UUID) IS 'Law 4: Physical deletion of a connector. Cascade removes associated datasets, columns, health, and file format options.';
;
-- ============================================================================
-- CONNECTOR HEALTH MONITORING
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_upsert_connector_health(
    p_connector_id       UUID,
    p_health_status_code TEXT,
    p_check_latency_ms   INTEGER,
    p_check_error_text   TEXT,
    p_next_check_dtm     TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalog.connector_health (
        connector_id, health_status_code, check_latency_ms, check_error_text,
        consecutive_fail_num, last_check_dtm, next_check_dtm
    )
    VALUES (
        p_connector_id, p_health_status_code, p_check_latency_ms, p_check_error_text,
        CASE WHEN p_health_status_code = 'HEALTHY' THEN 0 ELSE 1 END,
        CURRENT_TIMESTAMP, p_next_check_dtm
    )
    ON CONFLICT (connector_id) DO UPDATE SET
        health_status_code   = p_health_status_code,
        check_latency_ms     = p_check_latency_ms,
        check_error_text     = p_check_error_text,
        consecutive_fail_num = CASE
            WHEN p_health_status_code = 'HEALTHY' THEN 0
            ELSE catalog.connector_health.consecutive_fail_num + 1
        END,
        last_check_dtm       = CURRENT_TIMESTAMP,
        next_check_dtm       = p_next_check_dtm;

    -- Auto-degrade after 3 consecutive failures
    UPDATE catalog.connector_health
    SET health_status_code = 'DEGRADED'
    WHERE connector_id = p_connector_id
      AND consecutive_fail_num >= 3
      AND health_status_code != 'DEGRADED';
END;
$$;
COMMENT ON PROCEDURE catalog.pr_upsert_connector_health(UUID, TEXT, INTEGER, TEXT, TIMESTAMPTZ) IS 'Upserts health check results for a connector. Resets consecutive failures on HEALTHY, increments on failure, auto-degrades after 3 consecutive failures.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_connector_health(p_connector_id UUID)
RETURNS TABLE (
    health_status_code   TEXT,
    check_latency_ms     INTEGER,
    check_error_text     TEXT,
    consecutive_fail_num INTEGER,
    last_check_dtm       TIMESTAMPTZ,
    next_check_dtm       TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT health_status_code, check_latency_ms, check_error_text,
           consecutive_fail_num, last_check_dtm, next_check_dtm
    FROM catalog.connector_health
    WHERE connector_id = p_connector_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_connector_health(UUID) IS 'Returns the current health status for a connector. Used by the UI to show health indicators.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_connectors_due_health_check()
RETURNS TABLE (
    connector_id UUID,
    connector_type_code TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT c.connector_id, c.connector_type_code
    FROM catalog.connectors c
    JOIN catalog.connector_health h ON c.connector_id = h.connector_id
    WHERE h.next_check_dtm IS NOT NULL
      AND h.next_check_dtm <= CURRENT_TIMESTAMP
    ORDER BY h.next_check_dtm;
$$;
COMMENT ON FUNCTION catalog.fn_get_connectors_due_health_check() IS 'Returns connectors whose next health check is overdue. Used by the health check scheduler.';
;
-- ============================================================================
-- FILE FORMAT OPTIONS
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_upsert_file_format_options(
    p_connector_id           UUID,
    p_file_format_code       TEXT,
    p_field_separator_char   TEXT,
    p_decimal_separator_char TEXT,
    p_date_format_text       TEXT,
    p_timestamp_format_text  TEXT,
    p_encoding_standard_code TEXT,
    p_has_header_flag        BOOLEAN,
    p_quote_char_text        TEXT,
    p_escape_char_text       TEXT,
    p_null_value_text        TEXT,
    p_line_separator_text    TEXT,
    p_multiline_flag         BOOLEAN,
    p_sheet_name_text        TEXT,
    p_sheet_index_num        INTEGER,
    p_root_tag_text          TEXT,
    p_row_tag_text           TEXT,
    p_corrupt_record_mode    TEXT,
    p_column_widths_text     TEXT,
    p_skip_rows_num          INTEGER,
    p_compression_code       TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalog.file_format_options (
        connector_id, file_format_code,
        field_separator_char, decimal_separator_char, date_format_text, timestamp_format_text,
        encoding_standard_code, has_header_flag, quote_char_text, escape_char_text,
        null_value_text, line_separator_text, multiline_flag,
        sheet_name_text, sheet_index_num, root_tag_text, row_tag_text,
        corrupt_record_mode, column_widths_text, skip_rows_num, compression_code
    )
    VALUES (
        p_connector_id, p_file_format_code,
        p_field_separator_char, p_decimal_separator_char, p_date_format_text, p_timestamp_format_text,
        p_encoding_standard_code, p_has_header_flag, p_quote_char_text, p_escape_char_text,
        p_null_value_text, p_line_separator_text, p_multiline_flag,
        p_sheet_name_text, p_sheet_index_num, p_root_tag_text, p_row_tag_text,
        p_corrupt_record_mode, p_column_widths_text, p_skip_rows_num, p_compression_code
    )
    ON CONFLICT (connector_id) DO UPDATE SET
        file_format_code       = EXCLUDED.file_format_code,
        field_separator_char   = EXCLUDED.field_separator_char,
        decimal_separator_char = EXCLUDED.decimal_separator_char,
        date_format_text       = EXCLUDED.date_format_text,
        timestamp_format_text  = EXCLUDED.timestamp_format_text,
        encoding_standard_code = EXCLUDED.encoding_standard_code,
        has_header_flag        = EXCLUDED.has_header_flag,
        quote_char_text        = EXCLUDED.quote_char_text,
        escape_char_text       = EXCLUDED.escape_char_text,
        null_value_text        = EXCLUDED.null_value_text,
        line_separator_text    = EXCLUDED.line_separator_text,
        multiline_flag         = EXCLUDED.multiline_flag,
        sheet_name_text        = EXCLUDED.sheet_name_text,
        sheet_index_num        = EXCLUDED.sheet_index_num,
        root_tag_text          = EXCLUDED.root_tag_text,
        row_tag_text           = EXCLUDED.row_tag_text,
        corrupt_record_mode    = EXCLUDED.corrupt_record_mode,
        column_widths_text     = EXCLUDED.column_widths_text,
        skip_rows_num          = EXCLUDED.skip_rows_num,
        compression_code       = EXCLUDED.compression_code;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_upsert_file_format_options(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) IS 'Creates or replaces file format options for a connector. One format config per connector (UNIQUE on connector_id).';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_file_format_options(p_connector_id UUID)
RETURNS TABLE (
    file_format_code       TEXT,
    field_separator_char   TEXT,
    decimal_separator_char TEXT,
    date_format_text       TEXT,
    timestamp_format_text  TEXT,
    encoding_standard_code TEXT,
    has_header_flag        BOOLEAN,
    quote_char_text        TEXT,
    escape_char_text       TEXT,
    null_value_text        TEXT,
    line_separator_text    TEXT,
    multiline_flag         BOOLEAN,
    sheet_name_text        TEXT,
    sheet_index_num        INTEGER,
    root_tag_text          TEXT,
    row_tag_text           TEXT,
    corrupt_record_mode    TEXT,
    column_widths_text     TEXT,
    skip_rows_num          INTEGER,
    compression_code       TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT file_format_code, field_separator_char, decimal_separator_char,
           date_format_text, timestamp_format_text, encoding_standard_code,
           has_header_flag, quote_char_text, escape_char_text,
           null_value_text, line_separator_text, multiline_flag,
           sheet_name_text, sheet_index_num, root_tag_text, row_tag_text,
           corrupt_record_mode, column_widths_text, skip_rows_num, compression_code
    FROM catalog.file_format_options
    WHERE connector_id = p_connector_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_file_format_options(UUID) IS 'Returns file format parsing options for a connector. Used by the codegen layer to emit Spark read/write options.';
;
-- ============================================================================
-- READ OPERATIONS — DATASETS
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_get_datasets(p_connector_id UUID)
RETURNS TABLE (
    dataset_id              UUID,
    db_name_text            TEXT,
    schema_name_text        TEXT,
    table_name_text         TEXT,
    dataset_type_code       TEXT,
    estimated_row_count_num BIGINT,
    last_introspection_dtm  TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT dataset_id, db_name_text, schema_name_text, table_name_text, dataset_type_code,
           estimated_row_count_num, last_introspection_dtm
    FROM catalog.datasets
    WHERE connector_id = p_connector_id
    ORDER BY schema_name_text, table_name_text;
$$;
COMMENT ON FUNCTION catalog.fn_get_datasets(UUID) IS 'Lists datasets registered under a specific connector.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_dataset_columns(p_dataset_id UUID)
RETURNS TABLE (column_id UUID, column_name_text TEXT, data_type_code TEXT, is_nullable_flag BOOLEAN, ordinal_position_num INTEGER)
LANGUAGE sql STABLE AS $$
    SELECT column_id, column_name_text, data_type_code, is_nullable_flag, ordinal_position_num
    FROM catalog.dataset_columns WHERE dataset_id = p_dataset_id ORDER BY ordinal_position_num;
$$;
COMMENT ON FUNCTION catalog.fn_get_dataset_columns(UUID) IS 'Returns all columns for a dataset in ordinal order.';
;
-- ============================================================================
-- WRITE OPERATIONS — DATASETS
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_register_dataset(
    p_connector_id UUID,
    p_db_name_text TEXT,
    p_schema_name_text TEXT,
    p_table_name_text TEXT,
    OUT p_dataset_id UUID,
    p_dataset_type_code TEXT DEFAULT 'TABLE'
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalog.datasets (connector_id, db_name_text, schema_name_text, table_name_text, dataset_type_code)
    VALUES (p_connector_id, p_db_name_text, p_schema_name_text, p_table_name_text, p_dataset_type_code)
    RETURNING dataset_id INTO p_dataset_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_register_dataset(UUID, TEXT, TEXT, TEXT, TEXT) IS 'Registers a new data asset in the metadata catalog.';
;
CREATE OR REPLACE PROCEDURE catalog.pr_sync_dataset_columns(
    p_dataset_id UUID,
    p_columns_json JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
    v_col JSONB;
BEGIN
    -- Clear to re-sync: old columns physically deleted, trigger captures history
    DELETE FROM catalog.dataset_columns WHERE dataset_id = p_dataset_id;
    FOR v_col IN SELECT * FROM jsonb_array_elements(p_columns_json)
    LOOP
        INSERT INTO catalog.dataset_columns (dataset_id, column_name_text, data_type_code, is_nullable_flag, ordinal_position_num)
        VALUES (
            p_dataset_id,
            v_col->>'column_name_text',
            v_col->>'data_type_code',
            (v_col->>'is_nullable_flag')::BOOLEAN,
            (v_col->>'ordinal_position_num')::INTEGER
        );
    END LOOP;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_sync_dataset_columns(UUID, JSONB) IS 'Replaces all column metadata for a dataset. Used after a schema introspection scan.';
;
COMMIT;
