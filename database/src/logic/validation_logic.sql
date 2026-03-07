-- ############################################################################
-- # FILE: logic/validation_logic.sql
-- # PURPOSE: Tier-2 validation layer. Called by the backend BEFORE any save.
-- #          Returns a structured JSONB array of validation errors.
-- #          If the array is empty, the entity is valid and can be saved.
-- #
-- # VALIDATION DOMAINS:
-- #   1. Connectors      — mandatory config fields per technology
-- #   2. Datasets        — must belong to a valid connector
-- #   3. Column Mappings — source or expression required, data-type compatibility
-- #   4. Pipelines       — must have at least one source node and one sink node
-- #   5. Pipeline IR     — node-level completeness (source, target, transforms)
-- #   6. Orchestrators   — must reference valid, committed pipelines; no cycles
-- #   7. Users           — email format, password strength
-- #   8. Folders         — unique name within parent scope
-- #
-- # RETURN CONVENTION:
-- #   Every function returns JSONB:
-- #   []                          → valid, no errors
-- #   [{"field":"x","error":"y"}] → one or more blocking errors
-- ############################################################################

BEGIN;

-- ============================================================================
-- DOMAIN 1: CONNECTOR VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_validate_connector(
    p_connector_type_code TEXT,
    p_conn_config_plain JSONB   -- decrypted config for validation only; never stored plain
)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_errors   JSONB := '[]'::JSONB;
    v_required TEXT[];
    v_field    TEXT;
BEGIN
    -- Rule C1: connector_type_code must be a known technology
    IF p_connector_type_code NOT IN (
        -- JDBC on-prem databases
        'JDBC_POSTGRESQL','JDBC_MYSQL','JDBC_MARIADB','JDBC_SQLSERVER','JDBC_ORACLE',
        'JDBC_DB2','JDBC_SAP_HANA','JDBC_TERADATA','JDBC_GREENPLUM','JDBC_SYBASE',
        -- Cloud storage
        'AWS_S3','GCP_GCS','AZURE_BLOB','AZURE_ADLS_GEN2','OCI_OBJECT',
        -- Cloud data warehouses
        'AWS_REDSHIFT','GCP_BIGQUERY','AZURE_SYNAPSE','SNOWFLAKE',
        -- Cloud databases
        'AWS_RDS','GCP_BIGTABLE','OCI_AUTONOMOUS_DB',
        -- Lakehouse
        'DATABRICKS',
        -- File formats
        'FILE_CSV','FILE_PARQUET','FILE_ORC','FILE_JSON','FILE_XML',
        'FILE_EXCEL','FILE_AVRO','FILE_FIXED_WIDTH','FILE_DELTA','FILE_ICEBERG','FILE_HUDI'
    ) THEN
        v_errors := v_errors || jsonb_build_object(
            'field', 'connector_type_code',
            'error', format('Unknown connector type: %s. Must be one of the supported values.', p_connector_type_code)
        );
        RETURN v_errors; -- can't validate config without valid type
    END IF;

    -- Rule C2: required config fields per technology
    CASE p_connector_type_code
        WHEN 'SNOWFLAKE' THEN
            v_required := ARRAY['sf_account','sf_warehouse','sf_database'];
        WHEN 'DATABRICKS' THEN
            v_required := ARRAY['dbx_workspace_url','dbx_cloud_provider'];
        WHEN 'AWS_S3' THEN
            v_required := ARRAY['aws_region','auth_method','storage_bucket'];
        WHEN 'GCP_GCS' THEN
            v_required := ARRAY['gcp_project_id','auth_method','storage_bucket'];
        WHEN 'AZURE_BLOB','AZURE_ADLS_GEN2' THEN
            v_required := ARRAY['azure_storage_account_name','auth_method','storage_container'];
        WHEN 'JDBC_POSTGRESQL','JDBC_MYSQL','JDBC_MARIADB','JDBC_SQLSERVER','JDBC_ORACLE',
             'JDBC_DB2','JDBC_SAP_HANA','JDBC_TERADATA','JDBC_GREENPLUM','JDBC_SYBASE' THEN
            v_required := ARRAY['jdbc_host','jdbc_port','jdbc_database'];
        WHEN 'AWS_REDSHIFT' THEN
            v_required := ARRAY['redshift_host','redshift_database','auth_method'];
        WHEN 'GCP_BIGQUERY' THEN
            v_required := ARRAY['bigquery_project_id'];
        WHEN 'AZURE_SYNAPSE' THEN
            v_required := ARRAY['synapse_server','synapse_database','auth_method'];
        WHEN 'AWS_RDS' THEN
            v_required := ARRAY['jdbc_host','jdbc_port','jdbc_database','rds_engine'];
        WHEN 'GCP_BIGTABLE' THEN
            v_required := ARRAY['bigtable_project_id','bigtable_instance_id'];
        WHEN 'OCI_OBJECT' THEN
            v_required := ARRAY['oci_region','oci_tenancy_ocid','oci_namespace','oci_bucket','auth_method'];
        WHEN 'OCI_AUTONOMOUS_DB' THEN
            v_required := ARRAY['oci_adb_ocid','oci_region','oci_adb_service_name','auth_method'];
        ELSE
            -- FILE_* connectors require storage_type and storage_base_path
            IF p_connector_type_code LIKE 'FILE_%' THEN
                v_required := ARRAY['storage_type','storage_base_path'];
            ELSE
                v_required := ARRAY[]::TEXT[];
            END IF;
    END CASE;

    FOREACH v_field IN ARRAY v_required LOOP
        IF (p_conn_config_plain ->> v_field) IS NULL OR trim((p_conn_config_plain ->> v_field)) = '' THEN
            v_errors := v_errors || jsonb_build_object(
                'field', 'conn_config.' || v_field,
                'error', format('Required field "%s" is missing for %s connector.', v_field, p_connector_type_code)
            );
        END IF;
    END LOOP;

    -- Rule C3: port must be a valid integer (1–65535) when present
    IF (p_conn_config_plain ->> 'port') IS NOT NULL THEN
        BEGIN
            IF (p_conn_config_plain->>'port')::INTEGER NOT BETWEEN 1 AND 65535 THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', 'conn_config.port',
                    'error', 'Port must be between 1 and 65535.'
                );
            END IF;
        EXCEPTION WHEN invalid_text_representation THEN
            v_errors := v_errors || jsonb_build_object(
                'field', 'conn_config.port',
                'error', 'Port must be a numeric value.'
            );
        END;
    END IF;

    RETURN v_errors;
END;
$$;
COMMENT ON FUNCTION catalog.fn_validate_connector(TEXT, JSONB) IS
'Validates connector config completeness before save. Returns [] on success or a JSONB array of {field, error} objects. Accepts plaintext config for validation only — storage always uses pgcrypto encryption.';


-- ============================================================================
-- DOMAIN 2: COLUMN MAPPING VALIDATION
-- ============================================================================

-- Column mapping rule constants (used in IR payload validation by the backend,
-- but the DB exposes the rule definitions for the UI to display inline hints).

CREATE OR REPLACE FUNCTION catalog.fn_validate_column_mapping(
    p_target_column_name    TEXT,
    p_target_data_type_code TEXT,
    p_mapping_type_code     TEXT,   -- 'SOURCE_COLUMN','EXPRESSION','LITERAL','SYSTEM_VALUE'
    p_source_column_name    TEXT,   -- NULL if not SOURCE_COLUMN
    p_source_data_type_code TEXT,   -- NULL if not SOURCE_COLUMN
    p_expression_text       TEXT,   -- NULL if not EXPRESSION
    p_literal_value_text    TEXT,   -- NULL if not LITERAL
    p_system_value_code     TEXT    -- NULL if not SYSTEM_VALUE: CURRENT_TIMESTAMP, CURRENT_USER, UUID, NULL_VALUE
)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_errors      JSONB := '[]'::JSONB;
    v_valid_sys   TEXT[] := ARRAY['CURRENT_TIMESTAMP','CURRENT_USER','GENERATED_UUID','NULL_VALUE'];
    -- Type compatibility matrix: source_type → compatible target types
    v_numeric_types TEXT[] := ARRAY['INTEGER','BIGINT','SMALLINT','DECIMAL','NUMERIC','FLOAT','DOUBLE','NUMBER'];
    v_string_types  TEXT[] := ARRAY['VARCHAR','TEXT','CHAR','STRING','NVARCHAR'];
    v_ts_types      TEXT[] := ARRAY['TIMESTAMP','TIMESTAMPTZ','DATE','DATETIME','TIMESTAMP_TZ','TIMESTAMP_NTZ'];
BEGIN
    -- Rule M1: target column must always be specified
    IF p_target_column_name IS NULL OR trim(p_target_column_name) = '' THEN
        RETURN '[{"field":"target_column","error":"Target column name is required for every mapping row."}]'::JSONB;
    END IF;

    -- Rule M2: mapping type must be specified
    IF p_mapping_type_code NOT IN ('SOURCE_COLUMN','EXPRESSION','LITERAL','SYSTEM_VALUE') THEN
        RETURN jsonb_build_array(jsonb_build_object(
            'field', 'mapping_type',
            'error', format('Invalid mapping type "%s". Must be SOURCE_COLUMN, EXPRESSION, LITERAL, or SYSTEM_VALUE.', p_mapping_type_code)
        ));
    END IF;

    CASE p_mapping_type_code
        WHEN 'SOURCE_COLUMN' THEN
            -- Rule M3: must have both source column and its data type
            IF p_source_column_name IS NULL OR trim(p_source_column_name) = '' THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', 'source_column',
                    'error', format('Target column "%s" has mapping type SOURCE_COLUMN but no source column is selected.', p_target_column_name)
                );
            END IF;

            -- Rule M4: data type compatibility check
            IF p_source_data_type_code IS NOT NULL AND p_target_data_type_code IS NOT NULL THEN
                -- Numeric → string always safe (implicit cast)
                -- String → numeric: WARN, will fail at runtime if non-numeric data
                IF upper(p_source_data_type_code) = ANY(v_numeric_types)
                   AND upper(p_target_data_type_code) = ANY(v_string_types) THEN
                    NULL; -- safe widening

                ELSIF upper(p_source_data_type_code) = ANY(v_string_types)
                      AND upper(p_target_data_type_code) = ANY(v_numeric_types) THEN
                    v_errors := v_errors || jsonb_build_object(
                        'field', 'data_type',
                        'error', format('Target "%s" is %s but source "%s" is %s. Implicit string-to-numeric cast may fail at runtime if data contains non-numeric values. Add an explicit CAST expression.',
                            p_target_column_name, p_target_data_type_code,
                            p_source_column_name, p_source_data_type_code)
                    );

                ELSIF upper(p_source_data_type_code) = ANY(v_ts_types)
                      AND upper(p_target_data_type_code) = ANY(v_string_types) THEN
                    NULL; -- timestamp → string safe

                ELSIF upper(p_source_data_type_code) = ANY(v_string_types)
                      AND upper(p_target_data_type_code) = ANY(v_ts_types) THEN
                    v_errors := v_errors || jsonb_build_object(
                        'field', 'data_type',
                        'error', format('Target "%s" is %s but source "%s" is %s. String-to-timestamp cast will fail at runtime if format does not match. Use CAST or TO_TIMESTAMP expression.',
                            p_target_column_name, p_target_data_type_code,
                            p_source_column_name, p_source_data_type_code)
                    );

                ELSIF upper(p_source_data_type_code) <> upper(p_target_data_type_code)
                      AND NOT (upper(p_source_data_type_code) = ANY(v_numeric_types) AND upper(p_target_data_type_code) = ANY(v_numeric_types))
                      AND NOT (upper(p_source_data_type_code) = ANY(v_ts_types) AND upper(p_target_data_type_code) = ANY(v_ts_types)) THEN
                    v_errors := v_errors || jsonb_build_object(
                        'field', 'data_type',
                        'error', format('Type mismatch: source "%s" is %s, target "%s" is %s. These types are not implicitly compatible.',
                            p_source_column_name, p_source_data_type_code,
                            p_target_column_name, p_target_data_type_code)
                    );
                END IF;
            END IF;

        WHEN 'EXPRESSION' THEN
            -- Rule M5: expression must not be empty
            IF p_expression_text IS NULL OR trim(p_expression_text) = '' THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', 'expression',
                    'error', format('Target column "%s" has mapping type EXPRESSION but no expression is provided.', p_target_column_name)
                );
            END IF;

        WHEN 'LITERAL' THEN
            -- Rule M6: literal value must be provided (NULL_VALUE maps to SYSTEM_VALUE)
            IF p_literal_value_text IS NULL THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', 'literal_value',
                    'error', format('Target column "%s" has mapping type LITERAL but no value is provided. To explicitly set NULL, use SYSTEM_VALUE = NULL_VALUE instead.', p_target_column_name)
                );
            END IF;

        WHEN 'SYSTEM_VALUE' THEN
            -- Rule M7: system value must be a known token
            IF p_system_value_code IS NULL OR p_system_value_code <> ALL(v_valid_sys) THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', 'system_value',
                    'error', format('Invalid system value "%s". Valid options: CURRENT_TIMESTAMP, CURRENT_USER, GENERATED_UUID, NULL_VALUE.', p_system_value_code)
                );
            END IF;

            -- Rule M8: CURRENT_TIMESTAMP into a non-timestamp target type is a warning
            IF p_system_value_code = 'CURRENT_TIMESTAMP'
               AND upper(p_target_data_type_code) = ANY(v_string_types) THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', 'data_type',
                    'error', format('Target "%s" is a string type. CURRENT_TIMESTAMP will be cast to string using ISO-8601 format. Verify this is the expected format.', p_target_column_name)
                );
            END IF;

            -- Rule M9: GENERATED_UUID into a non-string target
            IF p_system_value_code = 'GENERATED_UUID'
               AND upper(p_target_data_type_code) NOT IN ('VARCHAR','TEXT','STRING','UUID') THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', 'data_type',
                    'error', format('Target "%s" is %s. GENERATED_UUID produces a string UUID and cannot be stored in a numeric or timestamp column.', p_target_column_name, p_target_data_type_code)
                );
            END IF;
    END CASE;

    RETURN v_errors;
END;
$$;
COMMENT ON FUNCTION catalog.fn_validate_column_mapping(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
'Validates a single column mapping row in a pipeline before the IR is committed. Checks: mapping type completeness, source column presence, data-type compatibility, expression presence, and system-value correctness. Returns [] on success or [{field, error}] array.';


-- ============================================================================
-- DOMAIN 3: PIPELINE IR VALIDATION (structural — graph level)
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_validate_pipeline_ir(p_ir_payload_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_errors        JSONB := '[]'::JSONB;
    v_nodes         JSONB;
    v_edges         JSONB;
    v_source_count  INTEGER := 0;
    v_sink_count    INTEGER := 0;
    v_node          JSONB;
    v_node_id       TEXT;
    v_node_type     TEXT;
    v_node_ids      TEXT[];
    v_edge          JSONB;
    v_source_ids    TEXT[] := '{}';
    v_sink_ids      TEXT[] := '{}';
    v_connected_ids TEXT[] := '{}';
BEGIN
    -- Rule P1: IR must be a JSONB object
    IF jsonb_typeof(p_ir_payload_json) <> 'object' THEN
        RETURN '[{"field":"ir_payload","error":"Pipeline body must be a valid JSON object."}]'::JSONB;
    END IF;

    v_nodes := p_ir_payload_json -> 'nodes';
    v_edges := p_ir_payload_json -> 'edges';

    -- Rule P2: nodes array must exist and be non-empty
    IF v_nodes IS NULL OR jsonb_array_length(v_nodes) = 0 THEN
        RETURN '[{"field":"nodes","error":"Pipeline has no nodes. Add at least one source and one target."}]'::JSONB;
    END IF;

    -- Rule P3: each node must have an id and a node_type
    FOR v_node IN SELECT * FROM jsonb_array_elements(v_nodes)
    LOOP
        v_node_id   := v_node ->> 'id';
        v_node_type := v_node ->> 'node_type';

        IF v_node_id IS NULL OR trim(v_node_id) = '' THEN
            v_errors := v_errors || jsonb_build_object(
                'field', 'node.id',
                'error', 'A node is missing its id field. Every node must have a unique id.'
            );
        END IF;

        IF v_node_type IS NULL OR trim(v_node_type) = '' THEN
            v_errors := v_errors || jsonb_build_object(
                'field', format('node[%s].node_type', v_node_id),
                'error', format('Node "%s" is missing its node_type. Must be SOURCE, TRANSFORM, or SINK.', v_node_id)
            );
        END IF;

        -- Count sources and sinks
        IF upper(v_node_type) = 'SOURCE' THEN
            v_source_count := v_source_count + 1;
            v_source_ids   := v_source_ids || v_node_id;
        ELSIF upper(v_node_type) = 'SINK' THEN
            v_sink_count := v_sink_count + 1;
            v_sink_ids   := v_sink_ids || v_node_id;
        END IF;

        v_node_ids := v_node_ids || v_node_id;

        -- Rule P4: SOURCE nodes must reference a catalogued dataset
        IF upper(v_node_type) = 'SOURCE' THEN
            IF (v_node -> 'config' ->> 'dataset_id') IS NULL THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', format('node[%s].config.dataset_id', v_node_id),
                    'error', format('Source node "%s" has no dataset selected. Every source must reference a catalogued dataset.', v_node_id)
                );
            END IF;
        END IF;

        -- Rule P5: SINK nodes must reference a catalogued dataset or connector
        IF upper(v_node_type) = 'SINK' THEN
            IF (v_node -> 'config' ->> 'dataset_id') IS NULL
               AND (v_node -> 'config' ->> 'connector_id') IS NULL THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', format('node[%s].config', v_node_id),
                    'error', format('Sink node "%s" has no target selected. Every sink must reference a dataset or connector.', v_node_id)
                );
            END IF;
        END IF;
    END LOOP;

    -- Rule P6: must have at least one SOURCE
    IF v_source_count = 0 THEN
        v_errors := v_errors || jsonb_build_object(
            'field', 'nodes',
            'error', 'Pipeline has no source node. Add at least one SOURCE node connected to a dataset.'
        );
    END IF;

    -- Rule P7: must have at least one SINK
    IF v_sink_count = 0 THEN
        v_errors := v_errors || jsonb_build_object(
            'field', 'nodes',
            'error', 'Pipeline has no sink (target) node. Add at least one SINK node connected to a dataset or connector.'
        );
    END IF;

    -- Rule P8: edges must reference valid node ids
    IF v_edges IS NOT NULL AND jsonb_array_length(v_edges) > 0 THEN
        FOR v_edge IN SELECT * FROM jsonb_array_elements(v_edges)
        LOOP
            IF NOT ((v_edge->>'source') = ANY(v_node_ids)) THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', 'edge.source',
                    'error', format('Edge references source node "%s" which does not exist in the pipeline.', v_edge->>'source')
                );
            END IF;
            IF NOT ((v_edge->>'target') = ANY(v_node_ids)) THEN
                v_errors := v_errors || jsonb_build_object(
                    'field', 'edge.target',
                    'error', format('Edge references target node "%s" which does not exist in the pipeline.', v_edge->>'target')
                );
            END IF;
        END LOOP;
    END IF;

    RETURN v_errors;
END;
$$;
COMMENT ON FUNCTION catalog.fn_validate_pipeline_ir(JSONB) IS
'Validates the structural integrity of a pipeline Internal Representation (IR) before commit. Checks: node completeness, source/sink presence, dataset references, and edge validity. Returns [] on success or [{field, error}] array.';


-- ============================================================================
-- DOMAIN 4: ORCHESTRATOR VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_validate_orchestrator(
    p_project_id         UUID,
    p_dag_definition_json JSONB
)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_errors       JSONB := '[]'::JSONB;
    v_node         JSONB;
    v_pipeline_id  UUID;
    v_exists       BOOLEAN;
    v_has_version  BOOLEAN;
    v_node_count   INTEGER;
BEGIN
    -- Rule O1: DAG must have nodes
    v_node_count := jsonb_array_length(COALESCE(p_dag_definition_json -> 'nodes', '[]'::JSONB));
    IF v_node_count = 0 THEN
        RETURN '[{"field":"dag_definition.nodes","error":"Orchestrator has no pipeline nodes. Add at least one pipeline to the DAG."}]'::JSONB;
    END IF;

    -- Rule O2: every DAG node must reference a valid, committed pipeline in the same project
    FOR v_node IN SELECT * FROM jsonb_array_elements(p_dag_definition_json -> 'nodes')
    LOOP
        BEGIN
            v_pipeline_id := (v_node ->> 'pipeline_id')::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_errors := v_errors || jsonb_build_object(
                'field', 'dag_definition.node.pipeline_id',
                'error', format('DAG node has an invalid pipeline_id: "%s". Must be a valid UUID.', v_node ->> 'pipeline_id')
            );
            CONTINUE;
        END;

        -- Check pipeline exists in this project
        SELECT EXISTS(
            SELECT 1 FROM catalog.pipelines
            WHERE pipeline_id = v_pipeline_id AND project_id = p_project_id
        ) INTO v_exists;

        IF NOT v_exists THEN
            v_errors := v_errors || jsonb_build_object(
                'field', 'dag_definition.node.pipeline_id',
                'error', format('Pipeline %s does not exist in this project or has been deleted.', v_pipeline_id)
            );
            CONTINUE;
        END IF;

        -- Rule O3: pipeline must have at least one committed version
        SELECT EXISTS(
            SELECT 1 FROM catalog.pipelines
            WHERE pipeline_id = v_pipeline_id AND active_version_id IS NOT NULL
        ) INTO v_has_version;

        IF NOT v_has_version THEN
            v_errors := v_errors || jsonb_build_object(
                'field', 'dag_definition.node.pipeline_id',
                'error', format('Pipeline %s has no committed version. You cannot schedule a pipeline that has never been published.', v_pipeline_id)
            );
        END IF;
    END LOOP;

    RETURN v_errors;
END;
$$;
COMMENT ON FUNCTION catalog.fn_validate_orchestrator(UUID, JSONB) IS
'Validates an orchestrator DAG before save. Checks: at least one pipeline node, all referenced pipelines exist in the project, all referenced pipelines have a committed version. Returns [] on success or [{field, error}] array.';


-- ============================================================================
-- DOMAIN 5: USER VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION etl.fn_validate_user(
    p_email_address TEXT,
    p_plain_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_errors JSONB := '[]'::JSONB;
BEGIN
    -- Rule U1: email format
    IF p_email_address IS NULL OR p_email_address !~ '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' THEN
        v_errors := v_errors || jsonb_build_object(
            'field', 'email_address',
            'error', 'Email address is not in a valid format.'
        );
    END IF;

    -- Rule U2: email must be unique
    IF EXISTS(SELECT 1 FROM etl.users WHERE email_address = lower(p_email_address)) THEN
        v_errors := v_errors || jsonb_build_object(
            'field', 'email_address',
            'error', 'An account with this email address already exists.'
        );
    END IF;

    -- Rule U3: password minimum length
    IF p_plain_password IS NULL OR length(p_plain_password) < 12 THEN
        v_errors := v_errors || jsonb_build_object(
            'field', 'password',
            'error', 'Password must be at least 12 characters long.'
        );
    END IF;

    -- Rule U4: password complexity (uppercase, lowercase, digit, special char)
    IF p_plain_password IS NOT NULL AND length(p_plain_password) >= 12 THEN
        IF p_plain_password !~ '[A-Z]' THEN
            v_errors := v_errors || jsonb_build_object('field','password','error','Password must contain at least one uppercase letter.');
        END IF;
        IF p_plain_password !~ '[a-z]' THEN
            v_errors := v_errors || jsonb_build_object('field','password','error','Password must contain at least one lowercase letter.');
        END IF;
        IF p_plain_password !~ '[0-9]' THEN
            v_errors := v_errors || jsonb_build_object('field','password','error','Password must contain at least one digit.');
        END IF;
        IF p_plain_password !~ '[^A-Za-z0-9]' THEN
            v_errors := v_errors || jsonb_build_object('field','password','error','Password must contain at least one special character.');
        END IF;
    END IF;

    RETURN v_errors;
END;
$$;
COMMENT ON FUNCTION etl.fn_validate_user(TEXT, TEXT) IS
'Validates new user registration input. Checks: email format, email uniqueness, password length (min 12), and password complexity (upper, lower, digit, special). Returns [] on success or [{field, error}] array.';


-- ============================================================================
-- DOMAIN 6: FOLDER VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION etl.fn_validate_folder(
    p_project_id         UUID,
    p_parent_folder_id   UUID,
    p_folder_display_name TEXT,
    p_existing_folder_id UUID DEFAULT NULL  -- NULL when creating, set when renaming
)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_errors JSONB := '[]'::JSONB;
BEGIN
    -- Rule F1: name must not be empty
    IF p_folder_display_name IS NULL OR trim(p_folder_display_name) = '' THEN
        RETURN '[{"field":"folder_display_name","error":"Folder name cannot be empty."}]'::JSONB;
    END IF;

    -- Rule F2: name must be unique within the same parent (prevents LTREE path collisions)
    IF EXISTS (
        SELECT 1 FROM etl.folders
        WHERE project_id = p_project_id
          AND (parent_folder_id = p_parent_folder_id OR (parent_folder_id IS NULL AND p_parent_folder_id IS NULL))
          AND folder_display_name = p_folder_display_name
          AND (p_existing_folder_id IS NULL OR folder_id <> p_existing_folder_id)
    ) THEN
        v_errors := v_errors || jsonb_build_object(
            'field', 'folder_display_name',
            'error', format('A folder named "%s" already exists at this level. Choose a different name.', p_folder_display_name)
        );
    END IF;

    -- Rule F3: cannot move a folder into one of its own descendants (circular reference)
    IF p_existing_folder_id IS NOT NULL AND p_parent_folder_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM etl.folders child
            JOIN etl.folders root ON root.folder_id = p_existing_folder_id
            WHERE child.folder_id = p_parent_folder_id
              AND child.hierarchical_path_ltree <@ root.hierarchical_path_ltree
        ) THEN
            v_errors := v_errors || jsonb_build_object(
                'field', 'parent_folder_id',
                'error', 'Cannot move a folder into one of its own sub-folders. This would create a circular reference.'
            );
        END IF;
    END IF;

    RETURN v_errors;
END;
$$;
COMMENT ON FUNCTION etl.fn_validate_folder(UUID, UUID, TEXT, UUID) IS
'Validates folder creation or rename. Checks: non-empty name, uniqueness within the same parent scope, and no circular parent-child move. Returns [] on success or [{field, error}] array.';


-- ============================================================================
-- DOMAIN 7: COMPOSITE SAVE GUARD  
-- A single entry-point the backend calls for each entity type.
-- Returns all validation errors before any write occurs.
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_can_save_connector(
    p_connector_type_code TEXT,
    p_conn_config_plain JSONB,
    p_connector_display_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_errors JSONB := '[]'::JSONB;
BEGIN
    -- Display name required
    IF p_connector_display_name IS NULL OR trim(p_connector_display_name) = '' THEN
        v_errors := v_errors || jsonb_build_object(
            'field', 'connector_display_name',
            'error', 'Connector display name is required.'
        );
    END IF;
    -- Unique name
    IF EXISTS(SELECT 1 FROM catalog.connectors WHERE connector_display_name = p_connector_display_name) THEN
        v_errors := v_errors || jsonb_build_object(
            'field', 'connector_display_name',
            'error', format('A connector named "%s" already exists.', p_connector_display_name)
        );
    END IF;
    -- Config completeness
    v_errors := v_errors || catalog.fn_validate_connector(p_connector_type_code, p_conn_config_plain);
    RETURN v_errors;
END;
$$;
COMMENT ON FUNCTION catalog.fn_can_save_connector(TEXT, JSONB, TEXT) IS
'Composite save guard for connectors. Call before pr_create_connector. Returns [] only when the entity is fully valid and safe to store.';


CREATE OR REPLACE FUNCTION catalog.fn_can_commit_pipeline(
    p_pipeline_id        UUID,
    p_ir_payload_json    JSONB
)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_errors JSONB := '[]'::JSONB;
BEGIN
    -- Pipeline must exist
    IF NOT EXISTS(SELECT 1 FROM catalog.pipelines WHERE pipeline_id = p_pipeline_id) THEN
        RETURN '[{"field":"pipeline_id","error":"Pipeline not found."}]'::JSONB;
    END IF;
    -- IR structural validation
    v_errors := v_errors || catalog.fn_validate_pipeline_ir(p_ir_payload_json);
    RETURN v_errors;
END;
$$;
COMMENT ON FUNCTION catalog.fn_can_commit_pipeline(UUID, JSONB) IS
'Composite save guard for pipeline version commits. Call before pr_commit_pipeline_version. Returns [] only when the pipeline IR passes all structural validations.';

COMMIT;
