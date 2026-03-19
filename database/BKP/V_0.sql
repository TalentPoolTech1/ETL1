--
-- PostgreSQL database dump
--

\restrict 81p27Zt0dMhQZEa6MCUvv47RPGTCSrucrseqmAscMlhhrV88bNUJviY4rfhdAHv

-- Dumped from database version 18.3 (Ubuntu 18.3-1.pgdg24.04+1)
-- Dumped by pg_dump version 18.3 (Ubuntu 18.3-1.pgdg24.04+1)

-- Started on 2026-03-19 08:03:41 IST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 10 (class 2615 OID 16644)
-- Name: catalog; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA catalog;


ALTER SCHEMA catalog OWNER TO postgres;

--
-- TOC entry 4972 (class 0 OID 0)
-- Dependencies: 10
-- Name: SCHEMA catalog; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA catalog IS 'Data engineering asset catalog: connectors, datasets, pipelines, and versioned bodies.';


--
-- TOC entry 9 (class 2615 OID 16643)
-- Name: etl; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA etl;


ALTER SCHEMA etl OWNER TO postgres;

--
-- TOC entry 4973 (class 0 OID 0)
-- Dependencies: 9
-- Name: SCHEMA etl; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA etl IS 'Core platform identity: users, projects, and hierarchical asset navigation.';


--
-- TOC entry 11 (class 2615 OID 16645)
-- Name: execution; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA execution;


ALTER SCHEMA execution OWNER TO postgres;

--
-- TOC entry 4974 (class 0 OID 0)
-- Dependencies: 11
-- Name: SCHEMA execution; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA execution IS 'Execution plane: job runs, task-level telemetry, and observability logs.';


--
-- TOC entry 12 (class 2615 OID 16646)
-- Name: gov; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA gov;


ALTER SCHEMA gov OWNER TO postgres;

--
-- TOC entry 4975 (class 0 OID 0)
-- Dependencies: 12
-- Name: SCHEMA gov; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA gov IS 'Governance: access control, secrets, business glossary, and compliance policies.';


--
-- TOC entry 13 (class 2615 OID 16647)
-- Name: history; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA history;


ALTER SCHEMA history OWNER TO postgres;

--
-- TOC entry 4976 (class 0 OID 0)
-- Dependencies: 13
-- Name: SCHEMA history; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA history IS 'Immutable audit trail: shadow tables capturing pre-change row images for all critical entities.';


--
-- TOC entry 14 (class 2615 OID 16648)
-- Name: meta; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA meta;


ALTER SCHEMA meta OWNER TO postgres;

--
-- TOC entry 4977 (class 0 OID 0)
-- Dependencies: 14
-- Name: SCHEMA meta; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA meta IS 'Platform-wide registries: type mappings, transform libraries, CDC configurations, and asset search.';


--
-- TOC entry 3 (class 3079 OID 16413)
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- TOC entry 4978 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION ltree; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION ltree IS 'data type for hierarchical tree-like structures';


--
-- TOC entry 4 (class 3079 OID 16605)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 4979 (class 0 OID 0)
-- Dependencies: 4
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 2 (class 3079 OID 16402)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 4980 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 400 (class 1255 OID 24661)
-- Name: fn_count_connector_datasets(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_count_connector_datasets(p_connector_id uuid) RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
    SELECT COUNT(*) FROM catalog.datasets WHERE connector_id = p_connector_id;
$$;


ALTER FUNCTION catalog.fn_count_connector_datasets(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4981 (class 0 OID 0)
-- Dependencies: 400
-- Name: FUNCTION fn_count_connector_datasets(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_count_connector_datasets(p_connector_id uuid) IS 'Returns the number of datasets registered under a connector. Used as dependency guard before physical delete.';


--
-- TOC entry 407 (class 1255 OID 18636)
-- Name: fn_get_asset_tags(text, uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_asset_tags(p_asset_type_code text, p_asset_id uuid) RETURNS TABLE(tag_id uuid, tag_display_name text, tag_color_hex text)
    LANGUAGE sql STABLE
    AS $$
    SELECT t.tag_id, t.tag_display_name, t.tag_color_hex
    FROM catalog.asset_tags at
    JOIN catalog.tags t ON at.tag_id = t.tag_id
    WHERE at.asset_type_code = p_asset_type_code AND at.asset_id = p_asset_id
    ORDER BY t.tag_display_name;
$$;


ALTER FUNCTION catalog.fn_get_asset_tags(p_asset_type_code text, p_asset_id uuid) OWNER TO postgres;

--
-- TOC entry 4982 (class 0 OID 0)
-- Dependencies: 407
-- Name: FUNCTION fn_get_asset_tags(p_asset_type_code text, p_asset_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_asset_tags(p_asset_type_code text, p_asset_id uuid) IS 'Returns all tags applied to a specific asset.';


--
-- TOC entry 586 (class 1255 OID 18628)
-- Name: fn_get_column_lineage_downstream(uuid, text); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_column_lineage_downstream(p_dataset_id uuid, p_column_name text) RETURNS TABLE(pipeline_id uuid, pipeline_display_name text, tgt_dataset_id uuid, tgt_column_name_text text, transformation_desc_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT dl.pipeline_id, p.pipeline_display_name,
           dl.tgt_dataset_id, dl.tgt_column_name_text, dl.transformation_desc_text
    FROM catalog.data_lineage dl
    JOIN catalog.pipelines p ON dl.pipeline_id = p.pipeline_id
    WHERE dl.src_dataset_id = p_dataset_id
      AND dl.src_column_name_text = p_column_name;
$$;


ALTER FUNCTION catalog.fn_get_column_lineage_downstream(p_dataset_id uuid, p_column_name text) OWNER TO postgres;

--
-- TOC entry 4983 (class 0 OID 0)
-- Dependencies: 586
-- Name: FUNCTION fn_get_column_lineage_downstream(p_dataset_id uuid, p_column_name text); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_column_lineage_downstream(p_dataset_id uuid, p_column_name text) IS 'Returns all downstream target columns that a source column feeds into. Used for impact analysis before modifying a source schema.';


--
-- TOC entry 665 (class 1255 OID 18627)
-- Name: fn_get_column_lineage_upstream(uuid, text); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_column_lineage_upstream(p_dataset_id uuid, p_column_name text) RETURNS TABLE(pipeline_id uuid, pipeline_display_name text, src_dataset_id uuid, src_column_name_text text, transformation_desc_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT dl.pipeline_id, p.pipeline_display_name,
           dl.src_dataset_id, dl.src_column_name_text, dl.transformation_desc_text
    FROM catalog.data_lineage dl
    JOIN catalog.pipelines p ON dl.pipeline_id = p.pipeline_id
    WHERE dl.tgt_dataset_id = p_dataset_id
      AND dl.tgt_column_name_text = p_column_name;
$$;


ALTER FUNCTION catalog.fn_get_column_lineage_upstream(p_dataset_id uuid, p_column_name text) OWNER TO postgres;

--
-- TOC entry 4984 (class 0 OID 0)
-- Dependencies: 665
-- Name: FUNCTION fn_get_column_lineage_upstream(p_dataset_id uuid, p_column_name text); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_column_lineage_upstream(p_dataset_id uuid, p_column_name text) IS 'Returns all upstream source columns and the pipelines that flow into a specific target column. Used for data traceability and GDPR subject-access requests.';


--
-- TOC entry 365 (class 1255 OID 24600)
-- Name: fn_get_connection_history(uuid, integer, integer); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connection_history(p_connector_id uuid, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0) RETURNS TABLE(history_id text, action_code text, action_dtm timestamp with time zone, action_by uuid, detail_text text, test_passed_flag boolean, response_time_ms integer, error_message_text text)
    LANGUAGE sql STABLE
    AS $$
    WITH combined AS (
        SELECT
            h.hist_id::TEXT AS history_id,
            h.hist_action_cd::TEXT AS action_code,
            h.hist_action_dtm AS action_dtm,
            h.hist_action_by AS action_by,
            COALESCE(h.connector_display_name, 'Connector change') AS detail_text,
            NULL::BOOLEAN AS test_passed_flag,
            NULL::INTEGER AS response_time_ms,
            NULL::TEXT AS error_message_text
        FROM history.connectors_history h
        WHERE h.connector_id = p_connector_id

        UNION ALL

        SELECT
            t.test_result_id::TEXT AS history_id,
            'TEST'::TEXT AS action_code,
            t.tested_dtm AS action_dtm,
            t.tested_by_user_id AS action_by,
            'Connection test executed'::TEXT AS detail_text,
            t.test_passed_flag,
            t.response_time_ms,
            t.error_message_text
        FROM catalog.connection_test_results t
        WHERE t.connector_id = p_connector_id
    )
    SELECT
        c.history_id,
        c.action_code,
        c.action_dtm,
        c.action_by,
        c.detail_text,
        c.test_passed_flag,
        c.response_time_ms,
        c.error_message_text
    FROM combined c
    ORDER BY c.action_dtm DESC
    LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;


ALTER FUNCTION catalog.fn_get_connection_history(p_connector_id uuid, p_limit integer, p_offset integer) OWNER TO postgres;

--
-- TOC entry 4985 (class 0 OID 0)
-- Dependencies: 365
-- Name: FUNCTION fn_get_connection_history(p_connector_id uuid, p_limit integer, p_offset integer); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connection_history(p_connector_id uuid, p_limit integer, p_offset integer) IS 'Returns connector row-history plus explicit connection-test events in one timeline.';


--
-- TOC entry 438 (class 1255 OID 24599)
-- Name: fn_get_connection_usage(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connection_usage(p_connector_id uuid) RETURNS TABLE(usage_type_code text, object_id uuid, object_display_name text, context_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        'DATASET'::TEXT AS usage_type_code,
        d.dataset_id AS object_id,
        CONCAT_WS('.', d.db_name_text, d.schema_name_text, d.table_name_text) AS object_display_name,
        'Registered dataset'::TEXT AS context_text
    FROM catalog.datasets d
    WHERE d.connector_id = p_connector_id

    UNION ALL

    SELECT DISTINCT
        'PIPELINE'::TEXT AS usage_type_code,
        p.pipeline_id AS object_id,
        p.pipeline_display_name AS object_display_name,
        CONCAT('Dataset access: ', dm.access_mode_code) AS context_text
    FROM catalog.pipeline_dataset_map dm
    JOIN catalog.pipelines p
      ON p.pipeline_id = dm.pipeline_id
     AND p.active_version_id = dm.version_id
    JOIN catalog.datasets d
      ON d.dataset_id = dm.dataset_id
    WHERE d.connector_id = p_connector_id

    UNION ALL

    SELECT DISTINCT
        'ORCHESTRATOR'::TEXT AS usage_type_code,
        o.orch_id AS object_id,
        o.orch_display_name AS object_display_name,
        'Includes dependent pipeline'::TEXT AS context_text
    FROM catalog.orchestrator_pipeline_map opm
    JOIN catalog.orchestrators o
      ON o.orch_id = opm.orch_id
    JOIN catalog.pipeline_dataset_map dm
      ON dm.pipeline_id = opm.pipeline_id
    JOIN catalog.pipelines p
      ON p.pipeline_id = dm.pipeline_id
     AND p.active_version_id = dm.version_id
    JOIN catalog.datasets d
      ON d.dataset_id = dm.dataset_id
    WHERE d.connector_id = p_connector_id;
$$;


ALTER FUNCTION catalog.fn_get_connection_usage(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4986 (class 0 OID 0)
-- Dependencies: 438
-- Name: FUNCTION fn_get_connection_usage(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connection_usage(p_connector_id uuid) IS 'Returns datasets, pipelines, and orchestrators that currently depend on the connector.';


--
-- TOC entry 613 (class 1255 OID 32777)
-- Name: fn_get_connector_by_id(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connector_by_id(p_connector_id uuid) RETURNS TABLE(connector_id uuid, connector_display_name text, connector_type_code text, conn_jdbc_driver_class text, conn_test_query text, conn_spark_config_json jsonb, conn_ssl_mode text, conn_max_pool_size_num integer, conn_idle_timeout_sec integer, health_status_code text, created_dtm timestamp with time zone, updated_dtm timestamp with time zone, created_by_user_id uuid, updated_by_user_id uuid, technology_id uuid)
    LANGUAGE sql STABLE
    AS $$
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


ALTER FUNCTION catalog.fn_get_connector_by_id(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4987 (class 0 OID 0)
-- Dependencies: 613
-- Name: FUNCTION fn_get_connector_by_id(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connector_by_id(p_connector_id uuid) IS 'Returns a single connector record with non-sensitive fields and health status. Encrypted blobs are NOT returned — use fn_get_connector_config_decrypted / fn_get_connector_secrets_decrypted for execution.';


--
-- TOC entry 581 (class 1255 OID 18837)
-- Name: fn_get_connector_config_decrypted(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connector_config_decrypted(p_connector_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    SELECT pgp_sym_decrypt(conn_config_json_encrypted::BYTEA, current_setting('app.encryption_key'))::JSONB
    FROM catalog.connectors WHERE connector_id = p_connector_id;
$$;


ALTER FUNCTION catalog.fn_get_connector_config_decrypted(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4988 (class 0 OID 0)
-- Dependencies: 581
-- Name: FUNCTION fn_get_connector_config_decrypted(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connector_config_decrypted(p_connector_id uuid) IS 'Law 3: Decrypts and returns the connector non-secret config as JSONB. Only callable by the execution engine or connection test service; never exposed to the UI.';


--
-- TOC entry 445 (class 1255 OID 18848)
-- Name: fn_get_connector_dataset_count(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connector_dataset_count(p_connector_id uuid) RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
    SELECT COUNT(*)::BIGINT FROM catalog.datasets WHERE connector_id = p_connector_id;
$$;


ALTER FUNCTION catalog.fn_get_connector_dataset_count(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4989 (class 0 OID 0)
-- Dependencies: 445
-- Name: FUNCTION fn_get_connector_dataset_count(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connector_dataset_count(p_connector_id uuid) IS 'Returns the number of datasets referencing a specific connector.';


--
-- TOC entry 611 (class 1255 OID 24663)
-- Name: fn_get_connector_decrypted(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connector_decrypted(p_connector_id uuid) RETURNS TABLE(connector_id uuid, connector_display_name text, connector_type_code text, conn_ssl_mode text, conn_max_pool_size_num integer, conn_idle_timeout_sec integer, conn_jdbc_driver_class text, conn_test_query text, conn_spark_config_json jsonb, created_dtm timestamp with time zone, updated_dtm timestamp with time zone, created_by_user_id uuid, updated_by_user_id uuid, conn_config_json jsonb, conn_secrets_json jsonb, conn_ssh_tunnel_json jsonb, conn_proxy_json jsonb)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        c.connector_id,
        c.connector_display_name,
        c.connector_type_code,
        c.conn_ssl_mode,
        c.conn_max_pool_size_num,
        c.conn_idle_timeout_sec,
        c.conn_jdbc_driver_class,
        c.conn_test_query,
        c.conn_spark_config_json,
        c.created_dtm,
        c.updated_dtm,
        c.created_by_user_id,
        c.updated_by_user_id,
        pgp_sym_decrypt(c.conn_config_json_encrypted::BYTEA,
            current_setting('app.encryption_key'))::JSONB  AS conn_config_json,
        CASE WHEN c.conn_secrets_json_encrypted IS NOT NULL
             THEN pgp_sym_decrypt(c.conn_secrets_json_encrypted::BYTEA,
                      current_setting('app.encryption_key'))::JSONB
             ELSE NULL END                                  AS conn_secrets_json,
        CASE WHEN c.conn_ssh_tunnel_json_encrypted IS NOT NULL
             THEN pgp_sym_decrypt(c.conn_ssh_tunnel_json_encrypted::BYTEA,
                      current_setting('app.encryption_key'))::JSONB
             ELSE NULL END                                  AS conn_ssh_tunnel_json,
        CASE WHEN c.conn_proxy_json_encrypted IS NOT NULL
             THEN pgp_sym_decrypt(c.conn_proxy_json_encrypted::BYTEA,
                      current_setting('app.encryption_key'))::JSONB
             ELSE NULL END                                  AS conn_proxy_json
    FROM catalog.connectors c
    WHERE c.connector_id = p_connector_id;
$$;


ALTER FUNCTION catalog.fn_get_connector_decrypted(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4990 (class 0 OID 0)
-- Dependencies: 611
-- Name: FUNCTION fn_get_connector_decrypted(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connector_decrypted(p_connector_id uuid) IS 'Returns a connector with all encrypted blobs decrypted via pgcrypto. Requires app.encryption_key session variable. Use only within execution engine or connection-test paths.';


--
-- TOC entry 376 (class 1255 OID 18854)
-- Name: fn_get_connector_full_decrypted(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connector_full_decrypted(p_connector_id uuid) RETURNS TABLE(connector_id uuid, connector_display_name text, connector_type_code text, conn_ssl_mode text, conn_max_pool_size_num integer, health_status_code text, created_by_full_name text, updated_dtm timestamp with time zone, conn_config_json jsonb, conn_secrets_json jsonb)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        c.*,
        catalog.fn_get_connector_config_decrypted(c.connector_id) AS conn_config_json,
        catalog.fn_get_connector_secrets_decrypted(c.connector_id) AS conn_secrets_json
    FROM catalog.fn_get_connectors() c
    WHERE c.connector_id = p_connector_id;
$$;


ALTER FUNCTION catalog.fn_get_connector_full_decrypted(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4991 (class 0 OID 0)
-- Dependencies: 376
-- Name: FUNCTION fn_get_connector_full_decrypted(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connector_full_decrypted(p_connector_id uuid) IS 'Law 3: Returns connector with decrypted config/secrets. AUDIT logs should be triggered on call.';


--
-- TOC entry 403 (class 1255 OID 18843)
-- Name: fn_get_connector_health(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connector_health(p_connector_id uuid) RETURNS TABLE(health_status_code text, check_latency_ms integer, check_error_text text, consecutive_fail_num integer, last_check_dtm timestamp with time zone, next_check_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT health_status_code, check_latency_ms, check_error_text,
           consecutive_fail_num, last_check_dtm, next_check_dtm
    FROM catalog.connector_health
    WHERE connector_id = p_connector_id;
$$;


ALTER FUNCTION catalog.fn_get_connector_health(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4992 (class 0 OID 0)
-- Dependencies: 403
-- Name: FUNCTION fn_get_connector_health(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connector_health(p_connector_id uuid) IS 'Returns the current health status for a connector. Used by the UI to show health indicators.';


--
-- TOC entry 466 (class 1255 OID 18838)
-- Name: fn_get_connector_secrets_decrypted(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connector_secrets_decrypted(p_connector_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    SELECT CASE
        WHEN conn_secrets_json_encrypted IS NOT NULL
        THEN pgp_sym_decrypt(conn_secrets_json_encrypted::BYTEA, current_setting('app.encryption_key'))::JSONB
        ELSE NULL
    END
    FROM catalog.connectors WHERE connector_id = p_connector_id;
$$;


ALTER FUNCTION catalog.fn_get_connector_secrets_decrypted(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4993 (class 0 OID 0)
-- Dependencies: 466
-- Name: FUNCTION fn_get_connector_secrets_decrypted(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connector_secrets_decrypted(p_connector_id uuid) IS 'Law 3: Decrypts and returns the connector secrets blob as JSONB. Returns NULL for identity-based auth connectors. Only callable by the execution engine; never exposed to the UI. No PII in logs.';


--
-- TOC entry 559 (class 1255 OID 32775)
-- Name: fn_get_connectors(); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connectors() RETURNS TABLE(connector_id uuid, connector_display_name text, connector_type_code text, conn_ssl_mode text, conn_max_pool_size_num integer, health_status_code text, created_by_full_name text, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT c.connector_id, c.connector_display_name, c.connector_type_code,
           c.conn_ssl_mode, c.conn_max_pool_size_num,
           COALESCE(h.health_status_code, 'UNKNOWN') AS health_status_code,
           u.user_full_name AS created_by_full_name, c.updated_dtm
    FROM catalog.connectors c
    LEFT JOIN etl.users u ON c.created_by_user_id = u.user_id
    LEFT JOIN catalog.connector_health h ON c.connector_id = h.connector_id
    ORDER BY c.connector_display_name;
$$;


ALTER FUNCTION catalog.fn_get_connectors() OWNER TO postgres;

--
-- TOC entry 4994 (class 0 OID 0)
-- Dependencies: 559
-- Name: FUNCTION fn_get_connectors(); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connectors() IS 'Lists all registered connectors with their type, SSL mode, pool size, and current health status. Config decryption only at execution time.';


--
-- TOC entry 461 (class 1255 OID 32776)
-- Name: fn_get_connectors_by_tech(text, integer, uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connectors_by_tech(p_tech_code text, p_limit integer DEFAULT 50, p_after_id uuid DEFAULT NULL::uuid) RETURNS TABLE(connector_id uuid, connector_display_name text, connector_type_code text, conn_ssl_mode text, conn_max_pool_size_num integer, health_status_code text, created_by_full_name text, updated_dtm timestamp with time zone, technology_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT c.connector_id, c.connector_display_name, c.connector_type_code,
           c.conn_ssl_mode, c.conn_max_pool_size_num,
           COALESCE(h.health_status_code, 'UNKNOWN') AS health_status_code,
           u.user_full_name AS created_by_full_name, c.updated_dtm,
           c.technology_id
    FROM catalog.connectors c
    LEFT JOIN etl.users u ON c.created_by_user_id = u.user_id
    LEFT JOIN catalog.connector_health h ON c.connector_id = h.connector_id
    LEFT JOIN meta.technology_types t ON c.technology_id = t.tech_id
    WHERE (p_tech_code IS NULL OR t.tech_code = p_tech_code)
      AND (p_after_id IS NULL OR c.connector_id > p_after_id)
    ORDER BY c.connector_id
    LIMIT p_limit;
$$;


ALTER FUNCTION catalog.fn_get_connectors_by_tech(p_tech_code text, p_limit integer, p_after_id uuid) OWNER TO postgres;

--
-- TOC entry 4995 (class 0 OID 0)
-- Dependencies: 461
-- Name: FUNCTION fn_get_connectors_by_tech(p_tech_code text, p_limit integer, p_after_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connectors_by_tech(p_tech_code text, p_limit integer, p_after_id uuid) IS 'Lazy-loads connectors filtered by technology code with keyset pagination. p_after_id is the last connector_id from the previous page.';


--
-- TOC entry 585 (class 1255 OID 18844)
-- Name: fn_get_connectors_due_health_check(); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_connectors_due_health_check() RETURNS TABLE(connector_id uuid, connector_type_code text)
    LANGUAGE sql STABLE
    AS $$
    SELECT c.connector_id, c.connector_type_code
    FROM catalog.connectors c
    JOIN catalog.connector_health h ON c.connector_id = h.connector_id
    WHERE h.next_check_dtm IS NOT NULL
      AND h.next_check_dtm <= CURRENT_TIMESTAMP
    ORDER BY h.next_check_dtm;
$$;


ALTER FUNCTION catalog.fn_get_connectors_due_health_check() OWNER TO postgres;

--
-- TOC entry 4996 (class 0 OID 0)
-- Dependencies: 585
-- Name: FUNCTION fn_get_connectors_due_health_check(); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_connectors_due_health_check() IS 'Returns connectors whose next health check is overdue. Used by the health check scheduler.';


--
-- TOC entry 544 (class 1255 OID 18849)
-- Name: fn_get_dataset_columns(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_dataset_columns(p_dataset_id uuid) RETURNS TABLE(column_id uuid, column_name_text text, data_type_code text, is_nullable_flag boolean, ordinal_position_num integer)
    LANGUAGE sql STABLE
    AS $$
    SELECT column_id, column_name_text, data_type_code, is_nullable_flag, ordinal_position_num
    FROM catalog.dataset_columns WHERE dataset_id = p_dataset_id ORDER BY ordinal_position_num;
$$;


ALTER FUNCTION catalog.fn_get_dataset_columns(p_dataset_id uuid) OWNER TO postgres;

--
-- TOC entry 4997 (class 0 OID 0)
-- Dependencies: 544
-- Name: FUNCTION fn_get_dataset_columns(p_dataset_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_dataset_columns(p_dataset_id uuid) IS 'Returns all columns for a dataset in ordinal order.';


--
-- TOC entry 375 (class 1255 OID 18847)
-- Name: fn_get_datasets(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_datasets(p_connector_id uuid) RETURNS TABLE(dataset_id uuid, db_name_text text, schema_name_text text, table_name_text text, dataset_type_code text, estimated_row_count_num bigint, last_introspection_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT dataset_id, db_name_text, schema_name_text, table_name_text, dataset_type_code,
           estimated_row_count_num, last_introspection_dtm
    FROM catalog.datasets
    WHERE connector_id = p_connector_id
    ORDER BY schema_name_text, table_name_text;
$$;


ALTER FUNCTION catalog.fn_get_datasets(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4998 (class 0 OID 0)
-- Dependencies: 375
-- Name: FUNCTION fn_get_datasets(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_datasets(p_connector_id uuid) IS 'Lists datasets registered under a specific connector.';


--
-- TOC entry 674 (class 1255 OID 18846)
-- Name: fn_get_file_format_options(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_file_format_options(p_connector_id uuid) RETURNS TABLE(file_format_code text, field_separator_char text, decimal_separator_char text, date_format_text text, timestamp_format_text text, encoding_standard_code text, has_header_flag boolean, quote_char_text text, escape_char_text text, null_value_text text, line_separator_text text, multiline_flag boolean, sheet_name_text text, sheet_index_num integer, root_tag_text text, row_tag_text text, corrupt_record_mode text, column_widths_text text, skip_rows_num integer, compression_code text)
    LANGUAGE sql STABLE
    AS $$
    SELECT file_format_code, field_separator_char, decimal_separator_char,
           date_format_text, timestamp_format_text, encoding_standard_code,
           has_header_flag, quote_char_text, escape_char_text,
           null_value_text, line_separator_text, multiline_flag,
           sheet_name_text, sheet_index_num, root_tag_text, row_tag_text,
           corrupt_record_mode, column_widths_text, skip_rows_num, compression_code
    FROM catalog.file_format_options
    WHERE connector_id = p_connector_id;
$$;


ALTER FUNCTION catalog.fn_get_file_format_options(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 4999 (class 0 OID 0)
-- Dependencies: 674
-- Name: FUNCTION fn_get_file_format_options(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_file_format_options(p_connector_id uuid) IS 'Returns file format parsing options for a connector. Used by the codegen layer to emit Spark read/write options.';


--
-- TOC entry 359 (class 1255 OID 18632)
-- Name: fn_get_last_connection_test(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_last_connection_test(p_connector_id uuid) RETURNS TABLE(test_passed_flag boolean, error_message_text text, response_time_ms integer, tested_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT test_passed_flag, error_message_text, response_time_ms, tested_dtm
    FROM catalog.connection_test_results
    WHERE connector_id = p_connector_id
    ORDER BY tested_dtm DESC
    LIMIT 1;
$$;


ALTER FUNCTION catalog.fn_get_last_connection_test(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 5000 (class 0 OID 0)
-- Dependencies: 359
-- Name: FUNCTION fn_get_last_connection_test(p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_last_connection_test(p_connector_id uuid) IS 'Returns the most recent connection test result for a connector. Used to show connector health status in the UI.';


--
-- TOC entry 485 (class 1255 OID 24614)
-- Name: fn_get_metadata_history(uuid, integer, integer); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_metadata_history(p_dataset_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(hist_id bigint, hist_action_cd character, hist_action_dtm timestamp with time zone, hist_action_by uuid, schema_name_text text, table_name_text text, estimated_row_count_num bigint, last_introspection_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        h.hist_id,
        h.hist_action_cd,
        h.hist_action_dtm,
        h.hist_action_by,
        h.schema_name_text,
        h.table_name_text,
        h.estimated_row_count_num,
        h.last_introspection_dtm
    FROM history.datasets_history h
    WHERE h.dataset_id = p_dataset_id
    ORDER BY h.hist_action_dtm DESC
    LIMIT GREATEST(COALESCE(p_limit, 50), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;


ALTER FUNCTION catalog.fn_get_metadata_history(p_dataset_id uuid, p_limit integer, p_offset integer) OWNER TO postgres;

--
-- TOC entry 5001 (class 0 OID 0)
-- Dependencies: 485
-- Name: FUNCTION fn_get_metadata_history(p_dataset_id uuid, p_limit integer, p_offset integer); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_metadata_history(p_dataset_id uuid, p_limit integer, p_offset integer) IS 'Returns row-image history for dataset metadata changes.';


--
-- TOC entry 662 (class 1255 OID 24613)
-- Name: fn_get_metadata_lineage(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_metadata_lineage(p_dataset_id uuid) RETURNS TABLE(pipeline_id uuid, pipeline_display_name text, access_mode_code text, version_num_seq integer)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        x.pipeline_id,
        x.pipeline_display_name,
        x.access_mode_code,
        x.version_num_seq
    FROM catalog.fn_get_pipelines_impacted_by_dataset(p_dataset_id) x
    ORDER BY x.pipeline_display_name;
$$;


ALTER FUNCTION catalog.fn_get_metadata_lineage(p_dataset_id uuid) OWNER TO postgres;

--
-- TOC entry 5002 (class 0 OID 0)
-- Dependencies: 662
-- Name: FUNCTION fn_get_metadata_lineage(p_dataset_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_metadata_lineage(p_dataset_id uuid) IS 'Returns active pipelines that read/write the selected dataset.';


--
-- TOC entry 451 (class 1255 OID 24615)
-- Name: fn_get_metadata_permissions(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_metadata_permissions(p_dataset_id uuid) RETURNS TABLE(access_id uuid, user_id uuid, role_id uuid, user_full_name text, email_address text, role_display_name text, granted_dtm timestamp with time zone, granted_by_user_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        ca.access_id,
        ca.user_id,
        ca.role_id,
        u.user_full_name,
        u.email_address,
        r.role_display_name,
        ca.granted_dtm,
        ca.granted_by_user_id
    FROM catalog.datasets d
    JOIN gov.connector_access ca
      ON ca.connector_id = d.connector_id
    LEFT JOIN etl.users u ON u.user_id = ca.user_id
    LEFT JOIN gov.roles r ON r.role_id = ca.role_id
    WHERE d.dataset_id = p_dataset_id
    ORDER BY ca.granted_dtm DESC;
$$;


ALTER FUNCTION catalog.fn_get_metadata_permissions(p_dataset_id uuid) OWNER TO postgres;

--
-- TOC entry 5003 (class 0 OID 0)
-- Dependencies: 451
-- Name: FUNCTION fn_get_metadata_permissions(p_dataset_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_metadata_permissions(p_dataset_id uuid) IS 'Returns effective connector-level grants that govern dataset accessibility.';


--
-- TOC entry 481 (class 1255 OID 24612)
-- Name: fn_get_metadata_profile(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_metadata_profile(p_dataset_id uuid) RETURNS TABLE(dataset_id uuid, connector_id uuid, connector_display_name text, connector_type_code text, db_name_text text, schema_name_text text, table_name_text text, dataset_type_code text, estimated_row_count_num bigint, last_introspection_dtm timestamp with time zone, classification_code text, classification_notes_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        d.dataset_id,
        d.connector_id,
        c.connector_display_name,
        c.connector_type_code,
        d.db_name_text,
        d.schema_name_text,
        d.table_name_text,
        d.dataset_type_code,
        d.estimated_row_count_num,
        d.last_introspection_dtm,
        cls.sensitivity_code AS classification_code,
        cls.classification_notes_text
    FROM catalog.datasets d
    JOIN catalog.connectors c ON c.connector_id = d.connector_id
    LEFT JOIN LATERAL (
        SELECT
            dc.sensitivity_code,
            dc.classification_notes_text
        FROM gov.data_classifications dc
        WHERE dc.target_id = d.dataset_id
          AND UPPER(dc.target_type_code) = 'DATASET'
        ORDER BY dc.updated_dtm DESC NULLS LAST, dc.created_dtm DESC
        LIMIT 1
    ) cls ON TRUE
    WHERE d.dataset_id = p_dataset_id;
$$;


ALTER FUNCTION catalog.fn_get_metadata_profile(p_dataset_id uuid) OWNER TO postgres;

--
-- TOC entry 5004 (class 0 OID 0)
-- Dependencies: 481
-- Name: FUNCTION fn_get_metadata_profile(p_dataset_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_metadata_profile(p_dataset_id uuid) IS 'Returns metadata profile summary for one dataset, including current classification.';


--
-- TOC entry 630 (class 1255 OID 24611)
-- Name: fn_get_metadata_tree(text); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_metadata_tree(p_search_text text DEFAULT NULL::text) RETURNS TABLE(dataset_id uuid, connector_id uuid, connector_display_name text, connector_type_code text, db_name_text text, schema_name_text text, table_name_text text, dataset_type_code text, estimated_row_count_num bigint, last_introspection_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        d.dataset_id,
        d.connector_id,
        c.connector_display_name,
        c.connector_type_code,
        d.db_name_text,
        d.schema_name_text,
        d.table_name_text,
        d.dataset_type_code,
        d.estimated_row_count_num,
        d.last_introspection_dtm
    FROM catalog.datasets d
    JOIN catalog.connectors c ON c.connector_id = d.connector_id
    WHERE p_search_text IS NULL
       OR c.connector_display_name ILIKE '%' || p_search_text || '%'
       OR COALESCE(d.db_name_text, '') ILIKE '%' || p_search_text || '%'
       OR COALESCE(d.schema_name_text, '') ILIKE '%' || p_search_text || '%'
       OR COALESCE(d.table_name_text, '') ILIKE '%' || p_search_text || '%'
    ORDER BY c.connector_display_name, d.db_name_text, d.schema_name_text, d.table_name_text;
$$;


ALTER FUNCTION catalog.fn_get_metadata_tree(p_search_text text) OWNER TO postgres;

--
-- TOC entry 5005 (class 0 OID 0)
-- Dependencies: 630
-- Name: FUNCTION fn_get_metadata_tree(p_search_text text); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_metadata_tree(p_search_text text) IS 'Returns searchable dataset-catalog rows used to build the metadata browser tree.';


--
-- TOC entry 475 (class 1255 OID 18852)
-- Name: fn_get_node_template_by_id(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_node_template_by_id(p_template_id uuid) RETURNS TABLE(template_id uuid, template_name text, category_code text, sub_type_code text, technology_code text, desc_text text, config_template jsonb, tags_json jsonb, is_public_flag boolean, created_by_user_id uuid, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT * FROM catalog.node_templates WHERE template_id = p_template_id;
$$;


ALTER FUNCTION catalog.fn_get_node_template_by_id(p_template_id uuid) OWNER TO postgres;

--
-- TOC entry 5006 (class 0 OID 0)
-- Dependencies: 475
-- Name: FUNCTION fn_get_node_template_by_id(p_template_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_node_template_by_id(p_template_id uuid) IS 'Returns a specific node blueprint definition.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 244 (class 1259 OID 17045)
-- Name: node_templates; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.node_templates (
    template_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    template_name text NOT NULL,
    category_code text NOT NULL,
    sub_type_code text,
    technology_code text,
    desc_text text,
    config_template jsonb NOT NULL,
    tags_json jsonb,
    is_public_flag boolean DEFAULT true NOT NULL,
    created_by_user_id uuid,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.node_templates OWNER TO postgres;

--
-- TOC entry 5007 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE node_templates; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.node_templates IS 'Reusable blueprint definitions for pipeline DAG nodes.';


--
-- TOC entry 5008 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.template_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.template_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5009 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.template_name; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.template_name IS 'Unique human-readable name for the node type (e.g., PostgreSQL Source).';


--
-- TOC entry 5010 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.category_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.category_code IS 'High-level block category: SOURCE, TRANSFORM, SINK, UTILITY.';


--
-- TOC entry 5011 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.sub_type_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.sub_type_code IS 'Plugin-specific subtype (e.g., JDBC, DELTA, S3_FILE).';


--
-- TOC entry 5012 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.technology_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.technology_code IS 'Implementation stack: PYSPARK, SCALA_SPARK. NULL means tech-agnostic.';


--
-- TOC entry 5013 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.desc_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.desc_text IS 'Instructional text or help snippet for this node type.';


--
-- TOC entry 5014 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.config_template; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.config_template IS 'Default JSON parameters and schema for the node UI.';


--
-- TOC entry 5015 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.tags_json; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.tags_json IS 'Arbitrary labels for UI categorization (e.g., {"tier": "gold", "validated": "true"}).';


--
-- TOC entry 5016 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.is_public_flag; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.is_public_flag IS 'TRUE allows all users to see/use this template in the designer.';


--
-- TOC entry 5017 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.created_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.created_by_user_id IS 'FK to the user who defined this template.';


--
-- TOC entry 5018 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.created_dtm IS 'Record creation timestamp.';


--
-- TOC entry 5019 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN node_templates.updated_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.node_templates.updated_dtm IS 'Timestamp of the last template definition update.';


--
-- TOC entry 520 (class 1255 OID 18856)
-- Name: fn_get_node_template_by_name(text, text); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_node_template_by_name(p_template_name text, p_category_code text DEFAULT NULL::text) RETURNS SETOF catalog.node_templates
    LANGUAGE sql STABLE
    AS $$
    SELECT * FROM catalog.node_templates 
    WHERE template_name = p_template_name 
    AND (p_category_code IS NULL OR category_code = p_category_code);
$$;


ALTER FUNCTION catalog.fn_get_node_template_by_name(p_template_name text, p_category_code text) OWNER TO postgres;

--
-- TOC entry 5020 (class 0 OID 0)
-- Dependencies: 520
-- Name: FUNCTION fn_get_node_template_by_name(p_template_name text, p_category_code text); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_node_template_by_name(p_template_name text, p_category_code text) IS 'Returns a node template by its name and optionally category.';


--
-- TOC entry 348 (class 1255 OID 18855)
-- Name: fn_get_node_templates_by_subtype(text, text); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_node_templates_by_subtype(p_sub_type_code text, p_technology_code text DEFAULT NULL::text) RETURNS SETOF catalog.node_templates
    LANGUAGE sql STABLE
    AS $$
    SELECT * FROM catalog.node_templates 
    WHERE sub_type_code = p_sub_type_code 
    AND (p_technology_code IS NULL OR technology_code = p_technology_code OR technology_code IS NULL)
    ORDER BY template_name;
$$;


ALTER FUNCTION catalog.fn_get_node_templates_by_subtype(p_sub_type_code text, p_technology_code text) OWNER TO postgres;

--
-- TOC entry 5021 (class 0 OID 0)
-- Dependencies: 348
-- Name: FUNCTION fn_get_node_templates_by_subtype(p_sub_type_code text, p_technology_code text); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_node_templates_by_subtype(p_sub_type_code text, p_technology_code text) IS 'Returns node templates filtered by subtype and optionally technology.';


--
-- TOC entry 372 (class 1255 OID 24671)
-- Name: fn_get_orchestrator_audit_logs(uuid, integer, integer); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_orchestrator_audit_logs(p_orch_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id bigint, action_dtm timestamp with time zone, user_id uuid, action_code character)
    LANGUAGE sql STABLE
    AS $$
    SELECT h.hist_id        AS id,
           h.hist_action_dtm AS action_dtm,
           h.hist_action_by  AS user_id,
           h.hist_action_cd  AS action_code
    FROM history.orchestrators_history h
    WHERE h.orch_id = p_orch_id
    ORDER BY h.hist_action_dtm DESC
    LIMIT  GREATEST(COALESCE(p_limit,  50), 1)
    OFFSET GREATEST(COALESCE(p_offset,  0), 0);
$$;


ALTER FUNCTION catalog.fn_get_orchestrator_audit_logs(p_orch_id uuid, p_limit integer, p_offset integer) OWNER TO postgres;

--
-- TOC entry 5022 (class 0 OID 0)
-- Dependencies: 372
-- Name: FUNCTION fn_get_orchestrator_audit_logs(p_orch_id uuid, p_limit integer, p_offset integer); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_orchestrator_audit_logs(p_orch_id uuid, p_limit integer, p_offset integer) IS 'Returns paginated history.orchestrators_history rows for orchestrator audit log views.';


--
-- TOC entry 419 (class 1255 OID 24579)
-- Name: fn_get_orchestrator_by_id(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_orchestrator_by_id(p_orch_id uuid) RETURNS TABLE(orch_id uuid, project_id uuid, folder_id uuid, orch_display_name text, orch_desc_text text, dag_definition_json jsonb, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        o.orch_id,
        o.project_id,
        o.folder_id,
        o.orch_display_name,
        o.orch_desc_text,
        o.dag_definition_json,
        o.created_dtm,
        o.updated_dtm
    FROM catalog.orchestrators o
    WHERE o.orch_id = p_orch_id;
$$;


ALTER FUNCTION catalog.fn_get_orchestrator_by_id(p_orch_id uuid) OWNER TO postgres;

--
-- TOC entry 5023 (class 0 OID 0)
-- Dependencies: 419
-- Name: FUNCTION fn_get_orchestrator_by_id(p_orch_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_orchestrator_by_id(p_orch_id uuid) IS 'Returns one orchestrator by ID.';


--
-- TOC entry 422 (class 1255 OID 24589)
-- Name: fn_get_orchestrator_permission_grants(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_orchestrator_permission_grants(p_orch_id uuid) RETURNS TABLE(project_id uuid, user_id uuid, role_id uuid, user_full_name text, email_address text, role_display_name text, granted_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
  SELECT
    o.project_id,
    pur.user_id,
    pur.role_id,
    u.user_full_name,
    u.email_address,
    r.role_display_name,
    pur.granted_dtm
  FROM catalog.orchestrators o
  JOIN gov.project_user_roles pur ON pur.project_id = o.project_id
  JOIN etl.users u ON u.user_id = pur.user_id
  JOIN gov.roles r ON r.role_id = pur.role_id
  WHERE o.orch_id = p_orch_id
  ORDER BY u.user_full_name, r.role_display_name;
$$;


ALTER FUNCTION catalog.fn_get_orchestrator_permission_grants(p_orch_id uuid) OWNER TO postgres;

--
-- TOC entry 5024 (class 0 OID 0)
-- Dependencies: 422
-- Name: FUNCTION fn_get_orchestrator_permission_grants(p_orch_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_orchestrator_permission_grants(p_orch_id uuid) IS 'Returns effective project-scoped grants for an orchestrator by resolving its parent project.';


--
-- TOC entry 541 (class 1255 OID 18623)
-- Name: fn_get_orchestrator_versions(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_orchestrator_versions(p_orch_id uuid) RETURNS TABLE(orch_version_id uuid, version_num_seq integer, release_tag_label text, commit_msg_text text, created_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT orch_version_id, version_num_seq, release_tag_label, commit_msg_text, created_dtm
    FROM catalog.orchestrator_versions
    WHERE orch_id = p_orch_id
    ORDER BY version_num_seq DESC;
$$;


ALTER FUNCTION catalog.fn_get_orchestrator_versions(p_orch_id uuid) OWNER TO postgres;

--
-- TOC entry 5025 (class 0 OID 0)
-- Dependencies: 541
-- Name: FUNCTION fn_get_orchestrator_versions(p_orch_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_orchestrator_versions(p_orch_id uuid) IS 'Returns the full version history of an orchestrator in descending order.';


--
-- TOC entry 525 (class 1255 OID 24578)
-- Name: fn_get_orchestrators(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_orchestrators(p_project_id uuid DEFAULT NULL::uuid) RETURNS TABLE(orch_id uuid, project_id uuid, folder_id uuid, orch_display_name text, orch_desc_text text, dag_definition_json jsonb, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        o.orch_id,
        o.project_id,
        o.folder_id,
        o.orch_display_name,
        o.orch_desc_text,
        o.dag_definition_json,
        o.created_dtm,
        o.updated_dtm
    FROM catalog.orchestrators o
    WHERE p_project_id IS NULL OR o.project_id = p_project_id
    ORDER BY o.orch_display_name;
$$;


ALTER FUNCTION catalog.fn_get_orchestrators(p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5026 (class 0 OID 0)
-- Dependencies: 525
-- Name: FUNCTION fn_get_orchestrators(p_project_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_orchestrators(p_project_id uuid) IS 'Returns orchestrators for a project or all orchestrators when p_project_id is NULL.';


--
-- TOC entry 589 (class 1255 OID 24665)
-- Name: fn_get_orchestrators_by_folder(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_orchestrators_by_folder(p_folder_id uuid) RETURNS TABLE(orch_id uuid, project_id uuid, folder_id uuid, orch_display_name text, orch_desc_text text, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT orch_id, project_id, folder_id, orch_display_name,
           orch_desc_text, created_dtm, updated_dtm
    FROM catalog.orchestrators
    WHERE folder_id = p_folder_id
    ORDER BY orch_display_name;
$$;


ALTER FUNCTION catalog.fn_get_orchestrators_by_folder(p_folder_id uuid) OWNER TO postgres;

--
-- TOC entry 5027 (class 0 OID 0)
-- Dependencies: 589
-- Name: FUNCTION fn_get_orchestrators_by_folder(p_folder_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_orchestrators_by_folder(p_folder_id uuid) IS 'Returns orchestrators directly inside a folder.';


--
-- TOC entry 373 (class 1255 OID 18638)
-- Name: fn_get_orchestrators_for_pipeline(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_orchestrators_for_pipeline(p_pipeline_id uuid) RETURNS TABLE(orch_id uuid, orch_display_name text, dag_node_ref_text text, project_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT o.orch_id, o.orch_display_name, m.dag_node_ref_text, o.project_id
    FROM catalog.orchestrator_pipeline_map m
    JOIN catalog.orchestrators o ON m.orch_id = o.orch_id
    WHERE m.pipeline_id = p_pipeline_id
    ORDER BY o.orch_display_name;
$$;


ALTER FUNCTION catalog.fn_get_orchestrators_for_pipeline(p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5028 (class 0 OID 0)
-- Dependencies: 373
-- Name: FUNCTION fn_get_orchestrators_for_pipeline(p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_orchestrators_for_pipeline(p_pipeline_id uuid) IS 'Reverse-lookup: returns all orchestrators that include a given pipeline in their DAG. Used for impact analysis before modifying or deleting a pipeline.';


--
-- TOC entry 669 (class 1255 OID 24670)
-- Name: fn_get_pipeline_audit_logs(uuid, integer, integer); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_audit_logs(p_pipeline_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id bigint, action_dtm timestamp with time zone, user_id uuid, action_code character)
    LANGUAGE sql STABLE
    AS $$
    SELECT h.hist_id        AS id,
           h.hist_action_dtm AS action_dtm,
           h.hist_action_by  AS user_id,
           h.hist_action_cd  AS action_code
    FROM history.pipelines_history h
    WHERE h.pipeline_id = p_pipeline_id
    ORDER BY h.hist_action_dtm DESC
    LIMIT  GREATEST(COALESCE(p_limit,  50), 1)
    OFFSET GREATEST(COALESCE(p_offset,  0), 0);
$$;


ALTER FUNCTION catalog.fn_get_pipeline_audit_logs(p_pipeline_id uuid, p_limit integer, p_offset integer) OWNER TO postgres;

--
-- TOC entry 5029 (class 0 OID 0)
-- Dependencies: 669
-- Name: FUNCTION fn_get_pipeline_audit_logs(p_pipeline_id uuid, p_limit integer, p_offset integer); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_audit_logs(p_pipeline_id uuid, p_limit integer, p_offset integer) IS 'Returns paginated audit history for a pipeline from the history shadow table. action_code: I=Insert U=Update D=Delete.';


--
-- TOC entry 492 (class 1255 OID 18616)
-- Name: fn_get_pipeline_body(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_body(p_version_id uuid) RETURNS TABLE(ir_payload_json jsonb, ui_layout_json jsonb, content_checksum_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT ir_payload_json, ui_layout_json, content_checksum_text
    FROM catalog.pipeline_contents WHERE version_id = p_version_id;
$$;


ALTER FUNCTION catalog.fn_get_pipeline_body(p_version_id uuid) OWNER TO postgres;

--
-- TOC entry 5030 (class 0 OID 0)
-- Dependencies: 492
-- Name: FUNCTION fn_get_pipeline_body(p_version_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_body(p_version_id uuid) IS 'Law 14: Retrieves the complete pipeline Internal Representation (IR) and UI layout for a specific version.';


--
-- TOC entry 670 (class 1255 OID 32790)
-- Name: fn_get_pipeline_by_id(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_by_id(p_pipeline_id uuid) RETURNS TABLE(pipeline_id uuid, project_id uuid, folder_id uuid, pipeline_display_name text, pipeline_desc_text text, active_version_id uuid, version_num_seq integer, release_tag_label text, ir_payload_json jsonb, ui_layout_json jsonb, created_dtm timestamp with time zone, updated_dtm timestamp with time zone, created_by_user_id uuid, updated_by_user_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        p.pipeline_id,
        p.project_id,
        p.folder_id,
        p.pipeline_display_name,
        p.pipeline_desc_text,
        p.active_version_id,
        pv.version_num_seq,
        pv.release_tag_label,
        pc.ir_payload_json,
        pc.ui_layout_json,
        p.created_dtm,
        p.updated_dtm,
        p.created_by_user_id,
        p.updated_by_user_id
    FROM catalog.pipelines p
    LEFT JOIN catalog.pipeline_versions  pv ON p.active_version_id = pv.version_id
    LEFT JOIN catalog.pipeline_contents  pc ON pv.version_id       = pc.version_id
    WHERE p.pipeline_id = p_pipeline_id;
$$;


ALTER FUNCTION catalog.fn_get_pipeline_by_id(p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5031 (class 0 OID 0)
-- Dependencies: 670
-- Name: FUNCTION fn_get_pipeline_by_id(p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_by_id(p_pipeline_id uuid) IS 'Returns the full pipeline record with its active version body. Used by the pipeline workspace loader and API GET /pipelines/:id.';


--
-- TOC entry 654 (class 1255 OID 24597)
-- Name: fn_get_pipeline_codegen_source(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_codegen_source(p_pipeline_id uuid) RETURNS TABLE(pipeline_id uuid, pipeline_display_name text, pipeline_desc_text text, version_id uuid, version_num_seq integer, release_tag_label text, ir_payload_json jsonb, ui_layout_json jsonb)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        p.pipeline_id,
        p.pipeline_display_name,
        p.pipeline_desc_text,
        pv.version_id,
        pv.version_num_seq,
        pv.release_tag_label,
        pc.ir_payload_json,
        pc.ui_layout_json
    FROM catalog.pipelines p
    LEFT JOIN catalog.pipeline_versions pv ON pv.version_id = p.active_version_id
    LEFT JOIN catalog.pipeline_contents pc ON pc.version_id = pv.version_id
    WHERE p.pipeline_id = p_pipeline_id;
$$;


ALTER FUNCTION catalog.fn_get_pipeline_codegen_source(p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5032 (class 0 OID 0)
-- Dependencies: 654
-- Name: FUNCTION fn_get_pipeline_codegen_source(p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_codegen_source(p_pipeline_id uuid) IS 'Returns the IR and UI layout for the active version of a pipeline. This is the source contract for code generation engines.';


--
-- TOC entry 675 (class 1255 OID 18614)
-- Name: fn_get_pipeline_count_by_tech(); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_count_by_tech() RETURNS TABLE(technology text, count bigint)
    LANGUAGE sql STABLE
    AS $$
    SELECT 'spark'::TEXT as technology, COUNT(*)::BIGINT as count FROM catalog.pipelines;
$$;


ALTER FUNCTION catalog.fn_get_pipeline_count_by_tech() OWNER TO postgres;

--
-- TOC entry 5033 (class 0 OID 0)
-- Dependencies: 675
-- Name: FUNCTION fn_get_pipeline_count_by_tech(); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_count_by_tech() IS 'Returns counts of pipelines grouped by technology (simplified for now).';


--
-- TOC entry 473 (class 1255 OID 24598)
-- Name: fn_get_pipeline_lineage_edges(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_lineage_edges(p_pipeline_id uuid) RETURNS TABLE(from_pipeline_id uuid, from_pipeline_display_name text, to_pipeline_id uuid, to_pipeline_display_name text)
    LANGUAGE sql STABLE
    AS $$
    WITH upstream_edges AS (
        SELECT DISTINCT
            up.pipeline_id AS from_pipeline_id,
            up_p.pipeline_display_name AS from_pipeline_display_name,
            cur.pipeline_id AS to_pipeline_id,
            cur_p.pipeline_display_name AS to_pipeline_display_name
        FROM catalog.pipeline_dataset_map cur
        JOIN catalog.pipelines cur_p ON cur_p.pipeline_id = cur.pipeline_id AND cur_p.active_version_id = cur.version_id
        JOIN catalog.pipeline_dataset_map up ON up.dataset_id = cur.dataset_id
        JOIN catalog.pipelines up_p ON up_p.pipeline_id = up.pipeline_id AND up_p.active_version_id = up.version_id
        WHERE cur.pipeline_id = p_pipeline_id
          AND cur.access_mode_code IN ('READ', 'READ_WRITE')
          AND up.access_mode_code IN ('WRITE', 'READ_WRITE')
          AND up.pipeline_id <> cur.pipeline_id
    ),
    downstream_edges AS (
        SELECT DISTINCT
            cur.pipeline_id AS from_pipeline_id,
            cur_p.pipeline_display_name AS from_pipeline_display_name,
            dn.pipeline_id AS to_pipeline_id,
            dn_p.pipeline_display_name AS to_pipeline_display_name
        FROM catalog.pipeline_dataset_map cur
        JOIN catalog.pipelines cur_p ON cur_p.pipeline_id = cur.pipeline_id AND cur_p.active_version_id = cur.version_id
        JOIN catalog.pipeline_dataset_map dn ON dn.dataset_id = cur.dataset_id
        JOIN catalog.pipelines dn_p ON dn_p.pipeline_id = dn.pipeline_id AND dn_p.active_version_id = dn.version_id
        WHERE cur.pipeline_id = p_pipeline_id
          AND cur.access_mode_code IN ('WRITE', 'READ_WRITE')
          AND dn.access_mode_code IN ('READ', 'READ_WRITE')
          AND dn.pipeline_id <> cur.pipeline_id
    )
    SELECT * FROM upstream_edges
    UNION
    SELECT * FROM downstream_edges;
$$;


ALTER FUNCTION catalog.fn_get_pipeline_lineage_edges(p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5034 (class 0 OID 0)
-- Dependencies: 473
-- Name: FUNCTION fn_get_pipeline_lineage_edges(p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_lineage_edges(p_pipeline_id uuid) IS 'Returns pipeline-to-pipeline lineage edges derived from shared dataset dependencies. Used in the Dependencies sub-tab.';


--
-- TOC entry 591 (class 1255 OID 18625)
-- Name: fn_get_pipeline_parameters(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_parameters(p_pipeline_id uuid) RETURNS TABLE(param_id uuid, param_key_name text, param_data_type_code text, default_value_text text, is_required_flag boolean, param_desc_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT param_id, param_key_name, param_data_type_code, default_value_text, is_required_flag, param_desc_text
    FROM catalog.pipeline_parameters
    WHERE pipeline_id = p_pipeline_id
    ORDER BY param_key_name;
$$;


ALTER FUNCTION catalog.fn_get_pipeline_parameters(p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5035 (class 0 OID 0)
-- Dependencies: 591
-- Name: FUNCTION fn_get_pipeline_parameters(p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_parameters(p_pipeline_id uuid) IS 'Returns all declared runtime parameters for a pipeline in alphabetical order.';


--
-- TOC entry 535 (class 1255 OID 24585)
-- Name: fn_get_pipeline_permission_context(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_permission_context(p_pipeline_id uuid) RETURNS TABLE(pipeline_id uuid, project_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT p.pipeline_id, p.project_id
    FROM catalog.pipelines p
    WHERE p.pipeline_id = p_pipeline_id;
$$;


ALTER FUNCTION catalog.fn_get_pipeline_permission_context(p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5036 (class 0 OID 0)
-- Dependencies: 535
-- Name: FUNCTION fn_get_pipeline_permission_context(p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_permission_context(p_pipeline_id uuid) IS 'Returns the project context of a pipeline for permission inheritance resolution.';


--
-- TOC entry 366 (class 1255 OID 24586)
-- Name: fn_get_pipeline_permission_grants(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_permission_grants(p_pipeline_id uuid) RETURNS TABLE(project_id uuid, user_id uuid, role_id uuid, user_full_name text, email_address text, role_display_name text, granted_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT p.project_id, pur.user_id, pur.role_id,
           u.user_full_name, u.email_address,
           r.role_display_name, pur.granted_dtm
    FROM catalog.pipelines p
    JOIN gov.project_user_roles pur ON pur.project_id = p.project_id
    JOIN etl.users u ON u.user_id = pur.user_id
    JOIN gov.roles r ON r.role_id = pur.role_id
    WHERE p.pipeline_id = p_pipeline_id
    ORDER BY u.user_full_name, r.role_display_name;
$$;


ALTER FUNCTION catalog.fn_get_pipeline_permission_grants(p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5037 (class 0 OID 0)
-- Dependencies: 366
-- Name: FUNCTION fn_get_pipeline_permission_grants(p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_permission_grants(p_pipeline_id uuid) IS 'Returns all project-level permission grants for a pipeline including user and role details.';


--
-- TOC entry 646 (class 1255 OID 24580)
-- Name: fn_get_pipeline_runtime_info(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_runtime_info(p_pipeline_id uuid) RETURNS TABLE(pipeline_id uuid, active_version_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT p.pipeline_id, p.active_version_id
    FROM catalog.pipelines p
    WHERE p.pipeline_id = p_pipeline_id;
$$;


ALTER FUNCTION catalog.fn_get_pipeline_runtime_info(p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5038 (class 0 OID 0)
-- Dependencies: 646
-- Name: FUNCTION fn_get_pipeline_runtime_info(p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_runtime_info(p_pipeline_id uuid) IS 'Returns minimal pipeline identity info needed to check existence and active version before initialising a run.';


--
-- TOC entry 347 (class 1255 OID 18615)
-- Name: fn_get_pipeline_versions(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipeline_versions(p_pipeline_id uuid) RETURNS TABLE(version_id uuid, version_num_seq integer, release_tag_label text, created_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT version_id, version_num_seq, release_tag_label, created_dtm
    FROM catalog.pipeline_versions WHERE pipeline_id = p_pipeline_id ORDER BY version_num_seq DESC;
$$;


ALTER FUNCTION catalog.fn_get_pipeline_versions(p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5039 (class 0 OID 0)
-- Dependencies: 347
-- Name: FUNCTION fn_get_pipeline_versions(p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipeline_versions(p_pipeline_id uuid) IS 'Returns the version history of a pipeline in descending order.';


--
-- TOC entry 548 (class 1255 OID 18611)
-- Name: fn_get_pipelines(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipelines(p_project_id uuid) RETURNS TABLE(pipeline_id uuid, pipeline_display_name text, pipeline_desc_text text, active_version_id uuid, has_active_version boolean, folder_id uuid, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        pipeline_id,
        pipeline_display_name,
        pipeline_desc_text,
        active_version_id,
        (active_version_id IS NOT NULL) AS has_active_version,
        folder_id,
        updated_dtm
    FROM catalog.pipelines
    WHERE project_id = p_project_id
    ORDER BY pipeline_display_name;
$$;


ALTER FUNCTION catalog.fn_get_pipelines(p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5040 (class 0 OID 0)
-- Dependencies: 548
-- Name: FUNCTION fn_get_pipelines(p_project_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipelines(p_project_id uuid) IS 'Lists all pipelines in a project. lifecycle_status_code removed by design — state is implied by whether active_version_id is set.';


--
-- TOC entry 557 (class 1255 OID 24664)
-- Name: fn_get_pipelines_by_folder(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipelines_by_folder(p_folder_id uuid) RETURNS TABLE(pipeline_id uuid, project_id uuid, folder_id uuid, pipeline_display_name text, pipeline_desc_text text, active_version_id uuid, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT pipeline_id, project_id, folder_id, pipeline_display_name,
           pipeline_desc_text, active_version_id, created_dtm, updated_dtm
    FROM catalog.pipelines
    WHERE folder_id = p_folder_id
    ORDER BY pipeline_display_name;
$$;


ALTER FUNCTION catalog.fn_get_pipelines_by_folder(p_folder_id uuid) OWNER TO postgres;

--
-- TOC entry 5041 (class 0 OID 0)
-- Dependencies: 557
-- Name: FUNCTION fn_get_pipelines_by_folder(p_folder_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipelines_by_folder(p_folder_id uuid) IS 'Returns pipelines directly inside a folder. Used by the folder-view sidebar and folder workspace.';


--
-- TOC entry 617 (class 1255 OID 18639)
-- Name: fn_get_pipelines_for_orchestrator(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipelines_for_orchestrator(p_orch_id uuid) RETURNS TABLE(pipeline_id uuid, pipeline_display_name text, dag_node_ref_text text, dependency_order_num integer)
    LANGUAGE sql STABLE
    AS $$
    SELECT p.pipeline_id, p.pipeline_display_name, m.dag_node_ref_text, m.dependency_order_num
    FROM catalog.orchestrator_pipeline_map m
    JOIN catalog.pipelines p ON m.pipeline_id = p.pipeline_id
    WHERE m.orch_id = p_orch_id
    ORDER BY m.dependency_order_num, p.pipeline_display_name;
$$;


ALTER FUNCTION catalog.fn_get_pipelines_for_orchestrator(p_orch_id uuid) OWNER TO postgres;

--
-- TOC entry 5042 (class 0 OID 0)
-- Dependencies: 617
-- Name: FUNCTION fn_get_pipelines_for_orchestrator(p_orch_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipelines_for_orchestrator(p_orch_id uuid) IS 'Returns all pipelines coordinated by a given orchestrator in dependency order. Answers: which pipelines does this orchestrator run?';


--
-- TOC entry 415 (class 1255 OID 18630)
-- Name: fn_get_pipelines_impacted_by_dataset(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_pipelines_impacted_by_dataset(p_dataset_id uuid) RETURNS TABLE(pipeline_id uuid, pipeline_display_name text, access_mode_code text, version_num_seq integer)
    LANGUAGE sql STABLE
    AS $$
    SELECT dm.pipeline_id, p.pipeline_display_name, dm.access_mode_code, pv.version_num_seq
    FROM catalog.pipeline_dataset_map dm
    JOIN catalog.pipelines p ON dm.pipeline_id = p.pipeline_id
    JOIN catalog.pipeline_versions pv ON dm.version_id = pv.version_id
    WHERE dm.dataset_id = p_dataset_id
      AND p.active_version_id = dm.version_id   -- only show active version references
    ORDER BY p.pipeline_display_name;
$$;


ALTER FUNCTION catalog.fn_get_pipelines_impacted_by_dataset(p_dataset_id uuid) OWNER TO postgres;

--
-- TOC entry 5043 (class 0 OID 0)
-- Dependencies: 415
-- Name: FUNCTION fn_get_pipelines_impacted_by_dataset(p_dataset_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_pipelines_impacted_by_dataset(p_dataset_id uuid) IS 'Returns all active pipelines that READ from or WRITE to a specific dataset. Use before modifying a dataset schema to assess downstream impact.';


--
-- TOC entry 605 (class 1255 OID 24667)
-- Name: fn_get_root_orchestrators(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_root_orchestrators(p_project_id uuid) RETURNS TABLE(orch_id uuid, project_id uuid, folder_id uuid, orch_display_name text, orch_desc_text text, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT orch_id, project_id, folder_id, orch_display_name,
           orch_desc_text, created_dtm, updated_dtm
    FROM catalog.orchestrators
    WHERE project_id = p_project_id AND folder_id IS NULL
    ORDER BY orch_display_name;
$$;


ALTER FUNCTION catalog.fn_get_root_orchestrators(p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5044 (class 0 OID 0)
-- Dependencies: 605
-- Name: FUNCTION fn_get_root_orchestrators(p_project_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_root_orchestrators(p_project_id uuid) IS 'Returns project-root orchestrators (folder_id IS NULL) for the left sidebar tree.';


--
-- TOC entry 402 (class 1255 OID 24666)
-- Name: fn_get_root_pipelines(uuid); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_get_root_pipelines(p_project_id uuid) RETURNS TABLE(pipeline_id uuid, project_id uuid, folder_id uuid, pipeline_display_name text, pipeline_desc_text text, active_version_id uuid, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT pipeline_id, project_id, folder_id, pipeline_display_name,
           pipeline_desc_text, active_version_id, created_dtm, updated_dtm
    FROM catalog.pipelines
    WHERE project_id = p_project_id AND folder_id IS NULL
    ORDER BY pipeline_display_name;
$$;


ALTER FUNCTION catalog.fn_get_root_pipelines(p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5045 (class 0 OID 0)
-- Dependencies: 402
-- Name: FUNCTION fn_get_root_pipelines(p_project_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_get_root_pipelines(p_project_id uuid) IS 'Returns project-root pipelines (folder_id IS NULL) for the left sidebar tree.';


--
-- TOC entry 511 (class 1255 OID 18612)
-- Name: fn_list_pipelines(uuid, uuid, text, integer, integer); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_list_pipelines(p_project_id uuid DEFAULT NULL::uuid, p_folder_id uuid DEFAULT NULL::uuid, p_search_text text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(pipeline_id uuid, pipeline_display_name text, pipeline_desc_text text, active_version_id uuid, has_active_version boolean, folder_id uuid, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        pipeline_id, pipeline_display_name, pipeline_desc_text,
        active_version_id, (active_version_id IS NOT NULL) AS has_active_version,
        folder_id, updated_dtm
    FROM catalog.pipelines
    WHERE project_id = p_project_id
      AND (p_folder_id IS NULL OR folder_id = p_folder_id)
      AND (p_search_text IS NULL OR pipeline_display_name ILIKE '%' || p_search_text || '%'
           OR pipeline_desc_text ILIKE '%' || p_search_text || '%')
    ORDER BY pipeline_display_name ASC
    LIMIT p_limit OFFSET p_offset;
$$;


ALTER FUNCTION catalog.fn_list_pipelines(p_project_id uuid, p_folder_id uuid, p_search_text text, p_limit integer, p_offset integer) OWNER TO postgres;

--
-- TOC entry 5046 (class 0 OID 0)
-- Dependencies: 511
-- Name: FUNCTION fn_list_pipelines(p_project_id uuid, p_folder_id uuid, p_search_text text, p_limit integer, p_offset integer); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_list_pipelines(p_project_id uuid, p_folder_id uuid, p_search_text text, p_limit integer, p_offset integer) IS 'Project-scoped paginated pipeline list with optional folder and search filters.';


--
-- TOC entry 468 (class 1255 OID 24594)
-- Name: fn_list_pipelines(uuid, text, integer, integer, text, text); Type: FUNCTION; Schema: catalog; Owner: postgres
--

CREATE FUNCTION catalog.fn_list_pipelines(p_project_id uuid DEFAULT NULL::uuid, p_search_text text DEFAULT NULL::text, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0, p_order_by text DEFAULT 'updated_dtm'::text, p_order_dir text DEFAULT 'DESC'::text) RETURNS TABLE(pipeline_id uuid, project_id uuid, folder_id uuid, pipeline_display_name text, pipeline_desc_text text, active_version_id uuid, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    WITH filtered AS (
        SELECT p.pipeline_id, p.project_id, p.folder_id,
               p.pipeline_display_name, p.pipeline_desc_text,
               p.active_version_id, p.created_dtm, p.updated_dtm
        FROM catalog.pipelines p
        WHERE (p_project_id IS NULL OR p.project_id = p_project_id)
          AND (p_search_text IS NULL
               OR p.pipeline_display_name ILIKE '%' || p_search_text || '%'
               OR COALESCE(p.pipeline_desc_text,'') ILIKE '%' || p_search_text || '%')
    )
    SELECT f.pipeline_id, f.project_id, f.folder_id,
           f.pipeline_display_name, f.pipeline_desc_text,
           f.active_version_id, f.created_dtm, f.updated_dtm
    FROM filtered f
    ORDER BY
        CASE WHEN lower(p_order_by)='pipeline_display_name' AND upper(p_order_dir)='ASC'  THEN f.pipeline_display_name END ASC NULLS LAST,
        CASE WHEN lower(p_order_by)='pipeline_display_name' AND upper(p_order_dir)='DESC' THEN f.pipeline_display_name END DESC NULLS LAST,
        CASE WHEN lower(p_order_by)='created_dtm'           AND upper(p_order_dir)='ASC'  THEN f.created_dtm END ASC NULLS LAST,
        CASE WHEN lower(p_order_by)='created_dtm'           AND upper(p_order_dir)='DESC' THEN f.created_dtm END DESC NULLS LAST,
        CASE WHEN lower(p_order_by)='updated_dtm'           AND upper(p_order_dir)='ASC'  THEN f.updated_dtm END ASC NULLS LAST,
        CASE WHEN lower(p_order_by)='updated_dtm'           AND upper(p_order_dir)='DESC' THEN f.updated_dtm END DESC NULLS LAST,
        f.updated_dtm DESC
    LIMIT GREATEST(COALESCE(p_limit,200),1)
    OFFSET GREATEST(COALESCE(p_offset,0),0);
$$;


ALTER FUNCTION catalog.fn_list_pipelines(p_project_id uuid, p_search_text text, p_limit integer, p_offset integer, p_order_by text, p_order_dir text) OWNER TO postgres;

--
-- TOC entry 5047 (class 0 OID 0)
-- Dependencies: 468
-- Name: FUNCTION fn_list_pipelines(p_project_id uuid, p_search_text text, p_limit integer, p_offset integer, p_order_by text, p_order_dir text); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON FUNCTION catalog.fn_list_pipelines(p_project_id uuid, p_search_text text, p_limit integer, p_offset integer, p_order_by text, p_order_dir text) IS 'Global/cross-project paginated pipeline list with sort and search. Used by the global pipelines API.';


--
-- TOC entry 396 (class 1255 OID 24669)
-- Name: pr_clear_pipeline_parameters(uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_clear_pipeline_parameters(IN p_pipeline_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM catalog.pipeline_parameters WHERE pipeline_id = p_pipeline_id;
END;
$$;


ALTER PROCEDURE catalog.pr_clear_pipeline_parameters(IN p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5048 (class 0 OID 0)
-- Dependencies: 396
-- Name: PROCEDURE pr_clear_pipeline_parameters(IN p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_clear_pipeline_parameters(IN p_pipeline_id uuid) IS 'Removes all declared runtime parameters for a pipeline prior to a full re-sync from the UI.';


--
-- TOC entry 572 (class 1255 OID 18622)
-- Name: pr_commit_orchestrator_version(uuid, text, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_commit_orchestrator_version(IN p_orch_id uuid, IN p_commit_msg_text text, IN p_created_by_user_id uuid, OUT p_orch_version_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_next_seq     INTEGER;
    v_dag_snapshot JSONB;
BEGIN
    -- Get current DAG definition as the snapshot
    SELECT dag_definition_json INTO v_dag_snapshot FROM catalog.orchestrators WHERE orch_id = p_orch_id;

    -- Increment version number
    SELECT COALESCE(MAX(version_num_seq), 0) + 1 INTO v_next_seq
    FROM catalog.orchestrator_versions WHERE orch_id = p_orch_id;

    INSERT INTO catalog.orchestrator_versions
        (orch_id, version_num_seq, dag_snapshot_json, commit_msg_text, created_by_user_id)
    VALUES (p_orch_id, v_next_seq, v_dag_snapshot, p_commit_msg_text, p_created_by_user_id)
    RETURNING orch_version_id INTO p_orch_version_id;

    -- Advance the active version pointer
    UPDATE catalog.orchestrators SET
        active_orch_version_id = p_orch_version_id,
        updated_by_user_id     = p_created_by_user_id
    WHERE orch_id = p_orch_id;
END;
$$;


ALTER PROCEDURE catalog.pr_commit_orchestrator_version(IN p_orch_id uuid, IN p_commit_msg_text text, IN p_created_by_user_id uuid, OUT p_orch_version_id uuid) OWNER TO postgres;

--
-- TOC entry 5049 (class 0 OID 0)
-- Dependencies: 572
-- Name: PROCEDURE pr_commit_orchestrator_version(IN p_orch_id uuid, IN p_commit_msg_text text, IN p_created_by_user_id uuid, OUT p_orch_version_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_commit_orchestrator_version(IN p_orch_id uuid, IN p_commit_msg_text text, IN p_created_by_user_id uuid, OUT p_orch_version_id uuid) IS 'Commits the current orchestrator DAG as an immutable versioned snapshot. Mirrors the pipeline version commit pattern. Advances active_orch_version_id.';


--
-- TOC entry 593 (class 1255 OID 18618)
-- Name: pr_commit_pipeline_version(uuid, text, jsonb, jsonb, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_commit_pipeline_version(IN p_pipeline_id uuid, IN p_commit_msg_text text, IN p_ir_payload_json jsonb, IN p_ui_layout_json jsonb, IN p_created_by_user_id uuid, OUT p_version_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_next_seq INTEGER;
BEGIN
    -- Get next sequential version number
    SELECT COALESCE(MAX(version_num_seq), 0) + 1 INTO v_next_seq
    FROM catalog.pipeline_versions WHERE pipeline_id = p_pipeline_id;

    -- Create the version record
    INSERT INTO catalog.pipeline_versions (pipeline_id, version_num_seq, commit_msg_text, created_by_user_id)
    VALUES (p_pipeline_id, v_next_seq, p_commit_msg_text, p_created_by_user_id)
    RETURNING version_id INTO p_version_id;

    -- Law 14: Immediately store the pipeline body (IR + UI layout)
    INSERT INTO catalog.pipeline_contents (version_id, ir_payload_json, ui_layout_json, content_checksum_text)
    VALUES (
        p_version_id, p_ir_payload_json, p_ui_layout_json,
        md5(p_ir_payload_json::TEXT)
    );

    -- Advance the active version pointer on the pipeline
    UPDATE catalog.pipelines SET active_version_id = p_version_id
    WHERE pipeline_id = p_pipeline_id;
END;
$$;


ALTER PROCEDURE catalog.pr_commit_pipeline_version(IN p_pipeline_id uuid, IN p_commit_msg_text text, IN p_ir_payload_json jsonb, IN p_ui_layout_json jsonb, IN p_created_by_user_id uuid, OUT p_version_id uuid) OWNER TO postgres;

--
-- TOC entry 5050 (class 0 OID 0)
-- Dependencies: 593
-- Name: PROCEDURE pr_commit_pipeline_version(IN p_pipeline_id uuid, IN p_commit_msg_text text, IN p_ir_payload_json jsonb, IN p_ui_layout_json jsonb, IN p_created_by_user_id uuid, OUT p_version_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_commit_pipeline_version(IN p_pipeline_id uuid, IN p_commit_msg_text text, IN p_ir_payload_json jsonb, IN p_ui_layout_json jsonb, IN p_created_by_user_id uuid, OUT p_version_id uuid) IS 'Law 14: Atomic operation that creates a new version AND stores the full pipeline body (IR + UI) in pipeline_contents. There is no version without a body.';


--
-- TOC entry 414 (class 1255 OID 18839)
-- Name: pr_create_connector(text, text, jsonb, jsonb, text, text, jsonb, text, jsonb, jsonb, integer, integer, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_create_connector(IN p_connector_display_name text, IN p_connector_type_code text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_created_by_user_id uuid, OUT p_connector_id uuid)
    LANGUAGE plpgsql
    AS $$
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
        created_by_user_id
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
        p_created_by_user_id
    ) RETURNING connector_id INTO p_connector_id;

    -- Initialize health record as UNKNOWN
    INSERT INTO catalog.connector_health (connector_id, health_status_code)
    VALUES (p_connector_id, 'UNKNOWN');
END;
$$;


ALTER PROCEDURE catalog.pr_create_connector(IN p_connector_display_name text, IN p_connector_type_code text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_created_by_user_id uuid, OUT p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 5051 (class 0 OID 0)
-- Dependencies: 414
-- Name: PROCEDURE pr_create_connector(IN p_connector_display_name text, IN p_connector_type_code text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_created_by_user_id uuid, OUT p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_create_connector(IN p_connector_display_name text, IN p_connector_type_code text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_created_by_user_id uuid, OUT p_connector_id uuid) IS 'Law 3: Registers a new connector with config, secrets, SSH tunnel, and proxy all encrypted via pgcrypto before storage. Initializes a health record in UNKNOWN state.';


--
-- TOC entry 607 (class 1255 OID 24694)
-- Name: pr_create_connector(text, text, jsonb, jsonb, text, text, jsonb, text, jsonb, jsonb, integer, integer, uuid, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_create_connector(IN p_connector_display_name text, IN p_connector_type_code text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_created_by_user_id uuid, IN p_technology_id uuid, OUT p_connector_id uuid)
    LANGUAGE plpgsql
    AS $$
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


ALTER PROCEDURE catalog.pr_create_connector(IN p_connector_display_name text, IN p_connector_type_code text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_created_by_user_id uuid, IN p_technology_id uuid, OUT p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 533 (class 1255 OID 18857)
-- Name: pr_create_node_template(text, text, text, text, text, jsonb, jsonb, boolean, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_create_node_template(IN p_template_name text, IN p_category_code text, IN p_sub_type_code text, IN p_technology_code text, IN p_desc_text text, IN p_config_template jsonb, IN p_tags_json jsonb, IN p_is_public_flag boolean, IN p_created_by_user_id uuid, OUT p_template_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO catalog.node_templates (
        template_name, category_code, sub_type_code, technology_code,
        desc_text, config_template, tags_json, is_public_flag, created_by_user_id
    )
    VALUES (
        p_template_name, p_category_code, p_sub_type_code, p_technology_code,
        p_desc_text, p_config_template, p_tags_json, p_is_public_flag, p_created_by_user_id
    )
    RETURNING template_id INTO p_template_id;
END;
$$;


ALTER PROCEDURE catalog.pr_create_node_template(IN p_template_name text, IN p_category_code text, IN p_sub_type_code text, IN p_technology_code text, IN p_desc_text text, IN p_config_template jsonb, IN p_tags_json jsonb, IN p_is_public_flag boolean, IN p_created_by_user_id uuid, OUT p_template_id uuid) OWNER TO postgres;

--
-- TOC entry 5052 (class 0 OID 0)
-- Dependencies: 533
-- Name: PROCEDURE pr_create_node_template(IN p_template_name text, IN p_category_code text, IN p_sub_type_code text, IN p_technology_code text, IN p_desc_text text, IN p_config_template jsonb, IN p_tags_json jsonb, IN p_is_public_flag boolean, IN p_created_by_user_id uuid, OUT p_template_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_create_node_template(IN p_template_name text, IN p_category_code text, IN p_sub_type_code text, IN p_technology_code text, IN p_desc_text text, IN p_config_template jsonb, IN p_tags_json jsonb, IN p_is_public_flag boolean, IN p_created_by_user_id uuid, OUT p_template_id uuid) IS 'Creates a new node blueprint definition.';


--
-- TOC entry 378 (class 1255 OID 18620)
-- Name: pr_create_orchestrator(uuid, uuid, text, jsonb, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_create_orchestrator(IN p_project_id uuid, IN p_folder_id uuid, IN p_orch_display_name text, IN p_dag_definition_json jsonb, IN p_created_by_user_id uuid, OUT p_orch_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO catalog.orchestrators (project_id, folder_id, orch_display_name, dag_definition_json, created_by_user_id)
    VALUES (p_project_id, p_folder_id, p_orch_display_name, p_dag_definition_json, p_created_by_user_id)
    RETURNING orch_id INTO p_orch_id;
END;
$$;


ALTER PROCEDURE catalog.pr_create_orchestrator(IN p_project_id uuid, IN p_folder_id uuid, IN p_orch_display_name text, IN p_dag_definition_json jsonb, IN p_created_by_user_id uuid, OUT p_orch_id uuid) OWNER TO postgres;

--
-- TOC entry 5053 (class 0 OID 0)
-- Dependencies: 378
-- Name: PROCEDURE pr_create_orchestrator(IN p_project_id uuid, IN p_folder_id uuid, IN p_orch_display_name text, IN p_dag_definition_json jsonb, IN p_created_by_user_id uuid, OUT p_orch_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_create_orchestrator(IN p_project_id uuid, IN p_folder_id uuid, IN p_orch_display_name text, IN p_dag_definition_json jsonb, IN p_created_by_user_id uuid, OUT p_orch_id uuid) IS 'Creates a new orchestrator DAG definition.';


--
-- TOC entry 482 (class 1255 OID 18617)
-- Name: pr_create_pipeline(uuid, uuid, text, text, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_create_pipeline(IN p_project_id uuid, IN p_folder_id uuid, IN p_pipeline_display_name text, IN p_pipeline_desc_text text, IN p_created_by_user_id uuid, OUT p_pipeline_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO catalog.pipelines (project_id, folder_id, pipeline_display_name, pipeline_desc_text, created_by_user_id)
    VALUES (p_project_id, p_folder_id, p_pipeline_display_name, p_pipeline_desc_text, p_created_by_user_id)
    RETURNING pipeline_id INTO p_pipeline_id;
END;
$$;


ALTER PROCEDURE catalog.pr_create_pipeline(IN p_project_id uuid, IN p_folder_id uuid, IN p_pipeline_display_name text, IN p_pipeline_desc_text text, IN p_created_by_user_id uuid, OUT p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5054 (class 0 OID 0)
-- Dependencies: 482
-- Name: PROCEDURE pr_create_pipeline(IN p_project_id uuid, IN p_folder_id uuid, IN p_pipeline_display_name text, IN p_pipeline_desc_text text, IN p_created_by_user_id uuid, OUT p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_create_pipeline(IN p_project_id uuid, IN p_folder_id uuid, IN p_pipeline_display_name text, IN p_pipeline_desc_text text, IN p_created_by_user_id uuid, OUT p_pipeline_id uuid) IS 'Creates a new pipeline definition record. The first version/body is created separately via pr_commit_pipeline_version.';


--
-- TOC entry 633 (class 1255 OID 18634)
-- Name: pr_create_tag(text, text); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_create_tag(IN p_tag_display_name text, OUT p_tag_id uuid, IN p_tag_color_hex text DEFAULT NULL::text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO catalog.tags (tag_display_name, tag_color_hex)
    VALUES (p_tag_display_name, p_tag_color_hex)
    RETURNING tag_id INTO p_tag_id;
END;
$$;


ALTER PROCEDURE catalog.pr_create_tag(IN p_tag_display_name text, OUT p_tag_id uuid, IN p_tag_color_hex text) OWNER TO postgres;

--
-- TOC entry 5055 (class 0 OID 0)
-- Dependencies: 633
-- Name: PROCEDURE pr_create_tag(IN p_tag_display_name text, OUT p_tag_id uuid, IN p_tag_color_hex text); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_create_tag(IN p_tag_display_name text, OUT p_tag_id uuid, IN p_tag_color_hex text) IS 'Creates a new tag in the global tag vocabulary.';


--
-- TOC entry 447 (class 1255 OID 18841)
-- Name: pr_delete_connector(uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_delete_connector(IN p_connector_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 4: Physical delete. History trigger captures row before removal.
    -- CASCADE removes associated datasets, dataset_columns, health, file_format_options.
    DELETE FROM catalog.connectors WHERE connector_id = p_connector_id;
END;
$$;


ALTER PROCEDURE catalog.pr_delete_connector(IN p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 5056 (class 0 OID 0)
-- Dependencies: 447
-- Name: PROCEDURE pr_delete_connector(IN p_connector_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_delete_connector(IN p_connector_id uuid) IS 'Law 4: Physical deletion of a connector. Cascade removes associated datasets, columns, health, and file format options.';


--
-- TOC entry 582 (class 1255 OID 18621)
-- Name: pr_delete_orchestrator(uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_delete_orchestrator(IN p_orch_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 4: Physical delete. History trigger fires.
    DELETE FROM catalog.orchestrators WHERE orch_id = p_orch_id;
END;
$$;


ALTER PROCEDURE catalog.pr_delete_orchestrator(IN p_orch_id uuid) OWNER TO postgres;

--
-- TOC entry 5057 (class 0 OID 0)
-- Dependencies: 582
-- Name: PROCEDURE pr_delete_orchestrator(IN p_orch_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_delete_orchestrator(IN p_orch_id uuid) IS 'Law 4: Physically removes an orchestrator record.';


--
-- TOC entry 356 (class 1255 OID 18619)
-- Name: pr_delete_pipeline(uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_delete_pipeline(IN p_pipeline_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 4: Physical delete. History trigger fires. Cascade handles versions and contents.
    DELETE FROM catalog.pipelines WHERE pipeline_id = p_pipeline_id;
END;
$$;


ALTER PROCEDURE catalog.pr_delete_pipeline(IN p_pipeline_id uuid) OWNER TO postgres;

--
-- TOC entry 5058 (class 0 OID 0)
-- Dependencies: 356
-- Name: PROCEDURE pr_delete_pipeline(IN p_pipeline_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_delete_pipeline(IN p_pipeline_id uuid) IS 'Law 4: Physically removes a pipeline and all its versions and content bodies.';


--
-- TOC entry 508 (class 1255 OID 24590)
-- Name: pr_grant_orchestrator_permission(uuid, uuid, uuid, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_grant_orchestrator_permission(IN p_orch_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT o.project_id INTO v_project_id
  FROM catalog.orchestrators o
  WHERE o.orch_id = p_orch_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Orchestrator is not project-scoped or does not exist'
      USING ERRCODE = 'P0002';
  END IF;

  CALL gov.pr_grant_project_user_role(v_project_id, p_user_id, p_role_id, p_granted_by_user_id);
END;
$$;


ALTER PROCEDURE catalog.pr_grant_orchestrator_permission(IN p_orch_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5059 (class 0 OID 0)
-- Dependencies: 508
-- Name: PROCEDURE pr_grant_orchestrator_permission(IN p_orch_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_grant_orchestrator_permission(IN p_orch_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid) IS 'Grants a project-scoped role for the orchestrator parent project; used by orchestrator permissions UI.';


--
-- TOC entry 655 (class 1255 OID 24587)
-- Name: pr_grant_pipeline_permission(uuid, uuid, uuid, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_grant_pipeline_permission(IN p_pipeline_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_project_id UUID;
BEGIN
    SELECT project_id INTO v_project_id FROM catalog.pipelines WHERE pipeline_id = p_pipeline_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pipeline % not found', p_pipeline_id; END IF;
    INSERT INTO gov.project_user_roles (project_id, user_id, role_id, granted_by_user_id)
    VALUES (v_project_id, p_user_id, p_role_id, p_granted_by_user_id)
    ON CONFLICT (project_id, user_id, role_id) DO NOTHING;
END;
$$;


ALTER PROCEDURE catalog.pr_grant_pipeline_permission(IN p_pipeline_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5060 (class 0 OID 0)
-- Dependencies: 655
-- Name: PROCEDURE pr_grant_pipeline_permission(IN p_pipeline_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_grant_pipeline_permission(IN p_pipeline_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid) IS 'Grants a project-level role to a user, giving them access to all pipelines within the project.';


--
-- TOC entry 551 (class 1255 OID 18631)
-- Name: pr_log_connection_test(uuid, boolean, text, integer, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_log_connection_test(IN p_connector_id uuid, IN p_test_passed_flag boolean, IN p_error_message_text text, IN p_response_time_ms integer, IN p_tested_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO catalog.connection_test_results
        (connector_id, test_passed_flag, error_message_text, response_time_ms, tested_by_user_id)
    VALUES (p_connector_id, p_test_passed_flag, p_error_message_text, p_response_time_ms, p_tested_by_user_id);
END;
$$;


ALTER PROCEDURE catalog.pr_log_connection_test(IN p_connector_id uuid, IN p_test_passed_flag boolean, IN p_error_message_text text, IN p_response_time_ms integer, IN p_tested_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5061 (class 0 OID 0)
-- Dependencies: 551
-- Name: PROCEDURE pr_log_connection_test(IN p_connector_id uuid, IN p_test_passed_flag boolean, IN p_error_message_text text, IN p_response_time_ms integer, IN p_tested_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_log_connection_test(IN p_connector_id uuid, IN p_test_passed_flag boolean, IN p_error_message_text text, IN p_response_time_ms integer, IN p_tested_by_user_id uuid) IS 'Records the outcome of a connector test. Appended on every test run. Physical deletes use ON DELETE CASCADE from the connector.';


--
-- TOC entry 428 (class 1255 OID 18633)
-- Name: pr_log_pipeline_validation(uuid, boolean, jsonb, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_log_pipeline_validation(IN p_pipeline_id uuid, IN p_validation_passed_flag boolean, IN p_validation_errors_json jsonb, IN p_validated_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_error_count INTEGER := COALESCE(jsonb_array_length(p_validation_errors_json), 0);
BEGIN
    INSERT INTO catalog.pipeline_validation_results
        (pipeline_id, validation_passed_flag, error_count_num, validation_errors_json, validated_by_user_id)
    VALUES (p_pipeline_id, p_validation_passed_flag, v_error_count, p_validation_errors_json, p_validated_by_user_id);
END;
$$;


ALTER PROCEDURE catalog.pr_log_pipeline_validation(IN p_pipeline_id uuid, IN p_validation_passed_flag boolean, IN p_validation_errors_json jsonb, IN p_validated_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5062 (class 0 OID 0)
-- Dependencies: 428
-- Name: PROCEDURE pr_log_pipeline_validation(IN p_pipeline_id uuid, IN p_validation_passed_flag boolean, IN p_validation_errors_json jsonb, IN p_validated_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_log_pipeline_validation(IN p_pipeline_id uuid, IN p_validation_passed_flag boolean, IN p_validation_errors_json jsonb, IN p_validated_by_user_id uuid) IS 'Records the outcome of a pipeline validation run. Called by the backend gate before allowing pr_commit_pipeline_version.';


--
-- TOC entry 507 (class 1255 OID 24616)
-- Name: pr_mark_dataset_refreshed(uuid, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_mark_dataset_refreshed(IN p_dataset_id uuid, IN p_updated_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE catalog.datasets
    SET
        last_introspection_dtm = CURRENT_TIMESTAMP,
        updated_dtm = CURRENT_TIMESTAMP,
        updated_by_user_id = p_updated_by_user_id
    WHERE dataset_id = p_dataset_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dataset not found'
            USING ERRCODE = 'P0002';
    END IF;
END;
$$;


ALTER PROCEDURE catalog.pr_mark_dataset_refreshed(IN p_dataset_id uuid, IN p_updated_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5063 (class 0 OID 0)
-- Dependencies: 507
-- Name: PROCEDURE pr_mark_dataset_refreshed(IN p_dataset_id uuid, IN p_updated_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_mark_dataset_refreshed(IN p_dataset_id uuid, IN p_updated_by_user_id uuid) IS 'Marks dataset metadata as refreshed (timestamp update) for explicit UI refresh actions.';


--
-- TOC entry 434 (class 1255 OID 24662)
-- Name: pr_record_connection_test(uuid, boolean, integer, text, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_record_connection_test(IN p_connector_id uuid, IN p_passed boolean, IN p_latency_ms integer, IN p_error_text text, IN p_tested_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO catalog.connection_test_results
        (connector_id, test_passed_flag, response_time_ms, error_message_text, tested_by_user_id)
    VALUES
        (p_connector_id, p_passed, p_latency_ms, p_error_text, p_tested_by_user_id);
EXCEPTION
    WHEN undefined_table THEN
        -- Table may not exist in all environments; silently skip
        NULL;
END;
$$;


ALTER PROCEDURE catalog.pr_record_connection_test(IN p_connector_id uuid, IN p_passed boolean, IN p_latency_ms integer, IN p_error_text text, IN p_tested_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5064 (class 0 OID 0)
-- Dependencies: 434
-- Name: PROCEDURE pr_record_connection_test(IN p_connector_id uuid, IN p_passed boolean, IN p_latency_ms integer, IN p_error_text text, IN p_tested_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_record_connection_test(IN p_connector_id uuid, IN p_passed boolean, IN p_latency_ms integer, IN p_error_text text, IN p_tested_by_user_id uuid) IS 'Appends a connection test result to catalog.connection_test_results. Silently no-ops if the table does not yet exist.';


--
-- TOC entry 464 (class 1255 OID 18626)
-- Name: pr_record_lineage_edges(uuid, uuid, jsonb); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_record_lineage_edges(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_lineage_json jsonb)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_edge JSONB;
BEGIN
    -- Clear existing lineage for this version before re-recording
    DELETE FROM catalog.data_lineage WHERE pipeline_id = p_pipeline_id AND version_id = p_version_id;

    FOR v_edge IN SELECT * FROM jsonb_array_elements(p_lineage_json)
    LOOP
        INSERT INTO catalog.data_lineage
            (pipeline_id, version_id, src_dataset_id, src_column_name_text,
             tgt_dataset_id, tgt_column_name_text, transformation_desc_text)
        VALUES (
            p_pipeline_id, p_version_id,
            (v_edge->>'src_dataset_id')::UUID,
            v_edge->>'src_column_name_text',
            (v_edge->>'tgt_dataset_id')::UUID,
            v_edge->>'tgt_column_name_text',
            v_edge->>'transformation_desc_text'
        );
    END LOOP;
END;
$$;


ALTER PROCEDURE catalog.pr_record_lineage_edges(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_lineage_json jsonb) OWNER TO postgres;

--
-- TOC entry 5065 (class 0 OID 0)
-- Dependencies: 464
-- Name: PROCEDURE pr_record_lineage_edges(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_lineage_json jsonb); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_record_lineage_edges(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_lineage_json jsonb) IS 'Replaces all column-level lineage edges for a pipeline version. Called by the codegen engine after IR analysis. Accepts a JSONB array of {src_dataset_id, src_column, tgt_dataset_id, tgt_column, transformation} objects.';


--
-- TOC entry 640 (class 1255 OID 18850)
-- Name: pr_register_dataset(uuid, text, text, text, text); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_register_dataset(IN p_connector_id uuid, IN p_db_name_text text, IN p_schema_name_text text, IN p_table_name_text text, OUT p_dataset_id uuid, IN p_dataset_type_code text DEFAULT 'TABLE'::text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO catalog.datasets (connector_id, db_name_text, schema_name_text, table_name_text, dataset_type_code)
    VALUES (p_connector_id, p_db_name_text, p_schema_name_text, p_table_name_text, p_dataset_type_code)
    RETURNING dataset_id INTO p_dataset_id;
END;
$$;


ALTER PROCEDURE catalog.pr_register_dataset(IN p_connector_id uuid, IN p_db_name_text text, IN p_schema_name_text text, IN p_table_name_text text, OUT p_dataset_id uuid, IN p_dataset_type_code text) OWNER TO postgres;

--
-- TOC entry 5066 (class 0 OID 0)
-- Dependencies: 640
-- Name: PROCEDURE pr_register_dataset(IN p_connector_id uuid, IN p_db_name_text text, IN p_schema_name_text text, IN p_table_name_text text, OUT p_dataset_id uuid, IN p_dataset_type_code text); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_register_dataset(IN p_connector_id uuid, IN p_db_name_text text, IN p_schema_name_text text, IN p_table_name_text text, OUT p_dataset_id uuid, IN p_dataset_type_code text) IS 'Registers a new data asset in the metadata catalog.';


--
-- TOC entry 467 (class 1255 OID 24591)
-- Name: pr_revoke_orchestrator_permission(uuid, uuid, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_revoke_orchestrator_permission(IN p_orch_id uuid, IN p_user_id uuid, IN p_role_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT o.project_id INTO v_project_id
  FROM catalog.orchestrators o
  WHERE o.orch_id = p_orch_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Orchestrator is not project-scoped or does not exist'
      USING ERRCODE = 'P0002';
  END IF;

  CALL gov.pr_revoke_project_user_role(v_project_id, p_user_id, p_role_id);
END;
$$;


ALTER PROCEDURE catalog.pr_revoke_orchestrator_permission(IN p_orch_id uuid, IN p_user_id uuid, IN p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5067 (class 0 OID 0)
-- Dependencies: 467
-- Name: PROCEDURE pr_revoke_orchestrator_permission(IN p_orch_id uuid, IN p_user_id uuid, IN p_role_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_revoke_orchestrator_permission(IN p_orch_id uuid, IN p_user_id uuid, IN p_role_id uuid) IS 'Revokes a project-scoped role assignment for the orchestrator parent project.';


--
-- TOC entry 410 (class 1255 OID 24588)
-- Name: pr_revoke_pipeline_permission(uuid, uuid, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_revoke_pipeline_permission(IN p_pipeline_id uuid, IN p_user_id uuid, IN p_role_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_project_id UUID;
BEGIN
    SELECT project_id INTO v_project_id FROM catalog.pipelines WHERE pipeline_id = p_pipeline_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pipeline % not found', p_pipeline_id; END IF;
    DELETE FROM gov.project_user_roles
    WHERE project_id = v_project_id AND user_id = p_user_id AND role_id = p_role_id;
END;
$$;


ALTER PROCEDURE catalog.pr_revoke_pipeline_permission(IN p_pipeline_id uuid, IN p_user_id uuid, IN p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5068 (class 0 OID 0)
-- Dependencies: 410
-- Name: PROCEDURE pr_revoke_pipeline_permission(IN p_pipeline_id uuid, IN p_user_id uuid, IN p_role_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_revoke_pipeline_permission(IN p_pipeline_id uuid, IN p_user_id uuid, IN p_role_id uuid) IS 'Revokes a project-level role from a user.';


--
-- TOC entry 453 (class 1255 OID 18851)
-- Name: pr_sync_dataset_columns(uuid, jsonb); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_sync_dataset_columns(IN p_dataset_id uuid, IN p_columns_json jsonb)
    LANGUAGE plpgsql
    AS $$
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


ALTER PROCEDURE catalog.pr_sync_dataset_columns(IN p_dataset_id uuid, IN p_columns_json jsonb) OWNER TO postgres;

--
-- TOC entry 5069 (class 0 OID 0)
-- Dependencies: 453
-- Name: PROCEDURE pr_sync_dataset_columns(IN p_dataset_id uuid, IN p_columns_json jsonb); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_sync_dataset_columns(IN p_dataset_id uuid, IN p_columns_json jsonb) IS 'Replaces all column metadata for a dataset. Used after a schema introspection scan.';


--
-- TOC entry 353 (class 1255 OID 18858)
-- Name: pr_sync_node_templates(jsonb); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_sync_node_templates(IN p_templates_json jsonb)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tmpl JSONB;
BEGIN
    FOR v_tmpl IN SELECT * FROM jsonb_array_elements(p_templates_json)
    LOOP
        INSERT INTO catalog.node_templates (
            template_name, category_code, sub_type_code, technology_code,
            desc_text, config_template, tags_json, is_public_flag
        )
        VALUES (
            v_tmpl->>'template_name',
            v_tmpl->>'category_code',
            v_tmpl->>'sub_type_code',
            v_tmpl->>'technology_code',
            v_tmpl->>'desc_text',
            v_tmpl->'config_template',
            COALESCE(v_tmpl->'tags_json', '[]'::JSONB),
            COALESCE((v_tmpl->>'is_public_flag')::BOOLEAN, true)
        )
        ON CONFLICT (template_name, category_code) DO UPDATE SET
            sub_type_code   = EXCLUDED.sub_type_code,
            technology_code = EXCLUDED.technology_code,
            desc_text       = EXCLUDED.desc_text,
            config_template = EXCLUDED.config_template,
            tags_json       = EXCLUDED.tags_json,
            is_public_flag  = EXCLUDED.is_public_flag,
            updated_dtm     = CURRENT_TIMESTAMP;
    END LOOP;
END;
$$;


ALTER PROCEDURE catalog.pr_sync_node_templates(IN p_templates_json jsonb) OWNER TO postgres;

--
-- TOC entry 5070 (class 0 OID 0)
-- Dependencies: 353
-- Name: PROCEDURE pr_sync_node_templates(IN p_templates_json jsonb); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_sync_node_templates(IN p_templates_json jsonb) IS 'Syncs a batch of node templates (seed data).';


--
-- TOC entry 592 (class 1255 OID 18637)
-- Name: pr_sync_orchestrator_pipeline_map(uuid, jsonb); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_sync_orchestrator_pipeline_map(IN p_orch_id uuid, IN p_map_entries_json jsonb)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_entry JSONB;
BEGIN
    -- Rebuild from scratch on every DAG save
    DELETE FROM catalog.orchestrator_pipeline_map WHERE orch_id = p_orch_id;
    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_map_entries_json)
    LOOP
        INSERT INTO catalog.orchestrator_pipeline_map
            (orch_id, pipeline_id, dag_node_ref_text, dependency_order_num)
        VALUES (
            p_orch_id,
            (v_entry->>'pipeline_id')::UUID,
            v_entry->>'dag_node_ref_text',
            COALESCE((v_entry->>'dependency_order_num')::INTEGER, 0)
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;


ALTER PROCEDURE catalog.pr_sync_orchestrator_pipeline_map(IN p_orch_id uuid, IN p_map_entries_json jsonb) OWNER TO postgres;

--
-- TOC entry 5071 (class 0 OID 0)
-- Dependencies: 592
-- Name: PROCEDURE pr_sync_orchestrator_pipeline_map(IN p_orch_id uuid, IN p_map_entries_json jsonb); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_sync_orchestrator_pipeline_map(IN p_orch_id uuid, IN p_map_entries_json jsonb) IS 'Replaces the design-time pipeline membership map for an orchestrator. Called on every DAG save alongside pr_create_orchestrator and pr_commit_orchestrator_version. Input: [{pipeline_id, dag_node_ref_text, dependency_order_num}].';


--
-- TOC entry 426 (class 1255 OID 18629)
-- Name: pr_sync_pipeline_dataset_map(uuid, uuid, jsonb); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_sync_pipeline_dataset_map(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_dataset_map_json jsonb)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_entry JSONB;
BEGIN
    DELETE FROM catalog.pipeline_dataset_map WHERE pipeline_id = p_pipeline_id AND version_id = p_version_id;
    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_dataset_map_json)
    LOOP
        INSERT INTO catalog.pipeline_dataset_map
            (pipeline_id, version_id, dataset_id, access_mode_code, node_id_text)
        VALUES (
            p_pipeline_id, p_version_id,
            (v_entry->>'dataset_id')::UUID,
            v_entry->>'access_mode_code',
            v_entry->>'node_id_text'
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;


ALTER PROCEDURE catalog.pr_sync_pipeline_dataset_map(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_dataset_map_json jsonb) OWNER TO postgres;

--
-- TOC entry 5072 (class 0 OID 0)
-- Dependencies: 426
-- Name: PROCEDURE pr_sync_pipeline_dataset_map(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_dataset_map_json jsonb); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_sync_pipeline_dataset_map(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_dataset_map_json jsonb) IS 'Replaces the dataset dependency map for a pipeline version. Called on every commit alongside pr_record_lineage_edges to enable fast impact analysis without IR parsing.';


--
-- TOC entry 465 (class 1255 OID 18635)
-- Name: pr_tag_asset(uuid, text, uuid, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_tag_asset(IN p_tag_id uuid, IN p_asset_type_code text, IN p_asset_id uuid, IN p_tagged_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO catalog.asset_tags (tag_id, asset_type_code, asset_id, tagged_by_user_id)
    VALUES (p_tag_id, p_asset_type_code, p_asset_id, p_tagged_by_user_id)
    ON CONFLICT DO NOTHING;
END;
$$;


ALTER PROCEDURE catalog.pr_tag_asset(IN p_tag_id uuid, IN p_asset_type_code text, IN p_asset_id uuid, IN p_tagged_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5073 (class 0 OID 0)
-- Dependencies: 465
-- Name: PROCEDURE pr_tag_asset(IN p_tag_id uuid, IN p_asset_type_code text, IN p_asset_id uuid, IN p_tagged_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_tag_asset(IN p_tag_id uuid, IN p_asset_type_code text, IN p_asset_id uuid, IN p_tagged_by_user_id uuid) IS 'Applies a tag to a platform asset. Idempotent — duplicate tagging is silently ignored.';


--
-- TOC entry 604 (class 1255 OID 18840)
-- Name: pr_update_connector(uuid, text, jsonb, jsonb, text, text, jsonb, text, jsonb, jsonb, integer, integer, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_update_connector(IN p_connector_id uuid, IN p_connector_display_name text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_updated_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_enc_key TEXT := current_setting('app.encryption_key');
BEGIN
    UPDATE catalog.connectors SET
        connector_display_name        = COALESCE(p_connector_display_name, connector_display_name),
        conn_config_json_encrypted    = CASE WHEN p_conn_config_plain IS NOT NULL
                                            THEN pgp_sym_encrypt(p_conn_config_plain::TEXT, v_enc_key)
                                            ELSE conn_config_json_encrypted END,
        conn_secrets_json_encrypted   = CASE WHEN p_conn_secrets_plain IS NOT NULL
                                            THEN pgp_sym_encrypt(p_conn_secrets_plain::TEXT, v_enc_key)
                                            ELSE conn_secrets_json_encrypted END,
        conn_jdbc_driver_class        = COALESCE(p_conn_jdbc_driver_class, conn_jdbc_driver_class),
        conn_test_query               = COALESCE(p_conn_test_query, conn_test_query),
        conn_spark_config_json        = COALESCE(p_conn_spark_config_json, conn_spark_config_json),
        conn_ssl_mode                 = COALESCE(p_conn_ssl_mode, conn_ssl_mode),
        conn_ssh_tunnel_json_encrypted = CASE WHEN p_conn_ssh_tunnel_plain IS NOT NULL
                                             THEN pgp_sym_encrypt(p_conn_ssh_tunnel_plain::TEXT, v_enc_key)
                                             ELSE conn_ssh_tunnel_json_encrypted END,
        conn_proxy_json_encrypted     = CASE WHEN p_conn_proxy_plain IS NOT NULL
                                            THEN pgp_sym_encrypt(p_conn_proxy_plain::TEXT, v_enc_key)
                                            ELSE conn_proxy_json_encrypted END,
        conn_max_pool_size_num        = COALESCE(p_conn_max_pool_size_num, conn_max_pool_size_num),
        conn_idle_timeout_sec         = COALESCE(p_conn_idle_timeout_sec, conn_idle_timeout_sec),
        updated_by_user_id            = p_updated_by_user_id
    WHERE connector_id = p_connector_id;
END;
$$;


ALTER PROCEDURE catalog.pr_update_connector(IN p_connector_id uuid, IN p_connector_display_name text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_updated_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5074 (class 0 OID 0)
-- Dependencies: 604
-- Name: PROCEDURE pr_update_connector(IN p_connector_id uuid, IN p_connector_display_name text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_updated_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_update_connector(IN p_connector_id uuid, IN p_connector_display_name text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_updated_by_user_id uuid) IS 'Updates an existing connector. Only non-NULL parameters overwrite existing values. Re-encrypts config, secrets, SSH tunnel, and proxy if new plaintext is provided.';


--
-- TOC entry 539 (class 1255 OID 24695)
-- Name: pr_update_connector(uuid, text, jsonb, jsonb, text, text, jsonb, text, jsonb, jsonb, integer, integer, uuid, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_update_connector(IN p_connector_id uuid, IN p_connector_display_name text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_updated_by_user_id uuid, IN p_technology_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_enc_key TEXT := current_setting('app.encryption_key');
BEGIN
    UPDATE catalog.connectors SET
        connector_display_name        = COALESCE(p_connector_display_name, connector_display_name),
        conn_config_json_encrypted    = CASE WHEN p_conn_config_plain IS NOT NULL
                                            THEN pgp_sym_encrypt(p_conn_config_plain::TEXT, v_enc_key)
                                            ELSE conn_config_json_encrypted END,
        conn_secrets_json_encrypted   = CASE WHEN p_conn_secrets_plain IS NOT NULL
                                            THEN pgp_sym_encrypt(p_conn_secrets_plain::TEXT, v_enc_key)
                                            ELSE conn_secrets_json_encrypted END,
        conn_jdbc_driver_class        = COALESCE(p_conn_jdbc_driver_class, conn_jdbc_driver_class),
        conn_test_query               = COALESCE(p_conn_test_query, conn_test_query),
        conn_spark_config_json        = COALESCE(p_conn_spark_config_json, conn_spark_config_json),
        conn_ssl_mode                 = COALESCE(p_conn_ssl_mode, conn_ssl_mode),
        conn_ssh_tunnel_json_encrypted = CASE WHEN p_conn_ssh_tunnel_plain IS NOT NULL
                                             THEN pgp_sym_encrypt(p_conn_ssh_tunnel_plain::TEXT, v_enc_key)
                                             ELSE conn_ssh_tunnel_json_encrypted END,
        conn_proxy_json_encrypted     = CASE WHEN p_conn_proxy_plain IS NOT NULL
                                            THEN pgp_sym_encrypt(p_conn_proxy_plain::TEXT, v_enc_key)
                                            ELSE conn_proxy_json_encrypted END,
        conn_max_pool_size_num        = COALESCE(p_conn_max_pool_size_num, conn_max_pool_size_num),
        conn_idle_timeout_sec         = COALESCE(p_conn_idle_timeout_sec, conn_idle_timeout_sec),
        updated_by_user_id            = p_updated_by_user_id,
        technology_id                 = COALESCE(p_technology_id, technology_id)
    WHERE connector_id = p_connector_id;
END;
$$;


ALTER PROCEDURE catalog.pr_update_connector(IN p_connector_id uuid, IN p_connector_display_name text, IN p_conn_config_plain jsonb, IN p_conn_secrets_plain jsonb, IN p_conn_jdbc_driver_class text, IN p_conn_test_query text, IN p_conn_spark_config_json jsonb, IN p_conn_ssl_mode text, IN p_conn_ssh_tunnel_plain jsonb, IN p_conn_proxy_plain jsonb, IN p_conn_max_pool_size_num integer, IN p_conn_idle_timeout_sec integer, IN p_updated_by_user_id uuid, IN p_technology_id uuid) OWNER TO postgres;

--
-- TOC entry 657 (class 1255 OID 18853)
-- Name: pr_update_node_template(uuid, text, text, jsonb, jsonb, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_update_node_template(IN p_template_id uuid, IN p_template_name text DEFAULT NULL::text, IN p_desc_text text DEFAULT NULL::text, IN p_config_template jsonb DEFAULT NULL::jsonb, IN p_tags_json jsonb DEFAULT NULL::jsonb, IN p_updated_by_user_id uuid DEFAULT NULL::uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE catalog.node_templates SET
        template_name = COALESCE(p_template_name, template_name),
        desc_text = COALESCE(p_desc_text, desc_text),
        config_template = COALESCE(p_config_template, config_template),
        tags_json = COALESCE(p_tags_json, tags_json),
        updated_dtm = CURRENT_TIMESTAMP
    WHERE template_id = p_template_id;
END;
$$;


ALTER PROCEDURE catalog.pr_update_node_template(IN p_template_id uuid, IN p_template_name text, IN p_desc_text text, IN p_config_template jsonb, IN p_tags_json jsonb, IN p_updated_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5075 (class 0 OID 0)
-- Dependencies: 657
-- Name: PROCEDURE pr_update_node_template(IN p_template_id uuid, IN p_template_name text, IN p_desc_text text, IN p_config_template jsonb, IN p_tags_json jsonb, IN p_updated_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_update_node_template(IN p_template_id uuid, IN p_template_name text, IN p_desc_text text, IN p_config_template jsonb, IN p_tags_json jsonb, IN p_updated_by_user_id uuid) IS 'Updates an existing node blueprint definition.';


--
-- TOC entry 335 (class 1255 OID 24668)
-- Name: pr_update_orchestrator(uuid, text, text, jsonb, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_update_orchestrator(IN p_orch_id uuid, IN p_orch_display_name text, IN p_orch_desc_text text, IN p_dag_definition_json jsonb, IN p_updated_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE catalog.orchestrators
    SET orch_display_name   = COALESCE(p_orch_display_name, orch_display_name),
        orch_desc_text      = COALESCE(p_orch_desc_text, orch_desc_text),
        dag_definition_json = COALESCE(p_dag_definition_json, dag_definition_json),
        updated_by_user_id  = p_updated_by_user_id,
        updated_dtm         = CURRENT_TIMESTAMP
    WHERE orch_id = p_orch_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orchestrator not found' USING ERRCODE = 'P0002';
    END IF;
END;
$$;


ALTER PROCEDURE catalog.pr_update_orchestrator(IN p_orch_id uuid, IN p_orch_display_name text, IN p_orch_desc_text text, IN p_dag_definition_json jsonb, IN p_updated_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5076 (class 0 OID 0)
-- Dependencies: 335
-- Name: PROCEDURE pr_update_orchestrator(IN p_orch_id uuid, IN p_orch_display_name text, IN p_orch_desc_text text, IN p_dag_definition_json jsonb, IN p_updated_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_update_orchestrator(IN p_orch_id uuid, IN p_orch_display_name text, IN p_orch_desc_text text, IN p_dag_definition_json jsonb, IN p_updated_by_user_id uuid) IS 'Updates orchestrator display name, description, and/or DAG JSON. Only non-NULL fields are applied. Raises P0002 on missing orchestrator.';


--
-- TOC entry 427 (class 1255 OID 24596)
-- Name: pr_update_pipeline_metadata(uuid, text, text, uuid); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_update_pipeline_metadata(IN p_pipeline_id uuid, IN p_pipeline_display_name text, IN p_pipeline_desc_text text, IN p_updated_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE catalog.pipelines
    SET pipeline_display_name = COALESCE(p_pipeline_display_name, pipeline_display_name),
        pipeline_desc_text    = COALESCE(p_pipeline_desc_text,    pipeline_desc_text),
        updated_dtm           = CURRENT_TIMESTAMP,
        updated_by_user_id    = p_updated_by_user_id
    WHERE pipeline_id = p_pipeline_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pipeline % not found', p_pipeline_id;
    END IF;
END;
$$;


ALTER PROCEDURE catalog.pr_update_pipeline_metadata(IN p_pipeline_id uuid, IN p_pipeline_display_name text, IN p_pipeline_desc_text text, IN p_updated_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5077 (class 0 OID 0)
-- Dependencies: 427
-- Name: PROCEDURE pr_update_pipeline_metadata(IN p_pipeline_id uuid, IN p_pipeline_display_name text, IN p_pipeline_desc_text text, IN p_updated_by_user_id uuid); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_update_pipeline_metadata(IN p_pipeline_id uuid, IN p_pipeline_display_name text, IN p_pipeline_desc_text text, IN p_updated_by_user_id uuid) IS 'Updates pipeline display name and/or description without touching version history.';


--
-- TOC entry 339 (class 1255 OID 18842)
-- Name: pr_upsert_connector_health(uuid, text, integer, text, timestamp with time zone); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_upsert_connector_health(IN p_connector_id uuid, IN p_health_status_code text, IN p_check_latency_ms integer, IN p_check_error_text text, IN p_next_check_dtm timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
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


ALTER PROCEDURE catalog.pr_upsert_connector_health(IN p_connector_id uuid, IN p_health_status_code text, IN p_check_latency_ms integer, IN p_check_error_text text, IN p_next_check_dtm timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 5078 (class 0 OID 0)
-- Dependencies: 339
-- Name: PROCEDURE pr_upsert_connector_health(IN p_connector_id uuid, IN p_health_status_code text, IN p_check_latency_ms integer, IN p_check_error_text text, IN p_next_check_dtm timestamp with time zone); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_upsert_connector_health(IN p_connector_id uuid, IN p_health_status_code text, IN p_check_latency_ms integer, IN p_check_error_text text, IN p_next_check_dtm timestamp with time zone) IS 'Upserts health check results for a connector. Resets consecutive failures on HEALTHY, increments on failure, auto-degrades after 3 consecutive failures.';


--
-- TOC entry 369 (class 1255 OID 18845)
-- Name: pr_upsert_file_format_options(uuid, text, text, text, text, text, text, boolean, text, text, text, text, boolean, text, integer, text, text, text, text, integer, text); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_upsert_file_format_options(IN p_connector_id uuid, IN p_file_format_code text, IN p_field_separator_char text, IN p_decimal_separator_char text, IN p_date_format_text text, IN p_timestamp_format_text text, IN p_encoding_standard_code text, IN p_has_header_flag boolean, IN p_quote_char_text text, IN p_escape_char_text text, IN p_null_value_text text, IN p_line_separator_text text, IN p_multiline_flag boolean, IN p_sheet_name_text text, IN p_sheet_index_num integer, IN p_root_tag_text text, IN p_row_tag_text text, IN p_corrupt_record_mode text, IN p_column_widths_text text, IN p_skip_rows_num integer, IN p_compression_code text)
    LANGUAGE plpgsql
    AS $$
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


ALTER PROCEDURE catalog.pr_upsert_file_format_options(IN p_connector_id uuid, IN p_file_format_code text, IN p_field_separator_char text, IN p_decimal_separator_char text, IN p_date_format_text text, IN p_timestamp_format_text text, IN p_encoding_standard_code text, IN p_has_header_flag boolean, IN p_quote_char_text text, IN p_escape_char_text text, IN p_null_value_text text, IN p_line_separator_text text, IN p_multiline_flag boolean, IN p_sheet_name_text text, IN p_sheet_index_num integer, IN p_root_tag_text text, IN p_row_tag_text text, IN p_corrupt_record_mode text, IN p_column_widths_text text, IN p_skip_rows_num integer, IN p_compression_code text) OWNER TO postgres;

--
-- TOC entry 5079 (class 0 OID 0)
-- Dependencies: 369
-- Name: PROCEDURE pr_upsert_file_format_options(IN p_connector_id uuid, IN p_file_format_code text, IN p_field_separator_char text, IN p_decimal_separator_char text, IN p_date_format_text text, IN p_timestamp_format_text text, IN p_encoding_standard_code text, IN p_has_header_flag boolean, IN p_quote_char_text text, IN p_escape_char_text text, IN p_null_value_text text, IN p_line_separator_text text, IN p_multiline_flag boolean, IN p_sheet_name_text text, IN p_sheet_index_num integer, IN p_root_tag_text text, IN p_row_tag_text text, IN p_corrupt_record_mode text, IN p_column_widths_text text, IN p_skip_rows_num integer, IN p_compression_code text); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_upsert_file_format_options(IN p_connector_id uuid, IN p_file_format_code text, IN p_field_separator_char text, IN p_decimal_separator_char text, IN p_date_format_text text, IN p_timestamp_format_text text, IN p_encoding_standard_code text, IN p_has_header_flag boolean, IN p_quote_char_text text, IN p_escape_char_text text, IN p_null_value_text text, IN p_line_separator_text text, IN p_multiline_flag boolean, IN p_sheet_name_text text, IN p_sheet_index_num integer, IN p_root_tag_text text, IN p_row_tag_text text, IN p_corrupt_record_mode text, IN p_column_widths_text text, IN p_skip_rows_num integer, IN p_compression_code text) IS 'Creates or replaces file format options for a connector. One format config per connector (UNIQUE on connector_id).';


--
-- TOC entry 597 (class 1255 OID 18624)
-- Name: pr_upsert_pipeline_parameter(uuid, text, text, text, boolean, text); Type: PROCEDURE; Schema: catalog; Owner: postgres
--

CREATE PROCEDURE catalog.pr_upsert_pipeline_parameter(IN p_pipeline_id uuid, IN p_param_key_name text, IN p_param_data_type_code text, IN p_default_value_text text, IN p_is_required_flag boolean, IN p_param_desc_text text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO catalog.pipeline_parameters
        (pipeline_id, param_key_name, param_data_type_code, default_value_text, is_required_flag, param_desc_text)
    VALUES (p_pipeline_id, p_param_key_name, p_param_data_type_code, p_default_value_text, p_is_required_flag, p_param_desc_text)
    ON CONFLICT (pipeline_id, param_key_name) DO UPDATE SET
        param_data_type_code = EXCLUDED.param_data_type_code,
        default_value_text   = EXCLUDED.default_value_text,
        is_required_flag     = EXCLUDED.is_required_flag,
        param_desc_text      = EXCLUDED.param_desc_text;
END;
$$;


ALTER PROCEDURE catalog.pr_upsert_pipeline_parameter(IN p_pipeline_id uuid, IN p_param_key_name text, IN p_param_data_type_code text, IN p_default_value_text text, IN p_is_required_flag boolean, IN p_param_desc_text text) OWNER TO postgres;

--
-- TOC entry 5080 (class 0 OID 0)
-- Dependencies: 597
-- Name: PROCEDURE pr_upsert_pipeline_parameter(IN p_pipeline_id uuid, IN p_param_key_name text, IN p_param_data_type_code text, IN p_default_value_text text, IN p_is_required_flag boolean, IN p_param_desc_text text); Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON PROCEDURE catalog.pr_upsert_pipeline_parameter(IN p_pipeline_id uuid, IN p_param_key_name text, IN p_param_data_type_code text, IN p_default_value_text text, IN p_is_required_flag boolean, IN p_param_desc_text text) IS 'Creates or updates a declared runtime parameter for a pipeline. Idempotent on param_key_name.';


--
-- TOC entry 431 (class 1255 OID 24652)
-- Name: fn_get_active_user_by_id(uuid); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_active_user_by_id(p_user_id uuid) RETURNS TABLE(user_id uuid, email_address text, user_full_name text, password_hash_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT user_id, email_address, user_full_name, password_hash_text
    FROM etl.users
    WHERE user_id = p_user_id
      AND is_account_active = TRUE;
$$;


ALTER FUNCTION etl.fn_get_active_user_by_id(p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5081 (class 0 OID 0)
-- Dependencies: 431
-- Name: FUNCTION fn_get_active_user_by_id(p_user_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_active_user_by_id(p_user_id uuid) IS 'Returns profile fields plus password hash for an active user. password_hash used only by change-password endpoint; never forwarded to API responses.';


--
-- TOC entry 641 (class 1255 OID 18585)
-- Name: fn_get_all_user_drafts(uuid); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_all_user_drafts(p_user_id uuid) RETURNS TABLE(draft_id uuid, entity_type_code text, entity_id uuid, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT draft_id, entity_type_code, entity_id, updated_dtm
    FROM etl.user_work_drafts
    WHERE user_id = p_user_id
    ORDER BY updated_dtm DESC;
$$;


ALTER FUNCTION etl.fn_get_all_user_drafts(p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5082 (class 0 OID 0)
-- Dependencies: 641
-- Name: FUNCTION fn_get_all_user_drafts(p_user_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_all_user_drafts(p_user_id uuid) IS 'Law 15: Returns all unsaved drafts for a user, enabling the "Recover unsaved work" UI panel.';


--
-- TOC entry 477 (class 1255 OID 24577)
-- Name: fn_get_folder_by_id(uuid); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_folder_by_id(p_folder_id uuid) RETURNS TABLE(folder_id uuid, project_id uuid, parent_folder_id uuid, folder_display_name text, folder_type_code text, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        f.folder_id,
        f.project_id,
        f.parent_folder_id,
        f.folder_display_name,
        f.folder_type_code,
        f.created_dtm,
        f.updated_dtm
    FROM etl.folders f
    WHERE f.folder_id = p_folder_id;
$$;


ALTER FUNCTION etl.fn_get_folder_by_id(p_folder_id uuid) OWNER TO postgres;

--
-- TOC entry 5083 (class 0 OID 0)
-- Dependencies: 477
-- Name: FUNCTION fn_get_folder_by_id(p_folder_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_folder_by_id(p_folder_id uuid) IS 'Returns one folder row with core metadata. Used by API routes to avoid direct table reads.';


--
-- TOC entry 409 (class 1255 OID 24656)
-- Name: fn_get_folder_children(uuid); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_folder_children(p_parent_folder_id uuid) RETURNS TABLE(folder_id uuid, project_id uuid, parent_folder_id uuid, folder_display_name text, folder_type_code text, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT folder_id, project_id, parent_folder_id, folder_display_name,
           folder_type_code, created_dtm, updated_dtm
    FROM etl.folders
    WHERE parent_folder_id = p_parent_folder_id
    ORDER BY folder_display_name;
$$;


ALTER FUNCTION etl.fn_get_folder_children(p_parent_folder_id uuid) OWNER TO postgres;

--
-- TOC entry 5084 (class 0 OID 0)
-- Dependencies: 409
-- Name: FUNCTION fn_get_folder_children(p_parent_folder_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_folder_children(p_parent_folder_id uuid) IS 'Returns direct child folders of a given parent folder.';


--
-- TOC entry 553 (class 1255 OID 18491)
-- Name: fn_get_folder_descendants(uuid); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_folder_descendants(p_folder_id uuid) RETURNS TABLE(folder_id uuid, folder_display_name text, hierarchical_path_ltree public.ltree)
    LANGUAGE sql STABLE
    AS $$
    SELECT f.folder_id, f.folder_display_name, f.hierarchical_path_ltree
    FROM etl.folders f
    JOIN etl.folders root ON root.folder_id = p_folder_id
    WHERE f.hierarchical_path_ltree <@ root.hierarchical_path_ltree;
$$;


ALTER FUNCTION etl.fn_get_folder_descendants(p_folder_id uuid) OWNER TO postgres;

--
-- TOC entry 5085 (class 0 OID 0)
-- Dependencies: 553
-- Name: FUNCTION fn_get_folder_descendants(p_folder_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_folder_descendants(p_folder_id uuid) IS 'Recursively returns all descendant folders of a given folder using LTREE <@ operator.';


--
-- TOC entry 363 (class 1255 OID 18490)
-- Name: fn_get_folder_tree(uuid); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_folder_tree(p_project_id uuid) RETURNS TABLE(folder_id uuid, folder_display_name text, parent_folder_id uuid, hierarchical_path_ltree public.ltree, folder_type_code text)
    LANGUAGE sql STABLE
    AS $$
    SELECT folder_id, folder_display_name, parent_folder_id, hierarchical_path_ltree, folder_type_code
    FROM etl.folders WHERE project_id = p_project_id ORDER BY hierarchical_path_ltree;
$$;


ALTER FUNCTION etl.fn_get_folder_tree(p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5086 (class 0 OID 0)
-- Dependencies: 363
-- Name: FUNCTION fn_get_folder_tree(p_project_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_folder_tree(p_project_id uuid) IS 'Returns the full folder tree for a project sorted by LTREE path for easy hierarchical rendering.';


--
-- TOC entry 435 (class 1255 OID 18469)
-- Name: fn_get_project_by_id(uuid); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_project_by_id(p_project_id uuid) RETURNS TABLE(project_id uuid, project_display_name text, project_desc_text text, created_dtm timestamp with time zone, updated_dtm timestamp with time zone, created_by_user_id uuid, updated_by_user_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT * FROM etl.projects WHERE project_id = p_project_id;
$$;


ALTER FUNCTION etl.fn_get_project_by_id(p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5087 (class 0 OID 0)
-- Dependencies: 435
-- Name: FUNCTION fn_get_project_by_id(p_project_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_project_by_id(p_project_id uuid) IS 'Returns a specific project header.';


--
-- TOC entry 506 (class 1255 OID 24655)
-- Name: fn_get_project_root_folders(uuid); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_project_root_folders(p_project_id uuid) RETURNS TABLE(folder_id uuid, project_id uuid, parent_folder_id uuid, folder_display_name text, folder_type_code text, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT folder_id, project_id, parent_folder_id, folder_display_name,
           folder_type_code, created_dtm, updated_dtm
    FROM etl.folders
    WHERE project_id = p_project_id
      AND parent_folder_id IS NULL
    ORDER BY folder_display_name;
$$;


ALTER FUNCTION etl.fn_get_project_root_folders(p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5088 (class 0 OID 0)
-- Dependencies: 506
-- Name: FUNCTION fn_get_project_root_folders(p_project_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_project_root_folders(p_project_id uuid) IS 'Returns top-level (root) folders for a project, i.e. those with no parent.';


--
-- TOC entry 518 (class 1255 OID 18489)
-- Name: fn_get_projects(); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_projects() RETURNS TABLE(project_id uuid, project_display_name text, project_desc_text text, created_by_full_name text, updated_by_full_name text, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        p.project_id,
        p.project_display_name,
        p.project_desc_text,
        cu.user_full_name AS created_by_full_name,
        uu.user_full_name AS updated_by_full_name,
        p.created_dtm,
        p.updated_dtm
    FROM etl.projects p
    LEFT JOIN etl.users cu ON p.created_by_user_id = cu.user_id
    LEFT JOIN etl.users uu ON p.updated_by_user_id = uu.user_id
    ORDER BY p.project_display_name;
$$;


ALTER FUNCTION etl.fn_get_projects() OWNER TO postgres;

--
-- TOC entry 5089 (class 0 OID 0)
-- Dependencies: 518
-- Name: FUNCTION fn_get_projects(); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_projects() IS 'Lists all projects with creator and last-editor names. No lifecycle_status_code or owner_user_id — a project exists or is deleted (Law 4).';


--
-- TOC entry 547 (class 1255 OID 18584)
-- Name: fn_get_user_draft(uuid, text, uuid); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_user_draft(p_user_id uuid, p_entity_type_code text, p_entity_id uuid DEFAULT NULL::uuid) RETURNS TABLE(draft_id uuid, draft_payload_json jsonb, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT draft_id, draft_payload_json, updated_dtm
    FROM etl.user_work_drafts
    WHERE user_id = p_user_id
      AND entity_type_code = p_entity_type_code
      AND (p_entity_id IS NULL OR entity_id = p_entity_id);
$$;


ALTER FUNCTION etl.fn_get_user_draft(p_user_id uuid, p_entity_type_code text, p_entity_id uuid) OWNER TO postgres;

--
-- TOC entry 5090 (class 0 OID 0)
-- Dependencies: 547
-- Name: FUNCTION fn_get_user_draft(p_user_id uuid, p_entity_type_code text, p_entity_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_user_draft(p_user_id uuid, p_entity_type_code text, p_entity_id uuid) IS 'Law 15: Retrieves the latest unsaved session state for a user. Called when the user reopens an asset they were editing.';


--
-- TOC entry 677 (class 1255 OID 24651)
-- Name: fn_get_user_for_login(text); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_get_user_for_login(p_email text) RETURNS TABLE(user_id uuid, email_address text, password_hash_text text, user_full_name text)
    LANGUAGE sql STABLE
    AS $$
    SELECT user_id, email_address, password_hash_text, user_full_name
    FROM etl.users
    WHERE email_address = p_email
      AND is_account_active = TRUE;
$$;


ALTER FUNCTION etl.fn_get_user_for_login(p_email text) OWNER TO postgres;

--
-- TOC entry 5091 (class 0 OID 0)
-- Dependencies: 677
-- Name: FUNCTION fn_get_user_for_login(p_email text); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_get_user_for_login(p_email text) IS 'Returns minimal user row for login credential verification. Only for internal auth use — never expose password_hash to API responses.';


--
-- TOC entry 358 (class 1255 OID 18435)
-- Name: fn_set_updated_dtm(); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_set_updated_dtm() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_dtm := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION etl.fn_set_updated_dtm() OWNER TO postgres;

--
-- TOC entry 5092 (class 0 OID 0)
-- Dependencies: 358
-- Name: FUNCTION fn_set_updated_dtm(); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_set_updated_dtm() IS 'Generic BEFORE UPDATE trigger to automatically refresh the updated_dtm column without requiring application-side logic.';


--
-- TOC entry 624 (class 1255 OID 18464)
-- Name: fn_verify_user_password(text, text); Type: FUNCTION; Schema: etl; Owner: postgres
--

CREATE FUNCTION etl.fn_verify_user_password(p_email_address text, p_plain_password text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    SELECT password_hash_text = crypt(p_plain_password, password_hash_text)
    FROM etl.users WHERE email_address = p_email_address AND is_account_active = TRUE;
$$;


ALTER FUNCTION etl.fn_verify_user_password(p_email_address text, p_plain_password text) OWNER TO postgres;

--
-- TOC entry 5093 (class 0 OID 0)
-- Dependencies: 624
-- Name: FUNCTION fn_verify_user_password(p_email_address text, p_plain_password text); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON FUNCTION etl.fn_verify_user_password(p_email_address text, p_plain_password text) IS 'Law 3: Verifies a login attempt using pgcrypto constant-time comparison. Returns TRUE on success.';


--
-- TOC entry 364 (class 1255 OID 18586)
-- Name: pr_autosave_draft(uuid, text, uuid, jsonb); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_autosave_draft(IN p_user_id uuid, IN p_entity_type_code text, IN p_entity_id uuid, IN p_draft_payload_json jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 15: Upsert ensures only one draft per user/entity combination
    INSERT INTO etl.user_work_drafts (user_id, entity_type_code, entity_id, draft_payload_json)
    VALUES (p_user_id, p_entity_type_code, p_entity_id, p_draft_payload_json)
    ON CONFLICT (user_id, entity_type_code, entity_id) DO UPDATE SET
        draft_payload_json = EXCLUDED.draft_payload_json,
        updated_dtm = CURRENT_TIMESTAMP;
END;
$$;


ALTER PROCEDURE etl.pr_autosave_draft(IN p_user_id uuid, IN p_entity_type_code text, IN p_entity_id uuid, IN p_draft_payload_json jsonb) OWNER TO postgres;

--
-- TOC entry 5094 (class 0 OID 0)
-- Dependencies: 364
-- Name: PROCEDURE pr_autosave_draft(IN p_user_id uuid, IN p_entity_type_code text, IN p_entity_id uuid, IN p_draft_payload_json jsonb); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_autosave_draft(IN p_user_id uuid, IN p_entity_type_code text, IN p_entity_id uuid, IN p_draft_payload_json jsonb) IS 'Law 15: Called on every autosave keystroke. Upserts the draft payload for the user+entity combination. Idempotent — safe to call repeatedly.';


--
-- TOC entry 538 (class 1255 OID 18495)
-- Name: pr_create_folder(uuid, uuid, text, text); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_create_folder(IN p_project_id uuid, IN p_parent_folder_id uuid, IN p_folder_display_name text, IN p_folder_type_code text, OUT p_folder_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_parent_path LTREE;
    v_new_path    LTREE;
BEGIN
    -- Build the LTREE path from parent
    IF p_parent_folder_id IS NOT NULL THEN
        SELECT hierarchical_path_ltree INTO v_parent_path FROM etl.folders WHERE folder_id = p_parent_folder_id;
        v_new_path := v_parent_path || replace(p_folder_display_name, ' ', '_')::LTREE;
    ELSE
        v_new_path := replace(p_folder_display_name, ' ', '_')::LTREE;
    END IF;

    INSERT INTO etl.folders (project_id, parent_folder_id, folder_display_name, hierarchical_path_ltree, folder_type_code)
    VALUES (p_project_id, p_parent_folder_id, p_folder_display_name, v_new_path, p_folder_type_code)
    RETURNING folder_id INTO p_folder_id;
END;
$$;


ALTER PROCEDURE etl.pr_create_folder(IN p_project_id uuid, IN p_parent_folder_id uuid, IN p_folder_display_name text, IN p_folder_type_code text, OUT p_folder_id uuid) OWNER TO postgres;

--
-- TOC entry 5095 (class 0 OID 0)
-- Dependencies: 538
-- Name: PROCEDURE pr_create_folder(IN p_project_id uuid, IN p_parent_folder_id uuid, IN p_folder_display_name text, IN p_folder_type_code text, OUT p_folder_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_create_folder(IN p_project_id uuid, IN p_parent_folder_id uuid, IN p_folder_display_name text, IN p_folder_type_code text, OUT p_folder_id uuid) IS 'Creates a folder within a project, computing its LTREE path from the parent. Supports unlimited depth nesting (Law 12).';


--
-- TOC entry 643 (class 1255 OID 18492)
-- Name: pr_create_project(text, text, uuid); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_create_project(IN p_project_display_name text, IN p_project_desc_text text, IN p_created_by_user_id uuid, OUT p_project_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO etl.projects (project_display_name, project_desc_text, created_by_user_id, updated_by_user_id)
    VALUES (p_project_display_name, p_project_desc_text, p_created_by_user_id, p_created_by_user_id)
    RETURNING project_id INTO p_project_id;
END;
$$;


ALTER PROCEDURE etl.pr_create_project(IN p_project_display_name text, IN p_project_desc_text text, IN p_created_by_user_id uuid, OUT p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5096 (class 0 OID 0)
-- Dependencies: 643
-- Name: PROCEDURE pr_create_project(IN p_project_display_name text, IN p_project_desc_text text, IN p_created_by_user_id uuid, OUT p_project_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_create_project(IN p_project_display_name text, IN p_project_desc_text text, IN p_created_by_user_id uuid, OUT p_project_id uuid) IS 'Creates a new project and records the creating user. No owner concept — access is via gov.project_user_roles.';


--
-- TOC entry 644 (class 1255 OID 18463)
-- Name: pr_create_user(text, text, text); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_create_user(IN p_email_address text, IN p_plain_password text, IN p_user_full_name text, OUT p_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 3: Hash password with pgcrypto before storage
    INSERT INTO etl.users (email_address, password_hash_text, user_full_name)
    VALUES (p_email_address, crypt(p_plain_password, gen_salt('bf', 12)), p_user_full_name)
    RETURNING user_id INTO p_user_id;
END;
$$;


ALTER PROCEDURE etl.pr_create_user(IN p_email_address text, IN p_plain_password text, IN p_user_full_name text, OUT p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5097 (class 0 OID 0)
-- Dependencies: 644
-- Name: PROCEDURE pr_create_user(IN p_email_address text, IN p_plain_password text, IN p_user_full_name text, OUT p_user_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_create_user(IN p_email_address text, IN p_plain_password text, IN p_user_full_name text, OUT p_user_id uuid) IS 'Law 3: Creates a user with bcrypt-hashed password (cost 12) via pgcrypto. Plain text is never stored.';


--
-- TOC entry 454 (class 1255 OID 18465)
-- Name: pr_deactivate_user(uuid); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_deactivate_user(IN p_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE etl.users SET is_account_active = FALSE WHERE user_id = p_user_id;
END;
$$;


ALTER PROCEDURE etl.pr_deactivate_user(IN p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5098 (class 0 OID 0)
-- Dependencies: 454
-- Name: PROCEDURE pr_deactivate_user(IN p_user_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_deactivate_user(IN p_user_id uuid) IS 'Disables a user account without physical deletion (preserves audit trail references).';


--
-- TOC entry 571 (class 1255 OID 18496)
-- Name: pr_delete_folder(uuid); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_delete_folder(IN p_folder_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_path LTREE;
BEGIN
    SELECT hierarchical_path_ltree INTO v_path FROM etl.folders WHERE folder_id = p_folder_id;
    -- Law 4: Physical delete of entire subtree using LTREE <@ operator
    DELETE FROM etl.folders WHERE hierarchical_path_ltree <@ v_path;
END;
$$;


ALTER PROCEDURE etl.pr_delete_folder(IN p_folder_id uuid) OWNER TO postgres;

--
-- TOC entry 5099 (class 0 OID 0)
-- Dependencies: 571
-- Name: PROCEDURE pr_delete_folder(IN p_folder_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_delete_folder(IN p_folder_id uuid) IS 'Law 4: Recursively physically deletes a folder and all its descendants using LTREE path matching.';


--
-- TOC entry 635 (class 1255 OID 18494)
-- Name: pr_delete_project(uuid); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_delete_project(IN p_project_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 4: Physical delete. Cascade handles folders and pipelines.
    -- History trigger captures project row before deletion.
    DELETE FROM etl.projects WHERE project_id = p_project_id;
END;
$$;


ALTER PROCEDURE etl.pr_delete_project(IN p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5100 (class 0 OID 0)
-- Dependencies: 635
-- Name: PROCEDURE pr_delete_project(IN p_project_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_delete_project(IN p_project_id uuid) IS 'Law 4: Physical delete of a project. ON DELETE CASCADE propagates to all child folders and pipelines.';


--
-- TOC entry 405 (class 1255 OID 18466)
-- Name: pr_delete_user(uuid); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_delete_user(IN p_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 4: Physical delete. History trigger captures row before removal.
    DELETE FROM etl.users WHERE user_id = p_user_id;
END;
$$;


ALTER PROCEDURE etl.pr_delete_user(IN p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5101 (class 0 OID 0)
-- Dependencies: 405
-- Name: PROCEDURE pr_delete_user(IN p_user_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_delete_user(IN p_user_id uuid) IS 'Law 4: Physically removes a user account. History trigger preserves the record before deletion.';


--
-- TOC entry 515 (class 1255 OID 18587)
-- Name: pr_discard_draft(uuid, text, uuid); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_discard_draft(IN p_user_id uuid, IN p_entity_type_code text, IN p_entity_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Physical delete — user has committed or explicitly rolled back
    DELETE FROM etl.user_work_drafts
    WHERE user_id = p_user_id
      AND entity_type_code = p_entity_type_code
      AND entity_id = p_entity_id;
END;
$$;


ALTER PROCEDURE etl.pr_discard_draft(IN p_user_id uuid, IN p_entity_type_code text, IN p_entity_id uuid) OWNER TO postgres;

--
-- TOC entry 5102 (class 0 OID 0)
-- Dependencies: 515
-- Name: PROCEDURE pr_discard_draft(IN p_user_id uuid, IN p_entity_type_code text, IN p_entity_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_discard_draft(IN p_user_id uuid, IN p_entity_type_code text, IN p_entity_id uuid) IS 'Law 15: Called after a successful commit (pr_commit_pipeline_version) or explicit rollback. Physically removes the draft.';


--
-- TOC entry 351 (class 1255 OID 24653)
-- Name: pr_record_user_login(uuid); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_record_user_login(IN p_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE etl.users
    SET last_login_dtm = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
END;
$$;


ALTER PROCEDURE etl.pr_record_user_login(IN p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5103 (class 0 OID 0)
-- Dependencies: 351
-- Name: PROCEDURE pr_record_user_login(IN p_user_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_record_user_login(IN p_user_id uuid) IS 'Records a successful login by stamping last_login_dtm. Called after JWT issuance.';


--
-- TOC entry 632 (class 1255 OID 24657)
-- Name: pr_rename_folder(uuid, text); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_rename_folder(IN p_folder_id uuid, IN p_new_display_name text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_old_ltree TEXT;
    v_new_slug  TEXT;
    v_new_ltree TEXT;
    v_parts     TEXT[];
BEGIN
    SELECT hierarchical_path_ltree::TEXT
    INTO v_old_ltree
    FROM etl.folders
    WHERE folder_id = p_folder_id;

    IF v_old_ltree IS NULL THEN
        RAISE EXCEPTION 'Folder not found' USING ERRCODE = 'P0002';
    END IF;

    v_new_slug  := REGEXP_REPLACE(LOWER(TRIM(p_new_display_name)), '[^a-z0-9_]', '_', 'g');
    v_new_slug  := REGEXP_REPLACE(v_new_slug, '_+', '_', 'g');
    v_parts     := STRING_TO_ARRAY(v_old_ltree, '.');
    v_parts[ARRAY_UPPER(v_parts, 1)] := v_new_slug;
    v_new_ltree := ARRAY_TO_STRING(v_parts, '.');

    -- Rename folder itself
    UPDATE etl.folders
    SET folder_display_name     = TRIM(p_new_display_name),
        hierarchical_path_ltree = v_new_ltree::ltree,
        updated_dtm             = CURRENT_TIMESTAMP
    WHERE folder_id = p_folder_id;

    -- Re-root all descendant ltree paths
    IF v_old_ltree <> v_new_ltree THEN
        UPDATE etl.folders
        SET hierarchical_path_ltree = (v_new_ltree::ltree || SUBPATH(hierarchical_path_ltree, NLEVEL(v_old_ltree::ltree)))
        WHERE hierarchical_path_ltree <@ v_old_ltree::ltree
          AND folder_id <> p_folder_id;
    END IF;
END;
$$;


ALTER PROCEDURE etl.pr_rename_folder(IN p_folder_id uuid, IN p_new_display_name text) OWNER TO postgres;

--
-- TOC entry 5104 (class 0 OID 0)
-- Dependencies: 632
-- Name: PROCEDURE pr_rename_folder(IN p_folder_id uuid, IN p_new_display_name text); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_rename_folder(IN p_folder_id uuid, IN p_new_display_name text) IS 'Renames a folder and cascades the ltree path update to all descendant folders atomically.';


--
-- TOC entry 522 (class 1255 OID 18493)
-- Name: pr_update_project(uuid, text, text, uuid); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_update_project(IN p_project_id uuid, IN p_project_display_name text DEFAULT NULL::text, IN p_project_desc_text text DEFAULT NULL::text, IN p_updated_by_user_id uuid DEFAULT NULL::uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE etl.projects SET
        project_display_name = COALESCE(p_project_display_name, project_display_name),
        project_desc_text    = COALESCE(p_project_desc_text, project_desc_text),
        updated_by_user_id   = COALESCE(p_updated_by_user_id, updated_by_user_id)
    WHERE project_id = p_project_id;
    -- updated_dtm auto-refreshed by tr_ts_etl_projects trigger
END;
$$;


ALTER PROCEDURE etl.pr_update_project(IN p_project_id uuid, IN p_project_display_name text, IN p_project_desc_text text, IN p_updated_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5105 (class 0 OID 0)
-- Dependencies: 522
-- Name: PROCEDURE pr_update_project(IN p_project_id uuid, IN p_project_display_name text, IN p_project_desc_text text, IN p_updated_by_user_id uuid); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_update_project(IN p_project_id uuid, IN p_project_display_name text, IN p_project_desc_text text, IN p_updated_by_user_id uuid) IS 'Updates project display name or description. lifecycle_status_code removed by design — a project exists or is deleted.';


--
-- TOC entry 626 (class 1255 OID 24654)
-- Name: pr_update_user_password(uuid, text); Type: PROCEDURE; Schema: etl; Owner: postgres
--

CREATE PROCEDURE etl.pr_update_user_password(IN p_user_id uuid, IN p_new_hash text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE etl.users
    SET password_hash_text = p_new_hash,
        updated_dtm        = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
END;
$$;


ALTER PROCEDURE etl.pr_update_user_password(IN p_user_id uuid, IN p_new_hash text) OWNER TO postgres;

--
-- TOC entry 5106 (class 0 OID 0)
-- Dependencies: 626
-- Name: PROCEDURE pr_update_user_password(IN p_user_id uuid, IN p_new_hash text); Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON PROCEDURE etl.pr_update_user_password(IN p_user_id uuid, IN p_new_hash text) IS 'Stores a new bcrypt password hash. Called after successful current-password verification in change-password flow.';


--
-- TOC entry 503 (class 1255 OID 24680)
-- Name: fn_count_orchestrator_runs(uuid, uuid, text, text); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_count_orchestrator_runs(p_project_id uuid DEFAULT NULL::uuid, p_orch_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_trigger_type text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
    SELECT COUNT(*)
    FROM execution.orchestrator_runs orch
    LEFT JOIN catalog.orchestrators o ON o.orch_id = orch.orch_id
    WHERE (p_project_id   IS NULL OR o.project_id         = p_project_id)
      AND (p_orch_id      IS NULL OR orch.orch_id          = p_orch_id)
      AND (p_status       IS NULL OR orch.run_status_code  = p_status)
      AND (p_trigger_type IS NULL OR orch.trigger_type_code = p_trigger_type);
$$;


ALTER FUNCTION execution.fn_count_orchestrator_runs(p_project_id uuid, p_orch_id uuid, p_status text, p_trigger_type text) OWNER TO postgres;

--
-- TOC entry 5107 (class 0 OID 0)
-- Dependencies: 503
-- Name: FUNCTION fn_count_orchestrator_runs(p_project_id uuid, p_orch_id uuid, p_status text, p_trigger_type text); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_count_orchestrator_runs(p_project_id uuid, p_orch_id uuid, p_status text, p_trigger_type text) IS 'Returns total row count for orchestrator-run list with same filter set as fn_list_orchestrator_runs.';


--
-- TOC entry 385 (class 1255 OID 18563)
-- Name: fn_get_due_schedules(timestamp with time zone); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_due_schedules(p_as_of_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP) RETURNS TABLE(schedule_id uuid, entity_type_code text, entity_id uuid, env_id uuid, cron_expression_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT schedule_id, entity_type_code, entity_id, env_id, cron_expression_text
    FROM execution.schedules
    WHERE is_schedule_active = TRUE
      AND (next_run_dtm IS NULL OR next_run_dtm <= p_as_of_dtm);
$$;


ALTER FUNCTION execution.fn_get_due_schedules(p_as_of_dtm timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 5108 (class 0 OID 0)
-- Dependencies: 385
-- Name: FUNCTION fn_get_due_schedules(p_as_of_dtm timestamp with time zone); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_due_schedules(p_as_of_dtm timestamp with time zone) IS 'Returns all active schedules that are due to fire at or before the given timestamp. Used by the scheduler daemon polling loop.';


--
-- TOC entry 578 (class 1255 OID 32779)
-- Name: fn_get_entity_schedule(text, uuid); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_entity_schedule(p_entity_type_code text, p_entity_id uuid) RETURNS TABLE(schedule_id uuid, entity_type_code text, entity_id uuid, cron_expression_text text, timezone_name_text text, env_id uuid, is_schedule_active boolean, next_run_dtm timestamp with time zone, last_run_dtm timestamp with time zone, created_dtm timestamp with time zone, updated_dtm timestamp with time zone, created_by_user_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        s.schedule_id,
        s.entity_type_code,
        s.entity_id,
        s.cron_expression_text,
        s.timezone_name_text,
        s.env_id,
        s.is_schedule_active,
        s.next_run_dtm,
        s.last_run_dtm,
        s.created_dtm,
        s.updated_dtm,
        s.created_by_user_id
    FROM execution.schedules s
    WHERE s.entity_type_code = p_entity_type_code
      AND s.entity_id = p_entity_id
    ORDER BY s.updated_dtm DESC
    LIMIT 1;
$$;


ALTER FUNCTION execution.fn_get_entity_schedule(p_entity_type_code text, p_entity_id uuid) OWNER TO postgres;

--
-- TOC entry 5109 (class 0 OID 0)
-- Dependencies: 578
-- Name: FUNCTION fn_get_entity_schedule(p_entity_type_code text, p_entity_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_entity_schedule(p_entity_type_code text, p_entity_id uuid) IS 'Returns the most recently updated schedule for the given entity (PIPELINE or ORCHESTRATOR).';


--
-- TOC entry 404 (class 1255 OID 24581)
-- Name: fn_get_environment_id_by_name(text); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_environment_id_by_name(p_env_display_name text) RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
    SELECT e.env_id
    FROM execution.environments e
    WHERE lower(e.env_display_name) = lower(p_env_display_name)
    ORDER BY e.created_dtm DESC
    LIMIT 1;
$$;


ALTER FUNCTION execution.fn_get_environment_id_by_name(p_env_display_name text) OWNER TO postgres;

--
-- TOC entry 5110 (class 0 OID 0)
-- Dependencies: 404
-- Name: FUNCTION fn_get_environment_id_by_name(p_env_display_name text); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_environment_id_by_name(p_env_display_name text) IS 'Returns environment ID by display name, case-insensitive; NULL when not found.';


--
-- TOC entry 564 (class 1255 OID 32768)
-- Name: fn_get_environments(); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_environments() RETURNS TABLE(env_id uuid, env_display_name text, is_prod_env_flag boolean, created_dtm timestamp with time zone, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT env_id, env_display_name, is_prod_env_flag, created_dtm, updated_dtm
    FROM execution.environments
    ORDER BY is_prod_env_flag DESC, env_display_name;
$$;


ALTER FUNCTION execution.fn_get_environments() OWNER TO postgres;

--
-- TOC entry 5111 (class 0 OID 0)
-- Dependencies: 564
-- Name: FUNCTION fn_get_environments(); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_environments() IS 'Lists all registered deployment environments. Used by UI environment selector and run-targeting.';


--
-- TOC entry 561 (class 1255 OID 24672)
-- Name: fn_get_execution_kpis(date, date, uuid); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_execution_kpis(p_date_from date, p_date_to date, p_project_id uuid DEFAULT NULL::uuid) RETURNS TABLE(total_today bigint, running_now bigint, success_rate_today numeric, failed_today bigint, avg_duration_ms_today numeric, sla_breaches_today bigint, data_volume_gb_today numeric, active_pipelines bigint)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        COUNT(*)                                                                           AS total_today,
        COUNT(*) FILTER (WHERE pr.run_status_code = 'RUNNING')                            AS running_now,
        ROUND(
            COUNT(*) FILTER (WHERE pr.run_status_code = 'SUCCESS')::NUMERIC
            / NULLIF(COUNT(*), 0) * 100, 2
        )                                                                                  AS success_rate_today,
        COUNT(*) FILTER (WHERE pr.run_status_code = 'FAILED')                             AS failed_today,
        AVG(pr.run_duration_ms) FILTER (WHERE pr.run_status_code = 'SUCCESS')             AS avg_duration_ms_today,
        COUNT(*) FILTER (WHERE pr.sla_status_code = 'BREACHED')                           AS sla_breaches_today,
        ROUND(
            COALESCE(
                SUM(COALESCE(pr.bytes_read_num, 0) + COALESCE(pr.bytes_written_num, 0))::NUMERIC
                / 1e9, 0
            ), 4
        )                                                                                  AS data_volume_gb_today,
        (
            SELECT COUNT(*)
            FROM catalog.pipelines p2
            WHERE p2.active_version_id IS NOT NULL
              AND (p_project_id IS NULL OR p2.project_id = p_project_id)
        )                                                                                  AS active_pipelines
    FROM execution.pipeline_runs pr
    LEFT JOIN catalog.pipelines p ON p.pipeline_id = pr.pipeline_id
    WHERE DATE(COALESCE(pr.start_dtm, pr.created_dtm)) BETWEEN p_date_from AND p_date_to
      AND (p_project_id IS NULL OR p.project_id = p_project_id);
$$;


ALTER FUNCTION execution.fn_get_execution_kpis(p_date_from date, p_date_to date, p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5112 (class 0 OID 0)
-- Dependencies: 561
-- Name: FUNCTION fn_get_execution_kpis(p_date_from date, p_date_to date, p_project_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_execution_kpis(p_date_from date, p_date_to date, p_project_id uuid) IS 'Returns execution monitor KPI aggregates for a date range. p_project_id is optional; NULL returns platform-wide metrics.';


--
-- TOC entry 634 (class 1255 OID 18571)
-- Name: fn_get_generated_artifact_by_id(uuid); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_generated_artifact_by_id(p_artifact_id uuid) RETURNS TABLE(artifact_id uuid, pipeline_id uuid, pipeline_version_id uuid, technology_code text, spark_version_text text, generation_opts jsonb, metadata_json jsonb, files_json jsonb, warning_count integer, error_count integer, generated_by_user_id uuid, created_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT * FROM execution.generated_artifacts WHERE artifact_id = p_artifact_id;
$$;


ALTER FUNCTION execution.fn_get_generated_artifact_by_id(p_artifact_id uuid) OWNER TO postgres;

--
-- TOC entry 5113 (class 0 OID 0)
-- Dependencies: 634
-- Name: FUNCTION fn_get_generated_artifact_by_id(p_artifact_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_generated_artifact_by_id(p_artifact_id uuid) IS 'Returns full payload for a single code generation artifact.';


--
-- TOC entry 583 (class 1255 OID 18551)
-- Name: fn_get_orchestrator_pipeline_runs(uuid); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_orchestrator_pipeline_runs(p_orch_run_id uuid) RETURNS TABLE(pipeline_run_id uuid, dag_node_id_text text, execution_order_num integer, run_status_code text, pipeline_display_name text)
    LANGUAGE sql STABLE
    AS $$
    SELECT m.pipeline_run_id, m.dag_node_id_text, m.execution_order_num,
           pr.run_status_code, p.pipeline_display_name
    FROM execution.orchestrator_pipeline_run_map m
    JOIN execution.pipeline_runs pr ON m.pipeline_run_id = pr.pipeline_run_id
    JOIN catalog.pipelines p ON pr.pipeline_id = p.pipeline_id
    WHERE m.orch_run_id = p_orch_run_id
    ORDER BY m.execution_order_num;
$$;


ALTER FUNCTION execution.fn_get_orchestrator_pipeline_runs(p_orch_run_id uuid) OWNER TO postgres;

--
-- TOC entry 5114 (class 0 OID 0)
-- Dependencies: 583
-- Name: FUNCTION fn_get_orchestrator_pipeline_runs(p_orch_run_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_orchestrator_pipeline_runs(p_orch_run_id uuid) IS 'Returns all pipeline runs belonging to an orchestrator run, ordered by DAG execution sequence.';


--
-- TOC entry 456 (class 1255 OID 18550)
-- Name: fn_get_orchestrator_run_status(uuid); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_orchestrator_run_status(p_orch_run_id uuid) RETURNS TABLE(orch_run_id uuid, orch_display_name text, run_status_code text, start_dtm timestamp with time zone, end_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT r.orch_run_id, o.orch_display_name, r.run_status_code, r.start_dtm, r.end_dtm
    FROM execution.orchestrator_runs r
    JOIN catalog.orchestrators o ON r.orch_id = o.orch_id
    WHERE r.orch_run_id = p_orch_run_id;
$$;


ALTER FUNCTION execution.fn_get_orchestrator_run_status(p_orch_run_id uuid) OWNER TO postgres;

--
-- TOC entry 5115 (class 0 OID 0)
-- Dependencies: 456
-- Name: FUNCTION fn_get_orchestrator_run_status(p_orch_run_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_orchestrator_run_status(p_orch_run_id uuid) IS 'Returns aggregate status for an orchestrator run.';


--
-- TOC entry 594 (class 1255 OID 18549)
-- Name: fn_get_pipeline_node_runs(uuid); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_pipeline_node_runs(p_pipeline_run_id uuid) RETURNS TABLE(node_id_in_ir_text text, node_display_name text, node_status_code text, start_dtm timestamp with time zone, end_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT node_id_in_ir_text, node_display_name, node_status_code, start_dtm, end_dtm
    FROM execution.pipeline_node_runs
    WHERE pipeline_run_id = p_pipeline_run_id;
$$;


ALTER FUNCTION execution.fn_get_pipeline_node_runs(p_pipeline_run_id uuid) OWNER TO postgres;

--
-- TOC entry 5116 (class 0 OID 0)
-- Dependencies: 594
-- Name: FUNCTION fn_get_pipeline_node_runs(p_pipeline_run_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_pipeline_node_runs(p_pipeline_run_id uuid) IS 'Returns per-DAG-node execution status for live pipeline monitoring.';


--
-- TOC entry 469 (class 1255 OID 32778)
-- Name: fn_get_pipeline_run_history(uuid, integer); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_pipeline_run_history(p_pipeline_id uuid, p_limit integer DEFAULT 50) RETURNS TABLE(pipeline_run_id uuid, run_status_code text, trigger_type_code text, start_dtm timestamp with time zone, end_dtm timestamp with time zone, created_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT pipeline_run_id, run_status_code, trigger_type_code, start_dtm, end_dtm, created_dtm
    FROM execution.pipeline_runs
    WHERE pipeline_id = p_pipeline_id
    ORDER BY created_dtm DESC
    LIMIT p_limit;
$$;


ALTER FUNCTION execution.fn_get_pipeline_run_history(p_pipeline_id uuid, p_limit integer) OWNER TO postgres;

--
-- TOC entry 5117 (class 0 OID 0)
-- Dependencies: 469
-- Name: FUNCTION fn_get_pipeline_run_history(p_pipeline_id uuid, p_limit integer); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_pipeline_run_history(p_pipeline_id uuid, p_limit integer) IS 'Returns the most recent N execution runs for a pipeline in descending order.';


--
-- TOC entry 671 (class 1255 OID 18548)
-- Name: fn_get_pipeline_run_logs(uuid, text); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_pipeline_run_logs(p_pipeline_run_id uuid, p_level_code text DEFAULT NULL::text) RETURNS TABLE(log_level_code text, log_source_code text, log_message_text text, created_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT log_level_code, log_source_code, log_message_text, created_dtm
    FROM execution.pipeline_run_logs
    WHERE pipeline_run_id = p_pipeline_run_id
      AND (p_level_code IS NULL OR log_level_code = p_level_code)
    ORDER BY created_dtm;
$$;


ALTER FUNCTION execution.fn_get_pipeline_run_logs(p_pipeline_run_id uuid, p_level_code text) OWNER TO postgres;

--
-- TOC entry 5118 (class 0 OID 0)
-- Dependencies: 671
-- Name: FUNCTION fn_get_pipeline_run_logs(p_pipeline_run_id uuid, p_level_code text); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_pipeline_run_logs(p_pipeline_run_id uuid, p_level_code text) IS 'Returns ordered log lines for a pipeline run. Optional filter by severity level.';


--
-- TOC entry 606 (class 1255 OID 18546)
-- Name: fn_get_pipeline_run_status(uuid); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_pipeline_run_status(p_pipeline_run_id uuid) RETURNS TABLE(pipeline_run_id uuid, pipeline_display_name text, run_status_code text, triggered_by text, start_dtm timestamp with time zone, end_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT pr.pipeline_run_id, p.pipeline_display_name, pr.run_status_code,
           COALESCE(u.user_full_name, pr.trigger_type_code),
           pr.start_dtm, pr.end_dtm
    FROM execution.pipeline_runs pr
    JOIN catalog.pipelines p ON pr.pipeline_id = p.pipeline_id
    LEFT JOIN etl.users u ON pr.triggered_by_user_id = u.user_id
    WHERE pr.pipeline_run_id = p_pipeline_run_id;
$$;


ALTER FUNCTION execution.fn_get_pipeline_run_status(p_pipeline_run_id uuid) OWNER TO postgres;

--
-- TOC entry 5119 (class 0 OID 0)
-- Dependencies: 606
-- Name: FUNCTION fn_get_pipeline_run_status(p_pipeline_run_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_pipeline_run_status(p_pipeline_run_id uuid) IS 'Retrieves real-time status and timing for a pipeline execution run.';


--
-- TOC entry 413 (class 1255 OID 18567)
-- Name: fn_get_run_artifacts(uuid); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_run_artifacts(p_pipeline_run_id uuid) RETURNS TABLE(artifact_id uuid, artifact_type_code text, artifact_name_text text, storage_uri_text text, artifact_size_bytes bigint, created_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT artifact_id, artifact_type_code, artifact_name_text, storage_uri_text, artifact_size_bytes, created_dtm
    FROM execution.run_artifacts
    WHERE pipeline_run_id = p_pipeline_run_id
    ORDER BY created_dtm;
$$;


ALTER FUNCTION execution.fn_get_run_artifacts(p_pipeline_run_id uuid) OWNER TO postgres;

--
-- TOC entry 5120 (class 0 OID 0)
-- Dependencies: 413
-- Name: FUNCTION fn_get_run_artifacts(p_pipeline_run_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_run_artifacts(p_pipeline_run_id uuid) IS 'Returns all artifacts produced by a pipeline run in creation order.';


--
-- TOC entry 642 (class 1255 OID 18569)
-- Name: fn_get_run_lineage(uuid); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_run_lineage(p_pipeline_run_id uuid) RETURNS TABLE(run_lineage_id uuid, src_dataset_id uuid, src_column_name_text text, tgt_dataset_id uuid, tgt_column_name_text text, rows_read_num bigint, rows_written_num bigint, transformation_desc_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT run_lineage_id, src_dataset_id, src_column_name_text,
           tgt_dataset_id, tgt_column_name_text,
           rows_read_num, rows_written_num, transformation_desc_text
    FROM execution.run_lineage
    WHERE pipeline_run_id = p_pipeline_run_id
    ORDER BY created_dtm;
$$;


ALTER FUNCTION execution.fn_get_run_lineage(p_pipeline_run_id uuid) OWNER TO postgres;

--
-- TOC entry 5121 (class 0 OID 0)
-- Dependencies: 642
-- Name: FUNCTION fn_get_run_lineage(p_pipeline_run_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_run_lineage(p_pipeline_run_id uuid) IS 'Returns all runtime lineage edges observed during a specific pipeline run. Used in the run detail UI and post-run compliance reports.';


--
-- TOC entry 406 (class 1255 OID 18565)
-- Name: fn_get_run_parameters(uuid); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_run_parameters(p_pipeline_run_id uuid) RETURNS TABLE(param_key_name text, param_value_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT param_key_name, param_value_text
    FROM execution.run_parameters
    WHERE pipeline_run_id = p_pipeline_run_id
    ORDER BY param_key_name;
$$;


ALTER FUNCTION execution.fn_get_run_parameters(p_pipeline_run_id uuid) OWNER TO postgres;

--
-- TOC entry 5122 (class 0 OID 0)
-- Dependencies: 406
-- Name: FUNCTION fn_get_run_parameters(p_pipeline_run_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_run_parameters(p_pipeline_run_id uuid) IS 'Returns all parameter values used during a specific pipeline run. Used for run comparison and reproducibility.';


--
-- TOC entry 479 (class 1255 OID 18570)
-- Name: fn_get_runs_that_wrote_to_dataset(uuid, integer); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_get_runs_that_wrote_to_dataset(p_dataset_id uuid, p_limit integer DEFAULT 50) RETURNS TABLE(pipeline_run_id uuid, pipeline_display_name text, run_status_code text, rows_written_num bigint, end_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT DISTINCT ON (pr.pipeline_run_id)
        pr.pipeline_run_id, p.pipeline_display_name, pr.run_status_code,
        rl.rows_written_num, pr.end_dtm
    FROM execution.run_lineage rl
    JOIN execution.pipeline_runs pr ON rl.pipeline_run_id = pr.pipeline_run_id
    JOIN catalog.pipelines p ON pr.pipeline_id = p.pipeline_id
    WHERE rl.tgt_dataset_id = p_dataset_id
    ORDER BY pr.pipeline_run_id, pr.end_dtm DESC
    LIMIT p_limit;
$$;


ALTER FUNCTION execution.fn_get_runs_that_wrote_to_dataset(p_dataset_id uuid, p_limit integer) OWNER TO postgres;

--
-- TOC entry 5123 (class 0 OID 0)
-- Dependencies: 479
-- Name: FUNCTION fn_get_runs_that_wrote_to_dataset(p_dataset_id uuid, p_limit integer); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_get_runs_that_wrote_to_dataset(p_dataset_id uuid, p_limit integer) IS 'Returns the most recent pipeline runs that wrote data to a specific dataset. Enables dataset-level data freshness tracking and lineage investigation.';


--
-- TOC entry 496 (class 1255 OID 24679)
-- Name: fn_list_orchestrator_runs(uuid, uuid, text, text, integer, integer); Type: FUNCTION; Schema: execution; Owner: postgres
--

CREATE FUNCTION execution.fn_list_orchestrator_runs(p_project_id uuid DEFAULT NULL::uuid, p_orch_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_trigger_type text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(orch_run_id uuid, orchestrator_name text, orch_id uuid, project_id uuid, project_name text, run_status text, trigger_type text, start_dtm timestamp with time zone, end_dtm timestamp with time zone, duration_ms integer, error_message text, retry_count integer)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        orch.orch_run_id,
        o.orch_display_name                 AS orchestrator_name,
        orch.orch_id,
        o.project_id,
        proj.project_display_name           AS project_name,
        orch.run_status_code,
        orch.trigger_type_code,
        orch.start_dtm,
        orch.end_dtm,
        orch.run_duration_ms,
        orch.error_message_text,
        orch.retry_count_num
    FROM execution.orchestrator_runs orch
    LEFT JOIN catalog.orchestrators o ON o.orch_id    = orch.orch_id
    LEFT JOIN etl.projects proj       ON proj.project_id = o.project_id
    WHERE (p_project_id   IS NULL OR o.project_id         = p_project_id)
      AND (p_orch_id      IS NULL OR orch.orch_id          = p_orch_id)
      AND (p_status       IS NULL OR orch.run_status_code  = p_status)
      AND (p_trigger_type IS NULL OR orch.trigger_type_code = p_trigger_type)
    ORDER BY orch.start_dtm DESC NULLS LAST, orch.created_dtm DESC
    LIMIT  GREATEST(COALESCE(p_limit,  50), 1)
    OFFSET GREATEST(COALESCE(p_offset,  0), 0);
$$;


ALTER FUNCTION execution.fn_list_orchestrator_runs(p_project_id uuid, p_orch_id uuid, p_status text, p_trigger_type text, p_limit integer, p_offset integer) OWNER TO postgres;

--
-- TOC entry 5124 (class 0 OID 0)
-- Dependencies: 496
-- Name: FUNCTION fn_list_orchestrator_runs(p_project_id uuid, p_orch_id uuid, p_status text, p_trigger_type text, p_limit integer, p_offset integer); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON FUNCTION execution.fn_list_orchestrator_runs(p_project_id uuid, p_orch_id uuid, p_status text, p_trigger_type text, p_limit integer, p_offset integer) IS 'Paginated orchestrator-run list with optional project/orchestrator/status/trigger filters.';


--
-- TOC entry 392 (class 1255 OID 18556)
-- Name: pr_append_run_log(uuid, text, text, text); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_append_run_log(IN p_pipeline_run_id uuid, IN p_level_code text, IN p_source_code text, IN p_message_text text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO execution.pipeline_run_logs
        (pipeline_run_id, log_level_code, log_source_code, log_message_text)
    VALUES (p_pipeline_run_id, p_level_code, p_source_code, p_message_text);
END;
$$;


ALTER PROCEDURE execution.pr_append_run_log(IN p_pipeline_run_id uuid, IN p_level_code text, IN p_source_code text, IN p_message_text text) OWNER TO postgres;

--
-- TOC entry 5125 (class 0 OID 0)
-- Dependencies: 392
-- Name: PROCEDURE pr_append_run_log(IN p_pipeline_run_id uuid, IN p_level_code text, IN p_source_code text, IN p_message_text text); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_append_run_log(IN p_pipeline_run_id uuid, IN p_level_code text, IN p_source_code text, IN p_message_text text) IS 'Appends a single log line to the execution log for a pipeline run.';


--
-- TOC entry 368 (class 1255 OID 18572)
-- Name: pr_cleanup_generated_artifacts(uuid, integer); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_cleanup_generated_artifacts(IN p_pipeline_id uuid, IN p_keep_latest integer DEFAULT 5)
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM execution.generated_artifacts
    WHERE pipeline_id = p_pipeline_id
      AND artifact_id NOT IN (
        SELECT artifact_id FROM execution.generated_artifacts
        WHERE pipeline_id = p_pipeline_id
        ORDER BY created_dtm DESC
        LIMIT p_keep_latest
      );
END;
$$;


ALTER PROCEDURE execution.pr_cleanup_generated_artifacts(IN p_pipeline_id uuid, IN p_keep_latest integer) OWNER TO postgres;

--
-- TOC entry 5126 (class 0 OID 0)
-- Dependencies: 368
-- Name: PROCEDURE pr_cleanup_generated_artifacts(IN p_pipeline_id uuid, IN p_keep_latest integer); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_cleanup_generated_artifacts(IN p_pipeline_id uuid, IN p_keep_latest integer) IS 'Law 4: Purges old codegen snapshots, keeping only the most recent N.';


--
-- TOC entry 370 (class 1255 OID 18467)
-- Name: pr_create_environment(text, boolean, jsonb, text); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_create_environment(IN p_env_display_name text, IN p_is_prod_env_flag boolean, IN p_cluster_config_json jsonb, IN p_network_zone_code text, OUT p_env_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO execution.environments (env_display_name, is_prod_env_flag, cluster_config_json, network_zone_code)
    VALUES (p_env_display_name, p_is_prod_env_flag, p_cluster_config_json, p_network_zone_code)
    RETURNING env_id INTO p_env_id;
END;
$$;


ALTER PROCEDURE execution.pr_create_environment(IN p_env_display_name text, IN p_is_prod_env_flag boolean, IN p_cluster_config_json jsonb, IN p_network_zone_code text, OUT p_env_id uuid) OWNER TO postgres;

--
-- TOC entry 5127 (class 0 OID 0)
-- Dependencies: 370
-- Name: PROCEDURE pr_create_environment(IN p_env_display_name text, IN p_is_prod_env_flag boolean, IN p_cluster_config_json jsonb, IN p_network_zone_code text, OUT p_env_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_create_environment(IN p_env_display_name text, IN p_is_prod_env_flag boolean, IN p_cluster_config_json jsonb, IN p_network_zone_code text, OUT p_env_id uuid) IS 'Registers a new deployment environment (e.g., DEV, STAGING, PROD) with cluster configuration.';


--
-- TOC entry 509 (class 1255 OID 18561)
-- Name: pr_create_schedule(text, uuid, text, text, uuid, uuid); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_create_schedule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_cron_expression_text text, IN p_timezone_name_text text, IN p_env_id uuid, IN p_created_by_user_id uuid, OUT p_schedule_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO execution.schedules
        (entity_type_code, entity_id, cron_expression_text, timezone_name_text, env_id, created_by_user_id)
    VALUES (p_entity_type_code, p_entity_id, p_cron_expression_text, p_timezone_name_text, p_env_id, p_created_by_user_id)
    RETURNING schedule_id INTO p_schedule_id;
END;
$$;


ALTER PROCEDURE execution.pr_create_schedule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_cron_expression_text text, IN p_timezone_name_text text, IN p_env_id uuid, IN p_created_by_user_id uuid, OUT p_schedule_id uuid) OWNER TO postgres;

--
-- TOC entry 5128 (class 0 OID 0)
-- Dependencies: 509
-- Name: PROCEDURE pr_create_schedule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_cron_expression_text text, IN p_timezone_name_text text, IN p_env_id uuid, IN p_created_by_user_id uuid, OUT p_schedule_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_create_schedule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_cron_expression_text text, IN p_timezone_name_text text, IN p_env_id uuid, IN p_created_by_user_id uuid, OUT p_schedule_id uuid) IS 'Defines a new cron-based schedule for a pipeline or orchestrator.';


--
-- TOC entry 486 (class 1255 OID 32781)
-- Name: pr_delete_entity_schedule(text, uuid); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_delete_entity_schedule(IN p_entity_type_code text, IN p_entity_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM execution.schedules
    WHERE entity_type_code = p_entity_type_code
      AND entity_id = p_entity_id;
END;
$$;


ALTER PROCEDURE execution.pr_delete_entity_schedule(IN p_entity_type_code text, IN p_entity_id uuid) OWNER TO postgres;

--
-- TOC entry 5129 (class 0 OID 0)
-- Dependencies: 486
-- Name: PROCEDURE pr_delete_entity_schedule(IN p_entity_type_code text, IN p_entity_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_delete_entity_schedule(IN p_entity_type_code text, IN p_entity_id uuid) IS 'Physically deletes all schedules for the given entity.';


--
-- TOC entry 500 (class 1255 OID 18468)
-- Name: pr_delete_environment(uuid); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_delete_environment(IN p_env_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 4: Physical delete.
    DELETE FROM execution.environments WHERE env_id = p_env_id;
END;
$$;


ALTER PROCEDURE execution.pr_delete_environment(IN p_env_id uuid) OWNER TO postgres;

--
-- TOC entry 5130 (class 0 OID 0)
-- Dependencies: 500
-- Name: PROCEDURE pr_delete_environment(IN p_env_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_delete_environment(IN p_env_id uuid) IS 'Law 4: Physically removes an environment definition. Referenced job_runs are preserved.';


--
-- TOC entry 590 (class 1255 OID 18560)
-- Name: pr_finalize_orchestrator_run(uuid, text); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_finalize_orchestrator_run(IN p_orch_run_id uuid, IN p_final_status_code text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE execution.orchestrator_runs SET
        run_status_code = p_final_status_code,
        end_dtm = CURRENT_TIMESTAMP
    WHERE orch_run_id = p_orch_run_id;
END;
$$;


ALTER PROCEDURE execution.pr_finalize_orchestrator_run(IN p_orch_run_id uuid, IN p_final_status_code text) OWNER TO postgres;

--
-- TOC entry 5131 (class 0 OID 0)
-- Dependencies: 590
-- Name: PROCEDURE pr_finalize_orchestrator_run(IN p_orch_run_id uuid, IN p_final_status_code text); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_finalize_orchestrator_run(IN p_orch_run_id uuid, IN p_final_status_code text) IS 'Sets the terminal aggregate status (SUCCESS, PARTIAL_FAIL, FAILED, KILLED) for an orchestrator run.';


--
-- TOC entry 458 (class 1255 OID 18554)
-- Name: pr_finalize_pipeline_run(uuid, text); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_finalize_pipeline_run(IN p_pipeline_run_id uuid, IN p_final_status_code text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE execution.pipeline_runs SET
        run_status_code = p_final_status_code,
        end_dtm = CURRENT_TIMESTAMP
    WHERE pipeline_run_id = p_pipeline_run_id;
END;
$$;


ALTER PROCEDURE execution.pr_finalize_pipeline_run(IN p_pipeline_run_id uuid, IN p_final_status_code text) OWNER TO postgres;

--
-- TOC entry 5132 (class 0 OID 0)
-- Dependencies: 458
-- Name: PROCEDURE pr_finalize_pipeline_run(IN p_pipeline_run_id uuid, IN p_final_status_code text); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_finalize_pipeline_run(IN p_pipeline_run_id uuid, IN p_final_status_code text) IS 'Sets the terminal status (SUCCESS, FAILED, KILLED) and records end timestamp for a pipeline run.';


--
-- TOC entry 345 (class 1255 OID 18558)
-- Name: pr_initialize_orchestrator_run(uuid, uuid, uuid, text); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_initialize_orchestrator_run(IN p_orch_id uuid, IN p_env_id uuid, IN p_triggered_by_user_id uuid, OUT p_orch_run_id uuid, IN p_trigger_type_code text DEFAULT 'MANUAL'::text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO execution.orchestrator_runs
        (orch_id, env_id, triggered_by_user_id, trigger_type_code)
    VALUES (p_orch_id, p_env_id, p_triggered_by_user_id, p_trigger_type_code)
    RETURNING orch_run_id INTO p_orch_run_id;
END;
$$;


ALTER PROCEDURE execution.pr_initialize_orchestrator_run(IN p_orch_id uuid, IN p_env_id uuid, IN p_triggered_by_user_id uuid, OUT p_orch_run_id uuid, IN p_trigger_type_code text) OWNER TO postgres;

--
-- TOC entry 5133 (class 0 OID 0)
-- Dependencies: 345
-- Name: PROCEDURE pr_initialize_orchestrator_run(IN p_orch_id uuid, IN p_env_id uuid, IN p_triggered_by_user_id uuid, OUT p_orch_run_id uuid, IN p_trigger_type_code text); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_initialize_orchestrator_run(IN p_orch_id uuid, IN p_env_id uuid, IN p_triggered_by_user_id uuid, OUT p_orch_run_id uuid, IN p_trigger_type_code text) IS 'Creates an orchestrator run record in PENDING state. Returns orch_run_id.';


--
-- TOC entry 394 (class 1255 OID 18552)
-- Name: pr_initialize_pipeline_run(uuid, uuid, uuid, uuid, text); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_initialize_pipeline_run(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_env_id uuid, IN p_triggered_by_user_id uuid, OUT p_pipeline_run_id uuid, IN p_trigger_type_code text DEFAULT 'MANUAL'::text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO execution.pipeline_runs (
        pipeline_id, version_id, env_id, triggered_by_user_id, trigger_type_code
    )
    VALUES (p_pipeline_id, p_version_id, p_env_id, p_triggered_by_user_id, p_trigger_type_code)
    RETURNING pipeline_run_id INTO p_pipeline_run_id;
END;
$$;


ALTER PROCEDURE execution.pr_initialize_pipeline_run(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_env_id uuid, IN p_triggered_by_user_id uuid, OUT p_pipeline_run_id uuid, IN p_trigger_type_code text) OWNER TO postgres;

--
-- TOC entry 5134 (class 0 OID 0)
-- Dependencies: 394
-- Name: PROCEDURE pr_initialize_pipeline_run(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_env_id uuid, IN p_triggered_by_user_id uuid, OUT p_pipeline_run_id uuid, IN p_trigger_type_code text); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_initialize_pipeline_run(IN p_pipeline_id uuid, IN p_version_id uuid, IN p_env_id uuid, IN p_triggered_by_user_id uuid, OUT p_pipeline_run_id uuid, IN p_trigger_type_code text) IS 'Creates a pipeline run record in PENDING state. Returns the pipeline_run_id for the execution engine.';


--
-- TOC entry 610 (class 1255 OID 18566)
-- Name: pr_record_run_artifact(uuid, text, text, text, bigint); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_record_run_artifact(IN p_pipeline_run_id uuid, IN p_artifact_type_code text, IN p_artifact_name_text text, IN p_storage_uri_text text, IN p_artifact_size_bytes bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO execution.run_artifacts
        (pipeline_run_id, artifact_type_code, artifact_name_text, storage_uri_text, artifact_size_bytes)
    VALUES (p_pipeline_run_id, p_artifact_type_code, p_artifact_name_text, p_storage_uri_text, p_artifact_size_bytes);
END;
$$;


ALTER PROCEDURE execution.pr_record_run_artifact(IN p_pipeline_run_id uuid, IN p_artifact_type_code text, IN p_artifact_name_text text, IN p_storage_uri_text text, IN p_artifact_size_bytes bigint) OWNER TO postgres;

--
-- TOC entry 5135 (class 0 OID 0)
-- Dependencies: 610
-- Name: PROCEDURE pr_record_run_artifact(IN p_pipeline_run_id uuid, IN p_artifact_type_code text, IN p_artifact_name_text text, IN p_storage_uri_text text, IN p_artifact_size_bytes bigint); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_record_run_artifact(IN p_pipeline_run_id uuid, IN p_artifact_type_code text, IN p_artifact_name_text text, IN p_storage_uri_text text, IN p_artifact_size_bytes bigint) IS 'Registers a file artifact produced by a pipeline run (generated code, output data, profiling report).';


--
-- TOC entry 570 (class 1255 OID 18568)
-- Name: pr_record_run_lineage_edges(uuid, jsonb); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_record_run_lineage_edges(IN p_pipeline_run_id uuid, IN p_lineage_json jsonb)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_edge JSONB;
BEGIN
    FOR v_edge IN SELECT * FROM jsonb_array_elements(p_lineage_json)
    LOOP
        INSERT INTO execution.run_lineage (
            pipeline_run_id,
            src_dataset_id, src_column_name_text,
            tgt_dataset_id, tgt_column_name_text,
            rows_read_num, rows_written_num,
            transformation_desc_text
        ) VALUES (
            p_pipeline_run_id,
            NULLIF(v_edge->>'src_dataset_id', '')::UUID,
            v_edge->>'src_column_name_text',
            NULLIF(v_edge->>'tgt_dataset_id', '')::UUID,
            v_edge->>'tgt_column_name_text',
            (v_edge->>'rows_read_num')::BIGINT,
            (v_edge->>'rows_written_num')::BIGINT,
            v_edge->>'transformation_desc_text'
        );
    END LOOP;
END;
$$;


ALTER PROCEDURE execution.pr_record_run_lineage_edges(IN p_pipeline_run_id uuid, IN p_lineage_json jsonb) OWNER TO postgres;

--
-- TOC entry 5136 (class 0 OID 0)
-- Dependencies: 570
-- Name: PROCEDURE pr_record_run_lineage_edges(IN p_pipeline_run_id uuid, IN p_lineage_json jsonb); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_record_run_lineage_edges(IN p_pipeline_run_id uuid, IN p_lineage_json jsonb) IS 'Appends runtime column-level lineage edges for a pipeline run. Called by the execution engine after each sink node completes. Input: [{src_dataset_id, src_column_name_text, tgt_dataset_id, tgt_column_name_text, rows_read_num, rows_written_num, transformation_desc_text}].';


--
-- TOC entry 546 (class 1255 OID 18557)
-- Name: pr_record_run_metric(uuid, text, numeric); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_record_run_metric(IN p_pipeline_run_id uuid, IN p_metric_name_text text, IN p_metric_value_num numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO execution.pipeline_run_metrics
        (pipeline_run_id, metric_name_text, metric_value_num)
    VALUES (p_pipeline_run_id, p_metric_name_text, p_metric_value_num);
END;
$$;


ALTER PROCEDURE execution.pr_record_run_metric(IN p_pipeline_run_id uuid, IN p_metric_name_text text, IN p_metric_value_num numeric) OWNER TO postgres;

--
-- TOC entry 5137 (class 0 OID 0)
-- Dependencies: 546
-- Name: PROCEDURE pr_record_run_metric(IN p_pipeline_run_id uuid, IN p_metric_name_text text, IN p_metric_value_num numeric); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_record_run_metric(IN p_pipeline_run_id uuid, IN p_metric_name_text text, IN p_metric_value_num numeric) IS 'Records a single numeric telemetry data point for a pipeline run.';


--
-- TOC entry 425 (class 1255 OID 18564)
-- Name: pr_record_run_parameters(uuid, jsonb); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_record_run_parameters(IN p_pipeline_run_id uuid, IN p_params_json jsonb)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_param JSONB;
BEGIN
    FOR v_param IN SELECT * FROM jsonb_each(p_params_json)
    LOOP
        INSERT INTO execution.run_parameters (pipeline_run_id, param_key_name, param_value_text)
        VALUES (p_pipeline_run_id, v_param->>'key', v_param->>'value')
        ON CONFLICT (pipeline_run_id, param_key_name) DO NOTHING;
    END LOOP;
END;
$$;


ALTER PROCEDURE execution.pr_record_run_parameters(IN p_pipeline_run_id uuid, IN p_params_json jsonb) OWNER TO postgres;

--
-- TOC entry 5138 (class 0 OID 0)
-- Dependencies: 425
-- Name: PROCEDURE pr_record_run_parameters(IN p_pipeline_run_id uuid, IN p_params_json jsonb); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_record_run_parameters(IN p_pipeline_run_id uuid, IN p_params_json jsonb) IS 'Captures all parameter values used for a specific pipeline run. Called at run initialization for reproducibility tracking.';


--
-- TOC entry 565 (class 1255 OID 18559)
-- Name: pr_register_orchestrator_pipeline_run(uuid, uuid, text, integer); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_register_orchestrator_pipeline_run(IN p_orch_run_id uuid, IN p_pipeline_run_id uuid, IN p_dag_node_id_text text, IN p_execution_order_num integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO execution.orchestrator_pipeline_run_map
        (orch_run_id, pipeline_run_id, dag_node_id_text, execution_order_num)
    VALUES (p_orch_run_id, p_pipeline_run_id, p_dag_node_id_text, p_execution_order_num);
END;
$$;


ALTER PROCEDURE execution.pr_register_orchestrator_pipeline_run(IN p_orch_run_id uuid, IN p_pipeline_run_id uuid, IN p_dag_node_id_text text, IN p_execution_order_num integer) OWNER TO postgres;

--
-- TOC entry 5139 (class 0 OID 0)
-- Dependencies: 565
-- Name: PROCEDURE pr_register_orchestrator_pipeline_run(IN p_orch_run_id uuid, IN p_pipeline_run_id uuid, IN p_dag_node_id_text text, IN p_execution_order_num integer); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_register_orchestrator_pipeline_run(IN p_orch_run_id uuid, IN p_pipeline_run_id uuid, IN p_dag_node_id_text text, IN p_execution_order_num integer) IS 'Links a pipeline_run to its parent orchestrator_run with the DAG node ID and execution order.';


--
-- TOC entry 619 (class 1255 OID 24681)
-- Name: pr_retry_orchestrator_run(uuid, uuid); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_retry_orchestrator_run(IN p_original_run_id uuid, IN p_user_id uuid, OUT p_new_run_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_orch_id     UUID;
    v_retry_count INTEGER;
BEGIN
    SELECT orch_id, retry_count_num
    INTO v_orch_id, v_retry_count
    FROM execution.orchestrator_runs
    WHERE orch_run_id = p_original_run_id;

    IF v_orch_id IS NULL THEN
        RAISE EXCEPTION 'Orchestrator run not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO execution.orchestrator_runs
        (orch_id, run_status_code, trigger_type_code,
         triggered_by_user_id, retry_count_num)
    VALUES
        (v_orch_id, 'PENDING', 'MANUAL',
         p_user_id, COALESCE(v_retry_count, 0) + 1)
    RETURNING orch_run_id INTO p_new_run_id;
END;
$$;


ALTER PROCEDURE execution.pr_retry_orchestrator_run(IN p_original_run_id uuid, IN p_user_id uuid, OUT p_new_run_id uuid) OWNER TO postgres;

--
-- TOC entry 5140 (class 0 OID 0)
-- Dependencies: 619
-- Name: PROCEDURE pr_retry_orchestrator_run(IN p_original_run_id uuid, IN p_user_id uuid, OUT p_new_run_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_retry_orchestrator_run(IN p_original_run_id uuid, IN p_user_id uuid, OUT p_new_run_id uuid) IS 'Creates a new PENDING orchestrator run as a retry of the given original. Increments retry_count_num. Returns new run ID via OUT param.';


--
-- TOC entry 444 (class 1255 OID 24678)
-- Name: pr_retry_pipeline_run(uuid, uuid); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_retry_pipeline_run(IN p_original_run_id uuid, IN p_user_id uuid, OUT p_new_run_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_pipeline_id UUID;
    v_version_id  UUID;
    v_retry_count INTEGER;
BEGIN
    SELECT pipeline_id, version_id, retry_count_num
    INTO v_pipeline_id, v_version_id, v_retry_count
    FROM execution.pipeline_runs
    WHERE pipeline_run_id = p_original_run_id;

    IF v_pipeline_id IS NULL THEN
        RAISE EXCEPTION 'Pipeline run not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO execution.pipeline_runs
        (pipeline_id, version_id, run_status_code, trigger_type_code,
         triggered_by_user_id, retry_count_num)
    VALUES
        (v_pipeline_id, v_version_id, 'PENDING', 'MANUAL',
         p_user_id, COALESCE(v_retry_count, 0) + 1)
    RETURNING pipeline_run_id INTO p_new_run_id;
END;
$$;


ALTER PROCEDURE execution.pr_retry_pipeline_run(IN p_original_run_id uuid, IN p_user_id uuid, OUT p_new_run_id uuid) OWNER TO postgres;

--
-- TOC entry 5141 (class 0 OID 0)
-- Dependencies: 444
-- Name: PROCEDURE pr_retry_pipeline_run(IN p_original_run_id uuid, IN p_user_id uuid, OUT p_new_run_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_retry_pipeline_run(IN p_original_run_id uuid, IN p_user_id uuid, OUT p_new_run_id uuid) IS 'Creates a new PENDING pipeline run as a retry of the given original run. Increments retry_count_num. Returns the new run ID via OUT param.';


--
-- TOC entry 333 (class 1255 OID 32780)
-- Name: pr_set_entity_schedule(text, uuid, text, text, uuid, boolean, uuid); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_set_entity_schedule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_cron_expression_text text, IN p_timezone_name_text text, IN p_env_id uuid, IN p_is_schedule_active boolean, IN p_updated_by_user_id uuid, OUT p_schedule_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_existing_id UUID;
BEGIN
    SELECT s.schedule_id
      INTO v_existing_id
    FROM execution.schedules s
    WHERE s.entity_type_code = p_entity_type_code
      AND s.entity_id = p_entity_id
    ORDER BY s.updated_dtm DESC
    LIMIT 1;

    IF v_existing_id IS NULL THEN
        INSERT INTO execution.schedules
            (entity_type_code, entity_id, cron_expression_text, timezone_name_text, env_id, is_schedule_active, created_by_user_id)
        VALUES
            (p_entity_type_code, p_entity_id, p_cron_expression_text, COALESCE(p_timezone_name_text, 'UTC'), p_env_id, COALESCE(p_is_schedule_active, TRUE), p_updated_by_user_id)
        RETURNING schedule_id INTO p_schedule_id;
    ELSE
        UPDATE execution.schedules SET
            cron_expression_text = p_cron_expression_text,
            timezone_name_text = COALESCE(p_timezone_name_text, timezone_name_text),
            env_id = p_env_id,
            is_schedule_active = COALESCE(p_is_schedule_active, is_schedule_active),
            updated_dtm = CURRENT_TIMESTAMP
        WHERE schedule_id = v_existing_id
        RETURNING schedule_id INTO p_schedule_id;
    END IF;
END;
$$;


ALTER PROCEDURE execution.pr_set_entity_schedule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_cron_expression_text text, IN p_timezone_name_text text, IN p_env_id uuid, IN p_is_schedule_active boolean, IN p_updated_by_user_id uuid, OUT p_schedule_id uuid) OWNER TO postgres;

--
-- TOC entry 5142 (class 0 OID 0)
-- Dependencies: 333
-- Name: PROCEDURE pr_set_entity_schedule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_cron_expression_text text, IN p_timezone_name_text text, IN p_env_id uuid, IN p_is_schedule_active boolean, IN p_updated_by_user_id uuid, OUT p_schedule_id uuid); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_set_entity_schedule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_cron_expression_text text, IN p_timezone_name_text text, IN p_env_id uuid, IN p_is_schedule_active boolean, IN p_updated_by_user_id uuid, OUT p_schedule_id uuid) IS 'Creates or updates the latest schedule for an entity. Used by API-driven schedule saves.';


--
-- TOC entry 612 (class 1255 OID 24584)
-- Name: pr_set_orchestrator_run_options(uuid, jsonb); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_set_orchestrator_run_options(IN p_orch_run_id uuid, IN p_run_options_json jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE execution.orchestrator_runs
    SET run_options_json = p_run_options_json
    WHERE orch_run_id = p_orch_run_id;
END;
$$;


ALTER PROCEDURE execution.pr_set_orchestrator_run_options(IN p_orch_run_id uuid, IN p_run_options_json jsonb) OWNER TO postgres;

--
-- TOC entry 5143 (class 0 OID 0)
-- Dependencies: 612
-- Name: PROCEDURE pr_set_orchestrator_run_options(IN p_orch_run_id uuid, IN p_run_options_json jsonb); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_set_orchestrator_run_options(IN p_orch_run_id uuid, IN p_run_options_json jsonb) IS 'Stores the original trigger-time options payload for an orchestrator run.';


--
-- TOC entry 521 (class 1255 OID 24583)
-- Name: pr_set_pipeline_run_options(uuid, jsonb); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_set_pipeline_run_options(IN p_pipeline_run_id uuid, IN p_run_options_json jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE execution.pipeline_runs
    SET run_options_json = p_run_options_json
    WHERE pipeline_run_id = p_pipeline_run_id;
END;
$$;


ALTER PROCEDURE execution.pr_set_pipeline_run_options(IN p_pipeline_run_id uuid, IN p_run_options_json jsonb) OWNER TO postgres;

--
-- TOC entry 5144 (class 0 OID 0)
-- Dependencies: 521
-- Name: PROCEDURE pr_set_pipeline_run_options(IN p_pipeline_run_id uuid, IN p_run_options_json jsonb); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_set_pipeline_run_options(IN p_pipeline_run_id uuid, IN p_run_options_json jsonb) IS 'Stores the original trigger-time options payload for a pipeline run.';


--
-- TOC entry 493 (class 1255 OID 18553)
-- Name: pr_start_pipeline_run(uuid, text); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_start_pipeline_run(IN p_pipeline_run_id uuid, IN p_external_engine_job_id text DEFAULT NULL::text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE execution.pipeline_runs SET
        run_status_code = 'RUNNING',
        start_dtm = CURRENT_TIMESTAMP,
        external_engine_job_id = p_external_engine_job_id
    WHERE pipeline_run_id = p_pipeline_run_id AND run_status_code = 'PENDING';
END;
$$;


ALTER PROCEDURE execution.pr_start_pipeline_run(IN p_pipeline_run_id uuid, IN p_external_engine_job_id text) OWNER TO postgres;

--
-- TOC entry 5145 (class 0 OID 0)
-- Dependencies: 493
-- Name: PROCEDURE pr_start_pipeline_run(IN p_pipeline_run_id uuid, IN p_external_engine_job_id text); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_start_pipeline_run(IN p_pipeline_run_id uuid, IN p_external_engine_job_id text) IS 'Transitions a pipeline run from PENDING to RUNNING and records the Spark Application ID.';


--
-- TOC entry 457 (class 1255 OID 18555)
-- Name: pr_update_node_status(uuid, text, text, text, jsonb); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_update_node_status(IN p_pipeline_run_id uuid, IN p_node_id text, IN p_status_code text, IN p_node_display_name text DEFAULT NULL::text, IN p_node_metrics_json jsonb DEFAULT NULL::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO execution.pipeline_node_runs
        (pipeline_run_id, node_id_in_ir_text, node_display_name, node_status_code)
    VALUES (p_pipeline_run_id, p_node_id, p_node_display_name, p_status_code)
    ON CONFLICT (pipeline_run_id, node_id_in_ir_text) DO UPDATE SET
        node_status_code = EXCLUDED.node_status_code,
        start_dtm = CASE
            WHEN execution.pipeline_node_runs.start_dtm IS NULL AND EXCLUDED.node_status_code = 'RUNNING'
            THEN CURRENT_TIMESTAMP ELSE execution.pipeline_node_runs.start_dtm END,
        end_dtm = CASE
            WHEN EXCLUDED.node_status_code IN ('SUCCESS', 'FAILED', 'SKIPPED')
            THEN CURRENT_TIMESTAMP ELSE execution.pipeline_node_runs.end_dtm END,
        node_metrics_json = COALESCE(EXCLUDED.node_metrics_json, execution.pipeline_node_runs.node_metrics_json);
END;
$$;


ALTER PROCEDURE execution.pr_update_node_status(IN p_pipeline_run_id uuid, IN p_node_id text, IN p_status_code text, IN p_node_display_name text, IN p_node_metrics_json jsonb) OWNER TO postgres;

--
-- TOC entry 5146 (class 0 OID 0)
-- Dependencies: 457
-- Name: PROCEDURE pr_update_node_status(IN p_pipeline_run_id uuid, IN p_node_id text, IN p_status_code text, IN p_node_display_name text, IN p_node_metrics_json jsonb); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_update_node_status(IN p_pipeline_run_id uuid, IN p_node_id text, IN p_status_code text, IN p_node_display_name text, IN p_node_metrics_json jsonb) IS 'Upserts node execution status and metrics. Auto-timestamps start and end transitions.';


--
-- TOC entry 336 (class 1255 OID 18562)
-- Name: pr_update_schedule_next_run(uuid, timestamp with time zone, timestamp with time zone); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_update_schedule_next_run(IN p_schedule_id uuid, IN p_next_run_dtm timestamp with time zone, IN p_last_run_dtm timestamp with time zone DEFAULT NULL::timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE execution.schedules SET
        next_run_dtm = p_next_run_dtm,
        last_run_dtm = COALESCE(p_last_run_dtm, last_run_dtm)
    WHERE schedule_id = p_schedule_id;
END;
$$;


ALTER PROCEDURE execution.pr_update_schedule_next_run(IN p_schedule_id uuid, IN p_next_run_dtm timestamp with time zone, IN p_last_run_dtm timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 5147 (class 0 OID 0)
-- Dependencies: 336
-- Name: PROCEDURE pr_update_schedule_next_run(IN p_schedule_id uuid, IN p_next_run_dtm timestamp with time zone, IN p_last_run_dtm timestamp with time zone); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_update_schedule_next_run(IN p_schedule_id uuid, IN p_next_run_dtm timestamp with time zone, IN p_last_run_dtm timestamp with time zone) IS 'Updates the next and last run timestamps on a schedule. Called by the scheduler engine after each triggered execution.';


--
-- TOC entry 361 (class 1255 OID 24582)
-- Name: pr_upsert_run_parameter(uuid, text, text); Type: PROCEDURE; Schema: execution; Owner: postgres
--

CREATE PROCEDURE execution.pr_upsert_run_parameter(IN p_pipeline_run_id uuid, IN p_param_key_name text, IN p_param_value_text text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO execution.run_parameters (pipeline_run_id, param_key_name, param_value_text)
    VALUES (p_pipeline_run_id, p_param_key_name, p_param_value_text)
    ON CONFLICT (pipeline_run_id, param_key_name) DO UPDATE
    SET param_value_text = EXCLUDED.param_value_text;
END;
$$;


ALTER PROCEDURE execution.pr_upsert_run_parameter(IN p_pipeline_run_id uuid, IN p_param_key_name text, IN p_param_value_text text) OWNER TO postgres;

--
-- TOC entry 5148 (class 0 OID 0)
-- Dependencies: 361
-- Name: PROCEDURE pr_upsert_run_parameter(IN p_pipeline_run_id uuid, IN p_param_key_name text, IN p_param_value_text text); Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON PROCEDURE execution.pr_upsert_run_parameter(IN p_pipeline_run_id uuid, IN p_param_key_name text, IN p_param_value_text text) IS 'Upserts a run parameter value for a pipeline run.';


--
-- TOC entry 668 (class 1255 OID 18481)
-- Name: fn_can_user_access_connector(uuid, uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_can_user_access_connector(p_user_id uuid, p_connector_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM gov.connector_access ca
        WHERE ca.connector_id = p_connector_id
          AND (
              ca.user_id = p_user_id
              OR ca.role_id IN (
                  SELECT role_id FROM gov.user_roles WHERE user_id = p_user_id
                  UNION
                  SELECT pur.role_id FROM gov.project_user_roles pur
                  JOIN catalog.connectors c ON c.connector_id = p_connector_id
                  WHERE pur.user_id = p_user_id
              )
          )
    );
$$;


ALTER FUNCTION gov.fn_can_user_access_connector(p_user_id uuid, p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 5149 (class 0 OID 0)
-- Dependencies: 668
-- Name: FUNCTION fn_can_user_access_connector(p_user_id uuid, p_connector_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_can_user_access_connector(p_user_id uuid, p_connector_id uuid) IS 'Returns TRUE if the user has explicit access to a connector via user-level or role-level connector_access grants.';


--
-- TOC entry 622 (class 1255 OID 18471)
-- Name: fn_check_permission(uuid, text); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_check_permission(p_user_id uuid, p_perm_code_name text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM gov.fn_get_user_permissions(p_user_id) WHERE perm_code_name = p_perm_code_name
    );
$$;


ALTER FUNCTION gov.fn_check_permission(p_user_id uuid, p_perm_code_name text) OWNER TO postgres;

--
-- TOC entry 5150 (class 0 OID 0)
-- Dependencies: 622
-- Name: FUNCTION fn_check_permission(p_user_id uuid, p_perm_code_name text); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_check_permission(p_user_id uuid, p_perm_code_name text) IS 'Returns TRUE if the user holds the specified permission through any assigned role.';


--
-- TOC entry 459 (class 1255 OID 18484)
-- Name: fn_get_classified_assets(text); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_classified_assets(p_sensitivity_code text DEFAULT NULL::text) RETURNS TABLE(classification_id uuid, target_type_code text, target_id uuid, sensitivity_code text, classification_notes_text text, classified_by_full_name text, created_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT dc.classification_id, dc.target_type_code, dc.target_id, dc.sensitivity_code,
           dc.classification_notes_text, u.user_full_name AS classified_by_full_name, dc.created_dtm
    FROM gov.data_classifications dc
    LEFT JOIN etl.users u ON dc.classified_by_user_id = u.user_id
    WHERE p_sensitivity_code IS NULL OR dc.sensitivity_code = p_sensitivity_code
    ORDER BY dc.sensitivity_code, dc.target_type_code;
$$;


ALTER FUNCTION gov.fn_get_classified_assets(p_sensitivity_code text) OWNER TO postgres;

--
-- TOC entry 5151 (class 0 OID 0)
-- Dependencies: 459
-- Name: FUNCTION fn_get_classified_assets(p_sensitivity_code text); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_classified_assets(p_sensitivity_code text) IS 'Lists all data classifications, optionally filtered by sensitivity tier. Used by compliance reporting and data catalogue UIs.';


--
-- TOC entry 554 (class 1255 OID 24601)
-- Name: fn_get_connector_access_grants(uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_connector_access_grants(p_connector_id uuid) RETURNS TABLE(access_id uuid, user_id uuid, role_id uuid, user_full_name text, email_address text, role_display_name text, granted_dtm timestamp with time zone, granted_by_user_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        ca.access_id,
        ca.user_id,
        ca.role_id,
        u.user_full_name,
        u.email_address,
        r.role_display_name,
        ca.granted_dtm,
        ca.granted_by_user_id
    FROM gov.connector_access ca
    LEFT JOIN etl.users u ON u.user_id = ca.user_id
    LEFT JOIN gov.roles r ON r.role_id = ca.role_id
    WHERE ca.connector_id = p_connector_id
    ORDER BY ca.granted_dtm DESC;
$$;


ALTER FUNCTION gov.fn_get_connector_access_grants(p_connector_id uuid) OWNER TO postgres;

--
-- TOC entry 5152 (class 0 OID 0)
-- Dependencies: 554
-- Name: FUNCTION fn_get_connector_access_grants(p_connector_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_connector_access_grants(p_connector_id uuid) IS 'Lists connector-access grants with resolved user/role labels.';


--
-- TOC entry 354 (class 1255 OID 18574)
-- Name: fn_get_dq_rules(uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_dq_rules(p_target_id uuid) RETURNS TABLE(rule_id uuid, rule_type_code text, severity_code text, is_active_flag boolean)
    LANGUAGE sql STABLE
    AS $$
    SELECT rule_id, rule_type_code, severity_code, is_active_flag
    FROM gov.dq_rules WHERE target_id = p_target_id;
$$;


ALTER FUNCTION gov.fn_get_dq_rules(p_target_id uuid) OWNER TO postgres;

--
-- TOC entry 5153 (class 0 OID 0)
-- Dependencies: 354
-- Name: FUNCTION fn_get_dq_rules(p_target_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_dq_rules(p_target_id uuid) IS 'Returns all DQ rules associated with a specific dataset or column.';


--
-- TOC entry 471 (class 1255 OID 18573)
-- Name: fn_get_glossary_terms(text); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_glossary_terms(p_approval_status_code text DEFAULT NULL::text) RETURNS TABLE(term_id uuid, term_display_name text, approval_status_code text, owner_user_full_name text)
    LANGUAGE sql STABLE
    AS $$
    SELECT g.term_id, g.term_display_name, g.approval_status_code, u.user_full_name
    FROM gov.glossary_terms g
    LEFT JOIN etl.users u ON g.owner_user_id = u.user_id
    WHERE (p_approval_status_code IS NULL OR g.approval_status_code = p_approval_status_code)
    ORDER BY g.term_display_name;
$$;


ALTER FUNCTION gov.fn_get_glossary_terms(p_approval_status_code text) OWNER TO postgres;

--
-- TOC entry 5154 (class 0 OID 0)
-- Dependencies: 471
-- Name: FUNCTION fn_get_glossary_terms(p_approval_status_code text); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_glossary_terms(p_approval_status_code text) IS 'Lists business glossary terms, optionally filtered by approval status.';


--
-- TOC entry 421 (class 1255 OID 32769)
-- Name: fn_get_notification_rules_for_entity(text, uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_notification_rules_for_entity(p_entity_type_code text, p_entity_id uuid) RETURNS TABLE(notification_rule_id uuid, entity_type_code text, entity_id uuid, event_type_code text, channel_type_code text, channel_target_text text, is_rule_active_flag boolean, created_dtm timestamp with time zone, created_by_user_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        notification_rule_id,
        entity_type_code,
        entity_id,
        event_type_code,
        channel_type_code,
        channel_target_text,
        is_rule_active_flag,
        created_dtm,
        created_by_user_id
    FROM gov.notification_rules
    WHERE entity_type_code = p_entity_type_code
      AND entity_id = p_entity_id
    ORDER BY created_dtm DESC;
$$;


ALTER FUNCTION gov.fn_get_notification_rules_for_entity(p_entity_type_code text, p_entity_id uuid) OWNER TO postgres;

--
-- TOC entry 5155 (class 0 OID 0)
-- Dependencies: 421
-- Name: FUNCTION fn_get_notification_rules_for_entity(p_entity_type_code text, p_entity_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_notification_rules_for_entity(p_entity_type_code text, p_entity_id uuid) IS 'Lists all notification rules (active and inactive) for a specific entity. Used by the UI configuration screens.';


--
-- TOC entry 377 (class 1255 OID 18486)
-- Name: fn_get_notification_rules_for_event(uuid, text); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_notification_rules_for_event(p_entity_id uuid, p_event_type_code text) RETURNS TABLE(notification_rule_id uuid, channel_type_code text, channel_target_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT notification_rule_id, channel_type_code, channel_target_text
    FROM gov.notification_rules
    WHERE entity_id = p_entity_id
      AND event_type_code = p_event_type_code
      AND is_rule_active_flag = TRUE;
$$;


ALTER FUNCTION gov.fn_get_notification_rules_for_event(p_entity_id uuid, p_event_type_code text) OWNER TO postgres;

--
-- TOC entry 5156 (class 0 OID 0)
-- Dependencies: 377
-- Name: FUNCTION fn_get_notification_rules_for_event(p_entity_id uuid, p_event_type_code text); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_notification_rules_for_event(p_entity_id uuid, p_event_type_code text) IS 'Returns all active alert routing targets for a specific entity and event type. Called by the notification dispatcher after a run completes.';


--
-- TOC entry 637 (class 1255 OID 24606)
-- Name: fn_get_permissions(); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_permissions() RETURNS TABLE(permission_id uuid, perm_code_name text, perm_display_name text, perm_desc_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        p.permission_id,
        p.perm_code_name,
        p.perm_display_name,
        p.perm_desc_text
    FROM gov.permissions p
    ORDER BY p.perm_code_name;
$$;


ALTER FUNCTION gov.fn_get_permissions() OWNER TO postgres;

--
-- TOC entry 5157 (class 0 OID 0)
-- Dependencies: 637
-- Name: FUNCTION fn_get_permissions(); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_permissions() IS 'Returns the full permission catalog for governance-management surfaces.';


--
-- TOC entry 545 (class 1255 OID 24607)
-- Name: fn_get_project_user_role_grants(uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_project_user_role_grants(p_project_id uuid) RETURNS TABLE(project_id uuid, user_id uuid, user_full_name text, email_address text, role_id uuid, role_display_name text, granted_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        pur.project_id,
        pur.user_id,
        u.user_full_name,
        u.email_address,
        pur.role_id,
        r.role_display_name,
        pur.granted_dtm
    FROM gov.project_user_roles pur
    JOIN etl.users u ON u.user_id = pur.user_id
    JOIN gov.roles r ON r.role_id = pur.role_id
    WHERE pur.project_id = p_project_id
    ORDER BY u.user_full_name, r.role_display_name;
$$;


ALTER FUNCTION gov.fn_get_project_user_role_grants(p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5158 (class 0 OID 0)
-- Dependencies: 545
-- Name: FUNCTION fn_get_project_user_role_grants(p_project_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_project_user_role_grants(p_project_id uuid) IS 'Returns project-scoped role grants with user and role labels.';


--
-- TOC entry 411 (class 1255 OID 18478)
-- Name: fn_get_project_user_roles(uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_project_user_roles(p_project_id uuid) RETURNS TABLE(user_id uuid, user_full_name text, email_address text, role_display_name text, granted_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT pur.user_id, u.user_full_name, u.email_address, r.role_display_name, pur.granted_dtm
    FROM gov.project_user_roles pur
    JOIN etl.users u ON pur.user_id = u.user_id
    JOIN gov.roles r ON pur.role_id = r.role_id
    WHERE pur.project_id = p_project_id
    ORDER BY u.user_full_name;
$$;


ALTER FUNCTION gov.fn_get_project_user_roles(p_project_id uuid) OWNER TO postgres;

--
-- TOC entry 5159 (class 0 OID 0)
-- Dependencies: 411
-- Name: FUNCTION fn_get_project_user_roles(p_project_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_project_user_roles(p_project_id uuid) IS 'Returns all project-scoped role assignments for a project, including user and role names.';


--
-- TOC entry 433 (class 1255 OID 24603)
-- Name: fn_get_role_detail(uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_role_detail(p_role_id uuid) RETURNS TABLE(role_id uuid, role_display_name text, role_desc_text text, is_system_role_flag boolean, created_dtm timestamp with time zone, member_count bigint)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        r.role_id,
        r.role_display_name,
        r.role_desc_text,
        r.is_system_role_flag,
        r.created_dtm,
        COUNT(ur.user_id) AS member_count
    FROM gov.roles r
    LEFT JOIN gov.user_roles ur ON ur.role_id = r.role_id
    WHERE r.role_id = p_role_id
    GROUP BY r.role_id;
$$;


ALTER FUNCTION gov.fn_get_role_detail(p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5160 (class 0 OID 0)
-- Dependencies: 433
-- Name: FUNCTION fn_get_role_detail(p_role_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_role_detail(p_role_id uuid) IS 'Returns role profile and current member count.';


--
-- TOC entry 412 (class 1255 OID 24604)
-- Name: fn_get_role_members(uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_role_members(p_role_id uuid) RETURNS TABLE(user_id uuid, user_full_name text, email_address text, is_account_active boolean, granted_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        u.user_id,
        u.user_full_name,
        u.email_address,
        u.is_account_active,
        NULL::TIMESTAMPTZ AS granted_dtm
    FROM gov.user_roles ur
    JOIN etl.users u ON u.user_id = ur.user_id
    WHERE ur.role_id = p_role_id
    ORDER BY u.user_full_name;
$$;


ALTER FUNCTION gov.fn_get_role_members(p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5161 (class 0 OID 0)
-- Dependencies: 412
-- Name: FUNCTION fn_get_role_members(p_role_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_role_members(p_role_id uuid) IS 'Returns users currently assigned to the role.';


--
-- TOC entry 499 (class 1255 OID 24605)
-- Name: fn_get_role_permission_map(uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_role_permission_map(p_role_id uuid) RETURNS TABLE(permission_id uuid, perm_code_name text, perm_display_name text, perm_desc_text text, is_assigned boolean)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        p.permission_id,
        p.perm_code_name,
        p.perm_display_name,
        p.perm_desc_text,
        (rp.role_id IS NOT NULL) AS is_assigned
    FROM gov.permissions p
    LEFT JOIN gov.role_permissions rp
      ON rp.permission_id = p.permission_id
     AND rp.role_id = p_role_id
    ORDER BY p.perm_code_name;
$$;


ALTER FUNCTION gov.fn_get_role_permission_map(p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5162 (class 0 OID 0)
-- Dependencies: 499
-- Name: FUNCTION fn_get_role_permission_map(p_role_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_role_permission_map(p_role_id uuid) IS 'Returns full permission catalog with assignment flag for a specific role.';


--
-- TOC entry 648 (class 1255 OID 18472)
-- Name: fn_get_roles(); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_roles() RETURNS TABLE(role_id uuid, role_display_name text, role_desc_text text, is_system_role_flag boolean)
    LANGUAGE sql STABLE
    AS $$
    SELECT role_id, role_display_name, role_desc_text, is_system_role_flag FROM gov.roles ORDER BY role_display_name;
$$;


ALTER FUNCTION gov.fn_get_roles() OWNER TO postgres;

--
-- TOC entry 5163 (class 0 OID 0)
-- Dependencies: 648
-- Name: FUNCTION fn_get_roles(); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_roles() IS 'Lists all roles defined in the platform for administrative display.';


--
-- TOC entry 600 (class 1255 OID 18488)
-- Name: fn_get_secret(text); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_secret(p_key text) RETURNS text
    LANGUAGE sql STABLE
    AS $$
    SELECT pgp_sym_decrypt(secret_value_encrypted::BYTEA, current_setting('app.encryption_key'))
    FROM gov.secrets WHERE secret_key_name = p_key;
$$;


ALTER FUNCTION gov.fn_get_secret(p_key text) OWNER TO postgres;

--
-- TOC entry 5164 (class 0 OID 0)
-- Dependencies: 600
-- Name: FUNCTION fn_get_secret(p_key text); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_secret(p_key text) IS 'Law 3: Decrypts and returns a secret value. Key must be set via SET app.encryption_key = ...;';


--
-- TOC entry 342 (class 1255 OID 24592)
-- Name: fn_get_user_detail(uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_user_detail(p_user_id uuid) RETURNS TABLE(user_id uuid, email_address text, user_full_name text, is_account_active boolean, created_dtm timestamp with time zone, last_login_dtm timestamp with time zone, roles_json jsonb)
    LANGUAGE sql STABLE
    AS $$
  SELECT
    u.user_id,
    u.email_address,
    u.user_full_name,
    u.is_account_active,
    u.created_dtm,
    u.last_login_dtm,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object('roleId', r.role_id, 'roleName', r.role_display_name))
      FILTER (WHERE r.role_id IS NOT NULL),
      '[]'::jsonb
    ) AS roles_json
  FROM etl.users u
  LEFT JOIN gov.user_roles ur ON ur.user_id = u.user_id
  LEFT JOIN gov.roles r ON r.role_id = ur.role_id
  WHERE u.user_id = p_user_id
  GROUP BY u.user_id, u.email_address, u.user_full_name, u.is_account_active, u.created_dtm, u.last_login_dtm;
$$;


ALTER FUNCTION gov.fn_get_user_detail(p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5165 (class 0 OID 0)
-- Dependencies: 342
-- Name: FUNCTION fn_get_user_detail(p_user_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_user_detail(p_user_id uuid) IS 'Returns one user profile with role objects for governance/user workspace.';


--
-- TOC entry 462 (class 1255 OID 18470)
-- Name: fn_get_user_permissions(uuid); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_user_permissions(p_user_id uuid) RETURNS TABLE(perm_code_name text, perm_display_name text)
    LANGUAGE sql STABLE
    AS $$
    SELECT DISTINCT p.perm_code_name, p.perm_display_name
    FROM gov.user_roles ur
    JOIN gov.role_permissions rp ON ur.role_id = rp.role_id
    JOIN gov.permissions p ON rp.permission_id = p.permission_id
    WHERE ur.user_id = p_user_id;
$$;


ALTER FUNCTION gov.fn_get_user_permissions(p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5166 (class 0 OID 0)
-- Dependencies: 462
-- Name: FUNCTION fn_get_user_permissions(p_user_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_user_permissions(p_user_id uuid) IS 'Returns all effective permissions for a user via their role assignments.';


--
-- TOC entry 566 (class 1255 OID 24658)
-- Name: fn_get_users(); Type: FUNCTION; Schema: gov; Owner: postgres
--

CREATE FUNCTION gov.fn_get_users() RETURNS TABLE(user_id uuid, email_address text, user_full_name text, is_account_active boolean, created_dtm timestamp with time zone, last_login_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT user_id, email_address, user_full_name, is_account_active, created_dtm, last_login_dtm
    FROM etl.users
    ORDER BY user_full_name;
$$;


ALTER FUNCTION gov.fn_get_users() OWNER TO postgres;

--
-- TOC entry 5167 (class 0 OID 0)
-- Dependencies: 566
-- Name: FUNCTION fn_get_users(); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON FUNCTION gov.fn_get_users() IS 'Lists all users for the governance user management screen. No password hashes returned.';


--
-- TOC entry 519 (class 1255 OID 18576)
-- Name: pr_approve_glossary_term(uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_approve_glossary_term(IN p_term_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE gov.glossary_terms SET approval_status_code = 'APPROVED', updated_dtm = CURRENT_TIMESTAMP
    WHERE term_id = p_term_id;
END;
$$;


ALTER PROCEDURE gov.pr_approve_glossary_term(IN p_term_id uuid) OWNER TO postgres;

--
-- TOC entry 5168 (class 0 OID 0)
-- Dependencies: 519
-- Name: PROCEDURE pr_approve_glossary_term(IN p_term_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_approve_glossary_term(IN p_term_id uuid) IS 'Elevates a glossary term from DRAFT or IN_REVIEW to APPROVED status.';


--
-- TOC entry 350 (class 1255 OID 18475)
-- Name: pr_assign_user_role(uuid, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_assign_user_role(IN p_user_id uuid, IN p_role_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.user_roles (user_id, role_id) VALUES (p_user_id, p_role_id)
    ON CONFLICT DO NOTHING;
END;
$$;


ALTER PROCEDURE gov.pr_assign_user_role(IN p_user_id uuid, IN p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5169 (class 0 OID 0)
-- Dependencies: 350
-- Name: PROCEDURE pr_assign_user_role(IN p_user_id uuid, IN p_role_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_assign_user_role(IN p_user_id uuid, IN p_role_id uuid) IS 'Assigns a role to a user. Idempotent — duplicate assignment is silently ignored.';


--
-- TOC entry 531 (class 1255 OID 18483)
-- Name: pr_classify_asset(text, uuid, text, text, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_classify_asset(IN p_target_type_code text, IN p_target_id uuid, IN p_sensitivity_code text, IN p_notes text, IN p_classified_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.data_classifications
        (target_type_code, target_id, sensitivity_code, classification_notes_text, classified_by_user_id)
    VALUES (p_target_type_code, p_target_id, p_sensitivity_code, p_notes, p_classified_by_user_id)
    ON CONFLICT (target_type_code, target_id) DO UPDATE SET
        sensitivity_code          = EXCLUDED.sensitivity_code,
        classification_notes_text = EXCLUDED.classification_notes_text,
        classified_by_user_id     = EXCLUDED.classified_by_user_id,
        updated_dtm               = CURRENT_TIMESTAMP;
END;
$$;


ALTER PROCEDURE gov.pr_classify_asset(IN p_target_type_code text, IN p_target_id uuid, IN p_sensitivity_code text, IN p_notes text, IN p_classified_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5170 (class 0 OID 0)
-- Dependencies: 531
-- Name: PROCEDURE pr_classify_asset(IN p_target_type_code text, IN p_target_id uuid, IN p_sensitivity_code text, IN p_notes text, IN p_classified_by_user_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_classify_asset(IN p_target_type_code text, IN p_target_id uuid, IN p_sensitivity_code text, IN p_notes text, IN p_classified_by_user_id uuid) IS 'Upserts a sensitivity classification on a dataset or column. Replaces the prior classification if one already exists.';


--
-- TOC entry 504 (class 1255 OID 18575)
-- Name: pr_create_glossary_term(text, text, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_create_glossary_term(IN p_term_display_name text, IN p_term_def_text text, IN p_owner_user_id uuid, OUT p_term_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.glossary_terms (term_display_name, term_def_text, owner_user_id)
    VALUES (p_term_display_name, p_term_def_text, p_owner_user_id)
    RETURNING term_id INTO p_term_id;
END;
$$;


ALTER PROCEDURE gov.pr_create_glossary_term(IN p_term_display_name text, IN p_term_def_text text, IN p_owner_user_id uuid, OUT p_term_id uuid) OWNER TO postgres;

--
-- TOC entry 5171 (class 0 OID 0)
-- Dependencies: 504
-- Name: PROCEDURE pr_create_glossary_term(IN p_term_display_name text, IN p_term_def_text text, IN p_owner_user_id uuid, OUT p_term_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_create_glossary_term(IN p_term_display_name text, IN p_term_def_text text, IN p_owner_user_id uuid, OUT p_term_id uuid) IS 'Adds a new term to the enterprise business glossary in DRAFT status.';


--
-- TOC entry 558 (class 1255 OID 18485)
-- Name: pr_create_notification_rule(text, uuid, text, text, text, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_create_notification_rule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_event_type_code text, IN p_channel_type_code text, IN p_channel_target_text text, IN p_created_by_user_id uuid, OUT p_notification_rule_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.notification_rules
        (entity_type_code, entity_id, event_type_code, channel_type_code, channel_target_text, created_by_user_id)
    VALUES (p_entity_type_code, p_entity_id, p_event_type_code, p_channel_type_code, p_channel_target_text, p_created_by_user_id)
    RETURNING notification_rule_id INTO p_notification_rule_id;
END;
$$;


ALTER PROCEDURE gov.pr_create_notification_rule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_event_type_code text, IN p_channel_type_code text, IN p_channel_target_text text, IN p_created_by_user_id uuid, OUT p_notification_rule_id uuid) OWNER TO postgres;

--
-- TOC entry 5172 (class 0 OID 0)
-- Dependencies: 558
-- Name: PROCEDURE pr_create_notification_rule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_event_type_code text, IN p_channel_type_code text, IN p_channel_target_text text, IN p_created_by_user_id uuid, OUT p_notification_rule_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_create_notification_rule(IN p_entity_type_code text, IN p_entity_id uuid, IN p_event_type_code text, IN p_channel_type_code text, IN p_channel_target_text text, IN p_created_by_user_id uuid, OUT p_notification_rule_id uuid) IS 'Creates an alert routing rule for a given entity event. Returns the new rule ID.';


--
-- TOC entry 498 (class 1255 OID 18473)
-- Name: pr_create_role(text, text); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_create_role(IN p_role_display_name text, IN p_role_desc_text text, OUT p_role_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.roles (role_display_name, role_desc_text)
    VALUES (p_role_display_name, p_role_desc_text)
    RETURNING role_id INTO p_role_id;
END;
$$;


ALTER PROCEDURE gov.pr_create_role(IN p_role_display_name text, IN p_role_desc_text text, OUT p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5173 (class 0 OID 0)
-- Dependencies: 498
-- Name: PROCEDURE pr_create_role(IN p_role_display_name text, IN p_role_desc_text text, OUT p_role_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_create_role(IN p_role_display_name text, IN p_role_desc_text text, OUT p_role_id uuid) IS 'Creates a new custom role. Returns the generated role_id.';


--
-- TOC entry 517 (class 1255 OID 18577)
-- Name: pr_delete_glossary_term(uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_delete_glossary_term(IN p_term_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 4: Physical delete. History trigger captures row before removal.
    DELETE FROM gov.glossary_terms WHERE term_id = p_term_id;
END;
$$;


ALTER PROCEDURE gov.pr_delete_glossary_term(IN p_term_id uuid) OWNER TO postgres;

--
-- TOC entry 5174 (class 0 OID 0)
-- Dependencies: 517
-- Name: PROCEDURE pr_delete_glossary_term(IN p_term_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_delete_glossary_term(IN p_term_id uuid) IS 'Law 4: Physically removes a glossary term. History trigger preserves the record in history.glossary_terms_history.';


--
-- TOC entry 601 (class 1255 OID 32771)
-- Name: pr_delete_notification_rule(uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_delete_notification_rule(IN p_notification_rule_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 4: Physical delete. History trigger captures row before removal.
    DELETE FROM gov.notification_rules
    WHERE notification_rule_id = p_notification_rule_id;
END;
$$;


ALTER PROCEDURE gov.pr_delete_notification_rule(IN p_notification_rule_id uuid) OWNER TO postgres;

--
-- TOC entry 5175 (class 0 OID 0)
-- Dependencies: 601
-- Name: PROCEDURE pr_delete_notification_rule(IN p_notification_rule_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_delete_notification_rule(IN p_notification_rule_id uuid) IS 'Law 4: Physically deletes a notification rule. History trigger preserves the prior row image in history.notification_rules_history.';


--
-- TOC entry 620 (class 1255 OID 18474)
-- Name: pr_delete_role(uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_delete_role(IN p_role_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Law 4: Physical delete. History captured by trigger.
    DELETE FROM gov.roles WHERE role_id = p_role_id AND is_system_role_flag = FALSE;
END;
$$;


ALTER PROCEDURE gov.pr_delete_role(IN p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5176 (class 0 OID 0)
-- Dependencies: 620
-- Name: PROCEDURE pr_delete_role(IN p_role_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_delete_role(IN p_role_id uuid) IS 'Physically deletes a non-system role. Protected against built-in role removal.';


--
-- TOC entry 608 (class 1255 OID 18482)
-- Name: pr_grant_connector_access(uuid, uuid, uuid, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_grant_connector_access(IN p_connector_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.connector_access (connector_id, user_id, role_id, granted_by_user_id)
    VALUES (p_connector_id, p_user_id, p_role_id, p_granted_by_user_id);
END;
$$;


ALTER PROCEDURE gov.pr_grant_connector_access(IN p_connector_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5177 (class 0 OID 0)
-- Dependencies: 608
-- Name: PROCEDURE pr_grant_connector_access(IN p_connector_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_grant_connector_access(IN p_connector_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid) IS 'Grants connector access to a user or role. At least one of p_user_id or p_role_id must be non-NULL.';


--
-- TOC entry 587 (class 1255 OID 18477)
-- Name: pr_grant_permission_to_role(uuid, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_grant_permission_to_role(IN p_role_id uuid, IN p_permission_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.role_permissions (role_id, permission_id) VALUES (p_role_id, p_permission_id)
    ON CONFLICT DO NOTHING;
END;
$$;


ALTER PROCEDURE gov.pr_grant_permission_to_role(IN p_role_id uuid, IN p_permission_id uuid) OWNER TO postgres;

--
-- TOC entry 5178 (class 0 OID 0)
-- Dependencies: 587
-- Name: PROCEDURE pr_grant_permission_to_role(IN p_role_id uuid, IN p_permission_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_grant_permission_to_role(IN p_role_id uuid, IN p_permission_id uuid) IS 'Grants a specific permission to a role.';


--
-- TOC entry 530 (class 1255 OID 18479)
-- Name: pr_grant_project_user_role(uuid, uuid, uuid, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_grant_project_user_role(IN p_project_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.project_user_roles (project_id, user_id, role_id, granted_by_user_id)
    VALUES (p_project_id, p_user_id, p_role_id, p_granted_by_user_id)
    ON CONFLICT DO NOTHING;
END;
$$;


ALTER PROCEDURE gov.pr_grant_project_user_role(IN p_project_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5179 (class 0 OID 0)
-- Dependencies: 530
-- Name: PROCEDURE pr_grant_project_user_role(IN p_project_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_grant_project_user_role(IN p_project_id uuid, IN p_user_id uuid, IN p_role_id uuid, IN p_granted_by_user_id uuid) IS 'Grants a project-scoped role to a user. Idempotent.';


--
-- TOC entry 463 (class 1255 OID 18579)
-- Name: pr_log_dq_result(uuid, uuid, boolean, text, text); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_log_dq_result(IN p_pipeline_run_id uuid, IN p_rule_id uuid, IN p_passed_flag boolean, IN p_actual_value_text text DEFAULT NULL::text, IN p_error_message_text text DEFAULT NULL::text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.dq_results (pipeline_run_id, rule_id, passed_flag, actual_value_text, error_message_text)
    VALUES (p_pipeline_run_id, p_rule_id, p_passed_flag, p_actual_value_text, p_error_message_text);
END;
$$;


ALTER PROCEDURE gov.pr_log_dq_result(IN p_pipeline_run_id uuid, IN p_rule_id uuid, IN p_passed_flag boolean, IN p_actual_value_text text, IN p_error_message_text text) OWNER TO postgres;

--
-- TOC entry 5180 (class 0 OID 0)
-- Dependencies: 463
-- Name: PROCEDURE pr_log_dq_result(IN p_pipeline_run_id uuid, IN p_rule_id uuid, IN p_passed_flag boolean, IN p_actual_value_text text, IN p_error_message_text text); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_log_dq_result(IN p_pipeline_run_id uuid, IN p_rule_id uuid, IN p_passed_flag boolean, IN p_actual_value_text text, IN p_error_message_text text) IS 'Records the outcome of a DQ rule evaluation during a pipeline run. References execution.pipeline_runs.';


--
-- TOC entry 367 (class 1255 OID 24610)
-- Name: pr_replace_role_permissions(uuid, uuid[]); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_replace_role_permissions(IN p_role_id uuid, IN p_permission_ids uuid[])
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM gov.roles r WHERE r.role_id = p_role_id) THEN
        RAISE EXCEPTION 'Role not found'
            USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM gov.role_permissions rp
    WHERE rp.role_id = p_role_id
      AND (
            p_permission_ids IS NULL
            OR array_length(p_permission_ids, 1) IS NULL
            OR rp.permission_id <> ALL(p_permission_ids)
      );

    IF p_permission_ids IS NULL OR array_length(p_permission_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO gov.role_permissions (role_id, permission_id)
    SELECT p_role_id, perm_id
    FROM unnest(p_permission_ids) AS perm_id
    ON CONFLICT DO NOTHING;
END;
$$;


ALTER PROCEDURE gov.pr_replace_role_permissions(IN p_role_id uuid, IN p_permission_ids uuid[]) OWNER TO postgres;

--
-- TOC entry 5181 (class 0 OID 0)
-- Dependencies: 367
-- Name: PROCEDURE pr_replace_role_permissions(IN p_role_id uuid, IN p_permission_ids uuid[]); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_replace_role_permissions(IN p_role_id uuid, IN p_permission_ids uuid[]) IS 'Replaces a role permission-set atomically using the provided permission UUID array.';


--
-- TOC entry 390 (class 1255 OID 24602)
-- Name: pr_revoke_connector_access(uuid, uuid, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_revoke_connector_access(IN p_connector_id uuid, IN p_user_id uuid, IN p_role_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM gov.connector_access ca
    WHERE ca.connector_id = p_connector_id
      AND ((p_user_id IS NULL AND ca.user_id IS NULL) OR ca.user_id = p_user_id)
      AND ((p_role_id IS NULL AND ca.role_id IS NULL) OR ca.role_id = p_role_id);
END;
$$;


ALTER PROCEDURE gov.pr_revoke_connector_access(IN p_connector_id uuid, IN p_user_id uuid, IN p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5182 (class 0 OID 0)
-- Dependencies: 390
-- Name: PROCEDURE pr_revoke_connector_access(IN p_connector_id uuid, IN p_user_id uuid, IN p_role_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_revoke_connector_access(IN p_connector_id uuid, IN p_user_id uuid, IN p_role_id uuid) IS 'Revokes a connector-access grant using the same subject tuple used for grant creation.';


--
-- TOC entry 651 (class 1255 OID 24608)
-- Name: pr_revoke_project_user_membership(uuid, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_revoke_project_user_membership(IN p_project_id uuid, IN p_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM gov.project_user_roles
    WHERE project_id = p_project_id
      AND user_id = p_user_id;
END;
$$;


ALTER PROCEDURE gov.pr_revoke_project_user_membership(IN p_project_id uuid, IN p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5183 (class 0 OID 0)
-- Dependencies: 651
-- Name: PROCEDURE pr_revoke_project_user_membership(IN p_project_id uuid, IN p_user_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_revoke_project_user_membership(IN p_project_id uuid, IN p_user_id uuid) IS 'Revokes all project-scoped role grants for a user in a project.';


--
-- TOC entry 568 (class 1255 OID 18480)
-- Name: pr_revoke_project_user_role(uuid, uuid, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_revoke_project_user_role(IN p_project_id uuid, IN p_user_id uuid, IN p_role_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM gov.project_user_roles
    WHERE project_id = p_project_id AND user_id = p_user_id AND role_id = p_role_id;
END;
$$;


ALTER PROCEDURE gov.pr_revoke_project_user_role(IN p_project_id uuid, IN p_user_id uuid, IN p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5184 (class 0 OID 0)
-- Dependencies: 568
-- Name: PROCEDURE pr_revoke_project_user_role(IN p_project_id uuid, IN p_user_id uuid, IN p_role_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_revoke_project_user_role(IN p_project_id uuid, IN p_user_id uuid, IN p_role_id uuid) IS 'Revokes a project-scoped role from a user.';


--
-- TOC entry 609 (class 1255 OID 18476)
-- Name: pr_revoke_user_role(uuid, uuid); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_revoke_user_role(IN p_user_id uuid, IN p_role_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM gov.user_roles WHERE user_id = p_user_id AND role_id = p_role_id;
END;
$$;


ALTER PROCEDURE gov.pr_revoke_user_role(IN p_user_id uuid, IN p_role_id uuid) OWNER TO postgres;

--
-- TOC entry 5185 (class 0 OID 0)
-- Dependencies: 609
-- Name: PROCEDURE pr_revoke_user_role(IN p_user_id uuid, IN p_role_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_revoke_user_role(IN p_user_id uuid, IN p_role_id uuid) IS 'Removes a role assignment from a user.';


--
-- TOC entry 658 (class 1255 OID 32770)
-- Name: pr_set_notification_rule_active(uuid, boolean); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_set_notification_rule_active(IN p_notification_rule_id uuid, IN p_is_rule_active_flag boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE gov.notification_rules
    SET is_rule_active_flag = p_is_rule_active_flag
    WHERE notification_rule_id = p_notification_rule_id;
END;
$$;


ALTER PROCEDURE gov.pr_set_notification_rule_active(IN p_notification_rule_id uuid, IN p_is_rule_active_flag boolean) OWNER TO postgres;

--
-- TOC entry 5186 (class 0 OID 0)
-- Dependencies: 658
-- Name: PROCEDURE pr_set_notification_rule_active(IN p_notification_rule_id uuid, IN p_is_rule_active_flag boolean); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_set_notification_rule_active(IN p_notification_rule_id uuid, IN p_is_rule_active_flag boolean) IS 'Enables or disables a notification rule without deleting it.';


--
-- TOC entry 349 (class 1255 OID 18487)
-- Name: pr_store_secret(text, text); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_store_secret(IN p_key text, IN p_plain_value text, OUT p_secret_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.secrets (secret_key_name, secret_value_encrypted)
    VALUES (p_key, pgp_sym_encrypt(p_plain_value, current_setting('app.encryption_key')))
    ON CONFLICT (secret_key_name) DO UPDATE SET
        secret_value_encrypted = pgp_sym_encrypt(p_plain_value, current_setting('app.encryption_key')),
        updated_dtm = CURRENT_TIMESTAMP
    RETURNING secret_id INTO p_secret_id;
END;
$$;


ALTER PROCEDURE gov.pr_store_secret(IN p_key text, IN p_plain_value text, OUT p_secret_id uuid) OWNER TO postgres;

--
-- TOC entry 5187 (class 0 OID 0)
-- Dependencies: 349
-- Name: PROCEDURE pr_store_secret(IN p_key text, IN p_plain_value text, OUT p_secret_id uuid); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_store_secret(IN p_key text, IN p_plain_value text, OUT p_secret_id uuid) IS 'Law 3: Encrypts and persists a secret using pgp_sym_encrypt and the app.encryption_key session variable.';


--
-- TOC entry 659 (class 1255 OID 24609)
-- Name: pr_update_role_profile(uuid, text, text); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_update_role_profile(IN p_role_id uuid, IN p_role_display_name text, IN p_role_desc_text text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_is_system BOOLEAN;
BEGIN
    SELECT r.is_system_role_flag
    INTO v_is_system
    FROM gov.roles r
    WHERE r.role_id = p_role_id;

    IF v_is_system IS NULL THEN
        RAISE EXCEPTION 'Role not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_is_system
       AND p_role_display_name IS NOT NULL
       AND NULLIF(TRIM(p_role_display_name), '') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM gov.roles r
           WHERE r.role_id = p_role_id
             AND r.role_display_name <> TRIM(p_role_display_name)
       ) THEN
        RAISE EXCEPTION 'System role name cannot be changed'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE gov.roles
    SET
        role_display_name = CASE
            WHEN v_is_system THEN role_display_name
            ELSE COALESCE(NULLIF(TRIM(p_role_display_name), ''), role_display_name)
        END,
        role_desc_text = COALESCE(p_role_desc_text, role_desc_text)
    WHERE role_id = p_role_id;
END;
$$;


ALTER PROCEDURE gov.pr_update_role_profile(IN p_role_id uuid, IN p_role_display_name text, IN p_role_desc_text text) OWNER TO postgres;

--
-- TOC entry 5188 (class 0 OID 0)
-- Dependencies: 659
-- Name: PROCEDURE pr_update_role_profile(IN p_role_id uuid, IN p_role_display_name text, IN p_role_desc_text text); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_update_role_profile(IN p_role_id uuid, IN p_role_display_name text, IN p_role_desc_text text) IS 'Updates role name/description; system role names are immutable.';


--
-- TOC entry 543 (class 1255 OID 24593)
-- Name: pr_update_user_profile(uuid, text, text, boolean); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_update_user_profile(IN p_user_id uuid, IN p_email_address text, IN p_user_full_name text, IN p_is_account_active boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE etl.users
  SET email_address = COALESCE(NULLIF(TRIM(p_email_address), ''), email_address),
      user_full_name = COALESCE(NULLIF(TRIM(p_user_full_name), ''), user_full_name),
      is_account_active = COALESCE(p_is_account_active, is_account_active),
      updated_dtm = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;


ALTER PROCEDURE gov.pr_update_user_profile(IN p_user_id uuid, IN p_email_address text, IN p_user_full_name text, IN p_is_account_active boolean) OWNER TO postgres;

--
-- TOC entry 5189 (class 0 OID 0)
-- Dependencies: 543
-- Name: PROCEDURE pr_update_user_profile(IN p_user_id uuid, IN p_email_address text, IN p_user_full_name text, IN p_is_account_active boolean); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_update_user_profile(IN p_user_id uuid, IN p_email_address text, IN p_user_full_name text, IN p_is_account_active boolean) IS 'Updates editable governance user profile fields (display name, email, active flag).';


--
-- TOC entry 652 (class 1255 OID 18578)
-- Name: pr_upsert_dq_rule(text, uuid, text, jsonb, text); Type: PROCEDURE; Schema: gov; Owner: postgres
--

CREATE PROCEDURE gov.pr_upsert_dq_rule(IN p_target_type_code text, IN p_target_id uuid, IN p_rule_type_code text, IN p_rule_config_json jsonb, IN p_severity_code text DEFAULT 'ERROR'::text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO gov.dq_rules (target_type_code, target_id, rule_type_code, rule_config_json, severity_code)
    VALUES (p_target_type_code, p_target_id, p_rule_type_code, p_rule_config_json, p_severity_code)
    ON CONFLICT DO NOTHING;
END;
$$;


ALTER PROCEDURE gov.pr_upsert_dq_rule(IN p_target_type_code text, IN p_target_id uuid, IN p_rule_type_code text, IN p_rule_config_json jsonb, IN p_severity_code text) OWNER TO postgres;

--
-- TOC entry 5190 (class 0 OID 0)
-- Dependencies: 652
-- Name: PROCEDURE pr_upsert_dq_rule(IN p_target_type_code text, IN p_target_id uuid, IN p_rule_type_code text, IN p_rule_config_json jsonb, IN p_severity_code text); Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON PROCEDURE gov.pr_upsert_dq_rule(IN p_target_type_code text, IN p_target_id uuid, IN p_rule_type_code text, IN p_rule_config_json jsonb, IN p_severity_code text) IS 'Creates a data quality validation rule for a dataset or column.';


--
-- TOC entry 446 (class 1255 OID 18424)
-- Name: fn_capture_row_history(); Type: FUNCTION; Schema: history; Owner: postgres
--

CREATE FUNCTION history.fn_capture_row_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    v_action_by UUID := NULLIF(current_setting('app.user_id', TRUE), '')::UUID;
    v_action_cd CHAR(1);
BEGIN
    -- Law 7: Capture old row image into the corresponding history table
    v_action_cd := LEFT(TG_OP, 1); -- 'I', 'U', or 'D'

    IF TG_OP = 'DELETE' THEN
        -- Before a physical delete, snapshot the row into the history table
        EXECUTE format(
            'INSERT INTO history.%I SELECT $1.*, nextval(''history.%I_hist_id_seq''), $2, CURRENT_TIMESTAMP, $3',
            TG_TABLE_NAME || '_history',
            TG_TABLE_NAME || '_history'
        ) USING OLD, v_action_cd, v_action_by;

        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
        -- On update, snapshot the BEFORE image
        EXECUTE format(
            'INSERT INTO history.%I SELECT $1.*, nextval(''history.%I_hist_id_seq''), $2, CURRENT_TIMESTAMP, $3',
            TG_TABLE_NAME || '_history',
            TG_TABLE_NAME || '_history'
        ) USING OLD, v_action_cd, v_action_by;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$_$;


ALTER FUNCTION history.fn_capture_row_history() OWNER TO postgres;

--
-- TOC entry 5191 (class 0 OID 0)
-- Dependencies: 446
-- Name: FUNCTION fn_capture_row_history(); Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON FUNCTION history.fn_capture_row_history() IS 'Generic BEFORE trigger handler. Snapshots the OLD row image into the corresponding history shadow table before UPDATE or DELETE. The row IS the audit record (Law 7).';


--
-- TOC entry 596 (class 1255 OID 18583)
-- Name: fn_get_cdc_configuration(uuid); Type: FUNCTION; Schema: meta; Owner: postgres
--

CREATE FUNCTION meta.fn_get_cdc_configuration(p_dataset_id uuid) RETURNS TABLE(cdc_id uuid, cdc_mode_code text, watermark_column_name text, cdc_config_json jsonb, updated_dtm timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT cdc_id, cdc_mode_code, watermark_column_name, cdc_config_json, updated_dtm
    FROM meta.cdc_configurations
    WHERE dataset_id = p_dataset_id;
$$;


ALTER FUNCTION meta.fn_get_cdc_configuration(p_dataset_id uuid) OWNER TO postgres;

--
-- TOC entry 5192 (class 0 OID 0)
-- Dependencies: 596
-- Name: FUNCTION fn_get_cdc_configuration(p_dataset_id uuid); Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON FUNCTION meta.fn_get_cdc_configuration(p_dataset_id uuid) IS 'Returns the CDC extraction configuration for a specific dataset.';


--
-- TOC entry 532 (class 1255 OID 18580)
-- Name: fn_get_setting(text); Type: FUNCTION; Schema: meta; Owner: postgres
--

CREATE FUNCTION meta.fn_get_setting(p_setting_key_name text) RETURNS text
    LANGUAGE sql STABLE
    AS $$
    SELECT setting_value_text
    FROM meta.platform_settings
    WHERE setting_key_name = p_setting_key_name;
$$;


ALTER FUNCTION meta.fn_get_setting(p_setting_key_name text) OWNER TO postgres;

--
-- TOC entry 5193 (class 0 OID 0)
-- Dependencies: 532
-- Name: FUNCTION fn_get_setting(p_setting_key_name text); Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON FUNCTION meta.fn_get_setting(p_setting_key_name text) IS 'Returns the value of a named platform-wide setting. Returns NULL if not configured.';


--
-- TOC entry 588 (class 1255 OID 24659)
-- Name: fn_get_technologies(); Type: FUNCTION; Schema: meta; Owner: postgres
--

CREATE FUNCTION meta.fn_get_technologies() RETURNS TABLE(tech_id uuid, tech_code text, display_name text, category text, icon_name text, tech_desc_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT tech_id, tech_code, display_name, category, icon_name, tech_desc_text
    FROM meta.technology_types
    ORDER BY category, display_name;
$$;


ALTER FUNCTION meta.fn_get_technologies() OWNER TO postgres;

--
-- TOC entry 5194 (class 0 OID 0)
-- Dependencies: 588
-- Name: FUNCTION fn_get_technologies(); Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON FUNCTION meta.fn_get_technologies() IS 'Returns all registered technology types ordered for UI display.';


--
-- TOC entry 380 (class 1255 OID 24660)
-- Name: fn_get_technology_by_code(text); Type: FUNCTION; Schema: meta; Owner: postgres
--

CREATE FUNCTION meta.fn_get_technology_by_code(p_tech_code text) RETURNS TABLE(tech_id uuid, tech_code text, display_name text, category text, icon_name text, tech_desc_text text)
    LANGUAGE sql STABLE
    AS $$
    SELECT tech_id, tech_code, display_name, category, icon_name, tech_desc_text
    FROM meta.technology_types
    WHERE tech_code = p_tech_code;
$$;


ALTER FUNCTION meta.fn_get_technology_by_code(p_tech_code text) OWNER TO postgres;

--
-- TOC entry 5195 (class 0 OID 0)
-- Dependencies: 380
-- Name: FUNCTION fn_get_technology_by_code(p_tech_code text); Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON FUNCTION meta.fn_get_technology_by_code(p_tech_code text) IS 'Returns a single technology type by its unique code.';


--
-- TOC entry 476 (class 1255 OID 18582)
-- Name: pr_upsert_cdc_configuration(uuid, text, text, jsonb); Type: PROCEDURE; Schema: meta; Owner: postgres
--

CREATE PROCEDURE meta.pr_upsert_cdc_configuration(IN p_dataset_id uuid, IN p_cdc_mode_code text, IN p_watermark_column_name text DEFAULT NULL::text, IN p_cdc_config_json jsonb DEFAULT NULL::jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO meta.cdc_configurations
        (dataset_id, cdc_mode_code, watermark_column_name, cdc_config_json)
    VALUES (p_dataset_id, p_cdc_mode_code, p_watermark_column_name, p_cdc_config_json)
    ON CONFLICT (dataset_id) DO UPDATE SET
        cdc_mode_code         = EXCLUDED.cdc_mode_code,
        watermark_column_name = EXCLUDED.watermark_column_name,
        cdc_config_json       = EXCLUDED.cdc_config_json,
        updated_dtm           = CURRENT_TIMESTAMP;
END;
$$;


ALTER PROCEDURE meta.pr_upsert_cdc_configuration(IN p_dataset_id uuid, IN p_cdc_mode_code text, IN p_watermark_column_name text, IN p_cdc_config_json jsonb) OWNER TO postgres;

--
-- TOC entry 5196 (class 0 OID 0)
-- Dependencies: 476
-- Name: PROCEDURE pr_upsert_cdc_configuration(IN p_dataset_id uuid, IN p_cdc_mode_code text, IN p_watermark_column_name text, IN p_cdc_config_json jsonb); Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON PROCEDURE meta.pr_upsert_cdc_configuration(IN p_dataset_id uuid, IN p_cdc_mode_code text, IN p_watermark_column_name text, IN p_cdc_config_json jsonb) IS 'Creates or updates the CDC extraction strategy for a dataset. Idempotent.';


--
-- TOC entry 440 (class 1255 OID 18581)
-- Name: pr_upsert_setting(text, text, text, boolean, uuid); Type: PROCEDURE; Schema: meta; Owner: postgres
--

CREATE PROCEDURE meta.pr_upsert_setting(IN p_setting_key_name text, IN p_setting_value_text text, IN p_setting_desc_text text, IN p_is_sensitive_flag boolean, IN p_updated_by_user_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO meta.platform_settings
        (setting_key_name, setting_value_text, setting_desc_text, is_sensitive_flag, updated_by_user_id)
    VALUES (p_setting_key_name, p_setting_value_text, p_setting_desc_text, p_is_sensitive_flag, p_updated_by_user_id)
    ON CONFLICT (setting_key_name) DO UPDATE SET
        setting_value_text = EXCLUDED.setting_value_text,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_dtm        = CURRENT_TIMESTAMP;
END;
$$;


ALTER PROCEDURE meta.pr_upsert_setting(IN p_setting_key_name text, IN p_setting_value_text text, IN p_setting_desc_text text, IN p_is_sensitive_flag boolean, IN p_updated_by_user_id uuid) OWNER TO postgres;

--
-- TOC entry 5197 (class 0 OID 0)
-- Dependencies: 440
-- Name: PROCEDURE pr_upsert_setting(IN p_setting_key_name text, IN p_setting_value_text text, IN p_setting_desc_text text, IN p_is_sensitive_flag boolean, IN p_updated_by_user_id uuid); Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON PROCEDURE meta.pr_upsert_setting(IN p_setting_key_name text, IN p_setting_value_text text, IN p_setting_desc_text text, IN p_is_sensitive_flag boolean, IN p_updated_by_user_id uuid) IS 'Creates or updates a platform-wide setting. History trigger captures change before every update.';


--
-- TOC entry 416 (class 1255 OID 18774)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- TOC entry 276 (class 1259 OID 17783)
-- Name: asset_tags; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.asset_tags (
    asset_tag_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tag_id uuid NOT NULL,
    asset_type_code text NOT NULL,
    asset_id uuid NOT NULL,
    tagged_by_user_id uuid,
    tagged_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.asset_tags OWNER TO postgres;

--
-- TOC entry 5198 (class 0 OID 0)
-- Dependencies: 276
-- Name: TABLE asset_tags; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.asset_tags IS 'M2M mapping applying tags to any platform asset. Enables cross-entity search and classification.';


--
-- TOC entry 5199 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN asset_tags.asset_tag_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.asset_tags.asset_tag_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5200 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN asset_tags.tag_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.asset_tags.tag_id IS 'FK to the tag being applied.';


--
-- TOC entry 5201 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN asset_tags.asset_type_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.asset_tags.asset_type_code IS 'Type of the tagged asset: PIPELINE, ORCHESTRATOR, DATASET, CONNECTOR.';


--
-- TOC entry 5202 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN asset_tags.asset_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.asset_tags.asset_id IS 'UUID of the tagged entity.';


--
-- TOC entry 5203 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN asset_tags.tagged_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.asset_tags.tagged_by_user_id IS 'FK to the user who applied this tag.';


--
-- TOC entry 5204 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN asset_tags.tagged_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.asset_tags.tagged_dtm IS 'Timestamp when the tag was applied to the asset.';


--
-- TOC entry 245 (class 1259 OID 17070)
-- Name: branches; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.branches (
    branch_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_id uuid NOT NULL,
    branch_display_name text NOT NULL,
    base_version_id uuid,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid
);


ALTER TABLE catalog.branches OWNER TO postgres;

--
-- TOC entry 5205 (class 0 OID 0)
-- Dependencies: 245
-- Name: TABLE branches; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.branches IS 'Isolated development streams forked from a base pipeline version.';


--
-- TOC entry 5206 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN branches.branch_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.branches.branch_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5207 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN branches.pipeline_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.branches.pipeline_id IS 'FK to the parent pipeline.';


--
-- TOC entry 5208 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN branches.branch_display_name; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.branches.branch_display_name IS 'Unique label for this branch within the pipeline (e.g., feature/add-dedup).';


--
-- TOC entry 5209 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN branches.base_version_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.branches.base_version_id IS 'FK to the version from which this branch was forked.';


--
-- TOC entry 5210 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN branches.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.branches.created_dtm IS 'Timestamp when the branch was created.';


--
-- TOC entry 5211 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN branches.created_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.branches.created_by_user_id IS 'FK to the user who created this branch.';


--
-- TOC entry 273 (class 1259 OID 17721)
-- Name: connection_test_results; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.connection_test_results (
    test_result_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    connector_id uuid NOT NULL,
    test_passed_flag boolean NOT NULL,
    error_message_text text,
    response_time_ms integer,
    tested_by_user_id uuid,
    tested_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.connection_test_results OWNER TO postgres;

--
-- TOC entry 5212 (class 0 OID 0)
-- Dependencies: 273
-- Name: TABLE connection_test_results; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.connection_test_results IS 'Chronological history of connection test outcomes. Enables DevOps teams to see when a connector last failed and diagnose outages.';


--
-- TOC entry 5213 (class 0 OID 0)
-- Dependencies: 273
-- Name: COLUMN connection_test_results.test_result_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connection_test_results.test_result_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5214 (class 0 OID 0)
-- Dependencies: 273
-- Name: COLUMN connection_test_results.connector_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connection_test_results.connector_id IS 'FK to the connector under test.';


--
-- TOC entry 5215 (class 0 OID 0)
-- Dependencies: 273
-- Name: COLUMN connection_test_results.test_passed_flag; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connection_test_results.test_passed_flag IS 'TRUE if the connection attempt succeeded.';


--
-- TOC entry 5216 (class 0 OID 0)
-- Dependencies: 273
-- Name: COLUMN connection_test_results.error_message_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connection_test_results.error_message_text IS 'Error detail from the driver or connection layer when test_passed_flag is FALSE.';


--
-- TOC entry 5217 (class 0 OID 0)
-- Dependencies: 273
-- Name: COLUMN connection_test_results.response_time_ms; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connection_test_results.response_time_ms IS 'Round-trip latency in milliseconds for the successful connection attempt.';


--
-- TOC entry 5218 (class 0 OID 0)
-- Dependencies: 273
-- Name: COLUMN connection_test_results.tested_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connection_test_results.tested_by_user_id IS 'FK to the user who triggered the connection test.';


--
-- TOC entry 5219 (class 0 OID 0)
-- Dependencies: 273
-- Name: COLUMN connection_test_results.tested_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connection_test_results.tested_dtm IS 'Timestamp when the test was executed.';


--
-- TOC entry 283 (class 1259 OID 17951)
-- Name: connector_health; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.connector_health (
    health_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    connector_id uuid NOT NULL,
    health_status_code text DEFAULT 'UNKNOWN'::text NOT NULL,
    check_latency_ms integer,
    check_error_text text,
    consecutive_fail_num integer DEFAULT 0 NOT NULL,
    last_check_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    next_check_dtm timestamp with time zone
);


ALTER TABLE catalog.connector_health OWNER TO postgres;

--
-- TOC entry 5220 (class 0 OID 0)
-- Dependencies: 283
-- Name: TABLE connector_health; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.connector_health IS 'Current health status for each connector. Updated by periodic health checks (default every 15 min for scheduled connectors). A connector is DEGRADED after 3 consecutive failures.';


--
-- TOC entry 5221 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN connector_health.health_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connector_health.health_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5222 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN connector_health.connector_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connector_health.connector_id IS 'FK to the connector being monitored. UNIQUE — one health record per connector.';


--
-- TOC entry 5223 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN connector_health.health_status_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connector_health.health_status_code IS 'Current status: HEALTHY (test passes), DEGRADED (3+ consecutive failures), UNREACHABLE (network-level failure), UNKNOWN (never tested).';


--
-- TOC entry 5224 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN connector_health.check_latency_ms; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connector_health.check_latency_ms IS 'Round-trip latency in milliseconds for the most recent successful check. NULL if last check failed.';


--
-- TOC entry 5225 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN connector_health.check_error_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connector_health.check_error_text IS 'Error detail from the most recent failed check. NULL when HEALTHY.';


--
-- TOC entry 5226 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN connector_health.consecutive_fail_num; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connector_health.consecutive_fail_num IS 'Number of consecutive failed health checks. Reset to 0 on success. Threshold for DEGRADED is 3.';


--
-- TOC entry 5227 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN connector_health.last_check_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connector_health.last_check_dtm IS 'Timestamp of the most recent health check execution.';


--
-- TOC entry 5228 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN connector_health.next_check_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connector_health.next_check_dtm IS 'Computed next check time. Driven by the health check scheduler.';


--
-- TOC entry 237 (class 1259 OID 16832)
-- Name: connectors; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.connectors (
    connector_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    connector_display_name text NOT NULL,
    connector_type_code text NOT NULL,
    conn_config_json_encrypted text NOT NULL,
    conn_secrets_json_encrypted text,
    conn_jdbc_driver_class text,
    conn_test_query text,
    conn_spark_config_json jsonb,
    conn_ssl_mode text DEFAULT 'REQUIRE'::text NOT NULL,
    conn_ssh_tunnel_json_encrypted text,
    conn_proxy_json_encrypted text,
    conn_max_pool_size_num integer DEFAULT 5 NOT NULL,
    conn_idle_timeout_sec integer DEFAULT 600 NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    technology_id uuid
);


ALTER TABLE catalog.connectors OWNER TO postgres;

--
-- TOC entry 5229 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE connectors; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.connectors IS 'Centralized registry of data source and sink connection definitions. Supports cloud (AWS, GCP, Azure, Snowflake, Databricks, OCI), on-premises JDBC, file formats, and object storage connectors.';


--
-- TOC entry 5230 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.connector_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.connector_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5231 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.connector_display_name; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.connector_display_name IS 'Unique user-facing label for this connector (e.g., "Production Snowflake DWH").';


--
-- TOC entry 5232 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.connector_type_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.connector_type_code IS 'Connector class enum: AWS_S3, AWS_REDSHIFT, GCP_BIGQUERY, SNOWFLAKE, DATABRICKS, JDBC_POSTGRESQL, FILE_CSV, FILE_PARQUET, etc. Drives which IConnectorPlugin handles this connector.';


--
-- TOC entry 5233 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.conn_config_json_encrypted; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.conn_config_json_encrypted IS 'pgcrypto pgp_sym_encrypt output (TEXT armoured). Contains non-secret config: host, port, database, warehouse, role, region, auth_method, storage_bucket, etc. Decrypted only at execution or test time.';


--
-- TOC entry 5234 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.conn_secrets_json_encrypted; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.conn_secrets_json_encrypted IS 'pgcrypto pgp_sym_encrypt output (TEXT armoured). Contains all secrets: passwords, access keys, SA key JSON, client secrets, private keys, OAuth tokens. NULL when connector uses identity-based auth (Instance Profile, Managed Identity, Workload Identity).';


--
-- TOC entry 5235 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.conn_jdbc_driver_class; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.conn_jdbc_driver_class IS 'Override JDBC driver class name (e.g., org.postgresql.Driver). NULL uses the platform default per connector_type_code.';


--
-- TOC entry 5236 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.conn_test_query; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.conn_test_query IS 'Override connectivity test query (e.g., SELECT 1). NULL uses the platform default per connector_type_code.';


--
-- TOC entry 5237 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.conn_spark_config_json; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.conn_spark_config_json IS 'Additional Spark session configuration key-value pairs injected at codegen time. Used for connector-specific Spark tuning (e.g., fetchsize, pushdown predicates).';


--
-- TOC entry 5238 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.conn_ssl_mode; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.conn_ssl_mode IS 'SSL/TLS enforcement: DISABLE (dev only — not recommended), REQUIRE (encrypt but skip cert verify), VERIFY_CA (verify server cert), VERIFY_FULL (verify cert + hostname). Default REQUIRE.';


--
-- TOC entry 5239 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.conn_ssh_tunnel_json_encrypted; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.conn_ssh_tunnel_json_encrypted IS 'pgcrypto-encrypted SSH tunnel config: host, port, username, private_key_pem. NULL when direct connection is available. Used only by the preview service — Spark clusters require network-level access.';


--
-- TOC entry 5240 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.conn_proxy_json_encrypted; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.conn_proxy_json_encrypted IS 'pgcrypto-encrypted HTTP/SOCKS proxy configuration: proxy_host, proxy_port, proxy_type, proxy_username, proxy_password. NULL for direct connections.';


--
-- TOC entry 5241 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.conn_max_pool_size_num; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.conn_max_pool_size_num IS 'Maximum number of concurrent connections in the JDBC pool for this connector. Default 5, configurable per Non-Functional Requirements.';


--
-- TOC entry 5242 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.conn_idle_timeout_sec; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.conn_idle_timeout_sec IS 'JDBC connection pool idle timeout in seconds. Default 600 (10 minutes).';


--
-- TOC entry 5243 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.created_dtm IS 'Record creation timestamp; immutable after insert.';


--
-- TOC entry 5244 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.updated_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.updated_dtm IS 'Timestamp of the last configuration update.';


--
-- TOC entry 5245 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.created_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.created_by_user_id IS 'FK to the user who registered this connector.';


--
-- TOC entry 5246 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.updated_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.updated_by_user_id IS 'FK to the last user who modified this connector record.';


--
-- TOC entry 5247 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN connectors.technology_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.connectors.technology_id IS 'FK to the static technology type record. Ensures connections are grouped by technology.';


--
-- TOC entry 271 (class 1259 OID 17655)
-- Name: data_lineage; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.data_lineage (
    lineage_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_id uuid NOT NULL,
    version_id uuid NOT NULL,
    src_dataset_id uuid,
    src_column_name_text text,
    tgt_dataset_id uuid,
    tgt_column_name_text text,
    transformation_desc_text text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.data_lineage OWNER TO postgres;

--
-- TOC entry 5248 (class 0 OID 0)
-- Dependencies: 271
-- Name: TABLE data_lineage; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.data_lineage IS 'Column-level data lineage graph. Each row declares one column flowing from a source dataset to a target dataset via a pipeline version. Enables impact analysis, GDPR compliance, and data discovery.';


--
-- TOC entry 5249 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN data_lineage.lineage_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.data_lineage.lineage_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5250 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN data_lineage.pipeline_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.data_lineage.pipeline_id IS 'FK to the pipeline that creates this lineage edge.';


--
-- TOC entry 5251 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN data_lineage.version_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.data_lineage.version_id IS 'FK to the exact pipeline version that defines this lineage edge.';


--
-- TOC entry 5252 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN data_lineage.src_dataset_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.data_lineage.src_dataset_id IS 'FK to the source dataset the data flows from. NULL for computed-only columns.';


--
-- TOC entry 5253 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN data_lineage.src_column_name_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.data_lineage.src_column_name_text IS 'Source column name in the source dataset. NULL for constants or expressions.';


--
-- TOC entry 5254 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN data_lineage.tgt_dataset_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.data_lineage.tgt_dataset_id IS 'FK to the target dataset the data flows into.';


--
-- TOC entry 5255 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN data_lineage.tgt_column_name_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.data_lineage.tgt_column_name_text IS 'Target column name in the target dataset.';


--
-- TOC entry 5256 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN data_lineage.transformation_desc_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.data_lineage.transformation_desc_text IS 'Human-readable description of any transformation applied (e.g., CAST, UPPER, CONCAT).';


--
-- TOC entry 5257 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN data_lineage.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.data_lineage.created_dtm IS 'Timestamp when this lineage record was generated (typically on version commit).';


--
-- TOC entry 239 (class 1259 OID 16898)
-- Name: dataset_columns; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.dataset_columns (
    column_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dataset_id uuid NOT NULL,
    column_name_text text NOT NULL,
    data_type_code text NOT NULL,
    is_nullable_flag boolean DEFAULT true NOT NULL,
    ordinal_position_num integer NOT NULL,
    constraint_type_code text,
    fk_ref_dataset_id uuid,
    fk_ref_column_name_text text,
    column_desc_text text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.dataset_columns OWNER TO postgres;

--
-- TOC entry 5258 (class 0 OID 0)
-- Dependencies: 239
-- Name: TABLE dataset_columns; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.dataset_columns IS 'Column-level schema registry, including source-system constraint metadata (PK, UK, FK, NOT NULL).';


--
-- TOC entry 5259 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.column_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.column_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5260 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.dataset_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.dataset_id IS 'FK to the parent dataset; cascade-deleted when dataset is removed.';


--
-- TOC entry 5261 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.column_name_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.column_name_text IS 'Physical column name exactly as it exists in the source system.';


--
-- TOC entry 5262 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.data_type_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.data_type_code IS 'Source-system native data type string (e.g., VARCHAR(255), NUMBER(38,0), TIMESTAMP_TZ).';


--
-- TOC entry 5263 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.is_nullable_flag; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.is_nullable_flag IS 'FALSE when the source column has a NOT NULL constraint.';


--
-- TOC entry 5264 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.ordinal_position_num; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.ordinal_position_num IS 'Column order position (1-indexed) as defined in the source schema.';


--
-- TOC entry 5265 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.constraint_type_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.constraint_type_code IS 'Source-system constraint on this column: PK (Primary Key), UK (Unique Key), FK (Foreign Key), NONE. A column can appear multiple times for composite keys.';


--
-- TOC entry 5266 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.fk_ref_dataset_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.fk_ref_dataset_id IS 'For FK columns only: FK to the referenced (parent) dataset in this catalog.';


--
-- TOC entry 5267 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.fk_ref_column_name_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.fk_ref_column_name_text IS 'For FK columns only: name of the referenced column on the parent dataset.';


--
-- TOC entry 5268 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.column_desc_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.column_desc_text IS 'Business-facing description or data steward annotation for this column.';


--
-- TOC entry 5269 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN dataset_columns.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.dataset_columns.created_dtm IS 'Timestamp when this column record was registered.';


--
-- TOC entry 238 (class 1259 OID 16866)
-- Name: datasets; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.datasets (
    dataset_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    connector_id uuid NOT NULL,
    db_name_text text,
    schema_name_text text,
    table_name_text text NOT NULL,
    dataset_type_code text DEFAULT 'TABLE'::text NOT NULL,
    estimated_row_count_num bigint,
    last_introspection_dtm timestamp with time zone,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid
);


ALTER TABLE catalog.datasets OWNER TO postgres;

--
-- TOC entry 5270 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE datasets; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.datasets IS 'Physical data assets (tables, views, files) discovered and registered in the metadata catalog.';


--
-- TOC entry 5271 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.dataset_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.dataset_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5272 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.connector_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.connector_id IS 'FK to the connector through which this dataset is accessed.';


--
-- TOC entry 5273 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.db_name_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.db_name_text IS 'Database or catalog name on the source system. NULL for file-based sources.';


--
-- TOC entry 5274 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.schema_name_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.schema_name_text IS 'Schema or namespace on the source system (e.g., PUBLIC, DBO).';


--
-- TOC entry 5275 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.table_name_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.table_name_text IS 'Physical table, view, or file name as it exists in the source system.';


--
-- TOC entry 5276 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.dataset_type_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.dataset_type_code IS 'Asset classification: TABLE, VIEW, FILE, STREAM, API_ENDPOINT.';


--
-- TOC entry 5277 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.estimated_row_count_num; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.estimated_row_count_num IS 'Row count sampled during last introspection scan. Used for UI display and DQ rule thresholds.';


--
-- TOC entry 5278 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.last_introspection_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.last_introspection_dtm IS 'Timestamp of the most recent successful schema introspection from the source system.';


--
-- TOC entry 5279 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.created_dtm IS 'Record creation timestamp.';


--
-- TOC entry 5280 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.updated_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.updated_dtm IS 'Timestamp of the last metadata update.';


--
-- TOC entry 5281 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.created_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.created_by_user_id IS 'FK to the user who registered this dataset.';


--
-- TOC entry 5282 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN datasets.updated_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.datasets.updated_by_user_id IS 'FK to the last user who modified this dataset record.';


--
-- TOC entry 284 (class 1259 OID 17974)
-- Name: file_format_options; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.file_format_options (
    format_option_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    connector_id uuid NOT NULL,
    file_format_code text NOT NULL,
    field_separator_char text DEFAULT ','::text,
    decimal_separator_char text DEFAULT '.'::text,
    date_format_text text DEFAULT 'yyyy-MM-dd'::text,
    timestamp_format_text text DEFAULT 'yyyy-MM-dd HH:mm:ss'::text,
    encoding_standard_code text DEFAULT 'UTF-8'::text,
    has_header_flag boolean DEFAULT true,
    quote_char_text text DEFAULT '"'::text,
    escape_char_text text DEFAULT '\\'::text,
    null_value_text text,
    line_separator_text text,
    multiline_flag boolean DEFAULT false,
    sheet_name_text text,
    sheet_index_num integer DEFAULT 0,
    root_tag_text text,
    row_tag_text text,
    corrupt_record_mode text DEFAULT 'PERMISSIVE'::text,
    column_widths_text text,
    skip_rows_num integer DEFAULT 0,
    compression_code text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.file_format_options OWNER TO postgres;

--
-- TOC entry 5283 (class 0 OID 0)
-- Dependencies: 284
-- Name: TABLE file_format_options; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.file_format_options IS 'File format parsing and writing options for file-based connectors. One row per file connector. Supports CSV (with configurable separators, encoding, quoting), Parquet, ORC, JSON, XML, Excel, Avro, Fixed-Width, Delta Lake, Iceberg, and Hudi.';


--
-- TOC entry 5284 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.format_option_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.format_option_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5285 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.connector_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.connector_id IS 'FK to the parent connector. UNIQUE — one format config per connector.';


--
-- TOC entry 5286 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.file_format_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.file_format_code IS 'Format identifier: CSV, PARQUET, ORC, JSON, XML, EXCEL, AVRO, FIXED_WIDTH, DELTA, ICEBERG, HUDI.';


--
-- TOC entry 5287 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.field_separator_char; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.field_separator_char IS 'CSV field delimiter character. Common values: comma (,), semicolon (;), tab (\t), pipe (|). Default comma.';


--
-- TOC entry 5288 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.decimal_separator_char; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.decimal_separator_char IS 'Decimal point character for numeric fields. Period (.) for US/UK, comma (,) for EU locales. Default period.';


--
-- TOC entry 5289 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.date_format_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.date_format_text IS 'Java SimpleDateFormat pattern for date parsing (e.g., yyyy-MM-dd, dd/MM/yyyy, MM-dd-yyyy). Default yyyy-MM-dd.';


--
-- TOC entry 5290 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.timestamp_format_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.timestamp_format_text IS 'Java SimpleDateFormat pattern for timestamp parsing. Default yyyy-MM-dd HH:mm:ss.';


--
-- TOC entry 5291 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.encoding_standard_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.encoding_standard_code IS 'Character encoding: UTF-8, UTF-16, ISO-8859-1, WINDOWS-1252, US-ASCII, etc. Default UTF-8.';


--
-- TOC entry 5292 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.has_header_flag; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.has_header_flag IS 'TRUE if the first row of CSV/Excel contains column names. Default TRUE.';


--
-- TOC entry 5293 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.quote_char_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.quote_char_text IS 'Character used to quote string fields in CSV. Default double-quote ("). Set NULL to disable quoting.';


--
-- TOC entry 5294 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.escape_char_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.escape_char_text IS 'Escape character for special characters within quoted fields. Default backslash (\\).';


--
-- TOC entry 5295 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.null_value_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.null_value_text IS 'String representation of NULL values (e.g., NULL, N/A, empty string). NULL means empty fields are treated as empty strings.';


--
-- TOC entry 5296 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.line_separator_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.line_separator_text IS 'Line terminator override: \n (Unix), \r\n (Windows), \r (old Mac). NULL uses system default.';


--
-- TOC entry 5297 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.multiline_flag; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.multiline_flag IS 'TRUE to enable multi-line record parsing (JSON, CSV with embedded newlines). Default FALSE.';


--
-- TOC entry 5298 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.sheet_name_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.sheet_name_text IS 'Excel worksheet name to read. NULL reads the first sheet.';


--
-- TOC entry 5299 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.sheet_index_num; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.sheet_index_num IS 'Excel worksheet index (0-based). Used when sheet_name_text is NULL. Default 0.';


--
-- TOC entry 5300 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.root_tag_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.root_tag_text IS 'XML root element tag name. Required for XML format parsing.';


--
-- TOC entry 5301 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.row_tag_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.row_tag_text IS 'XML row element tag name. Each occurrence becomes one row in the resulting DataFrame.';


--
-- TOC entry 5302 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.corrupt_record_mode; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.corrupt_record_mode IS 'JSON/CSV malformed record handling: PERMISSIVE (store in _corrupt_record column), DROPMALFORMED (skip), FAILFAST (throw). Default PERMISSIVE.';


--
-- TOC entry 5303 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.column_widths_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.column_widths_text IS 'Fixed-width format: comma-separated list of column widths in characters (e.g., 10,20,15,8).';


--
-- TOC entry 5304 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.skip_rows_num; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.skip_rows_num IS 'Number of rows to skip at the beginning of the file (after header if has_header_flag is TRUE). Default 0.';


--
-- TOC entry 5305 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.compression_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.compression_code IS 'File compression codec: NONE, GZIP, SNAPPY, LZ4, ZSTD, BZIP2, DEFLATE. NULL auto-detects from file extension.';


--
-- TOC entry 5306 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.created_dtm IS 'Timestamp when this format configuration was created.';


--
-- TOC entry 5307 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN file_format_options.updated_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.file_format_options.updated_dtm IS 'Timestamp of the last format configuration change.';


--
-- TOC entry 281 (class 1259 OID 17895)
-- Name: orchestrator_pipeline_map; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.orchestrator_pipeline_map (
    orch_pipeline_map_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    orch_id uuid NOT NULL,
    pipeline_id uuid NOT NULL,
    dag_node_ref_text text NOT NULL,
    dependency_order_num integer DEFAULT 0 NOT NULL
);


ALTER TABLE catalog.orchestrator_pipeline_map OWNER TO postgres;

--
-- TOC entry 5308 (class 0 OID 0)
-- Dependencies: 281
-- Name: TABLE orchestrator_pipeline_map; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.orchestrator_pipeline_map IS 'Design-time M2M mapping between orchestrators and the pipelines they coordinate. Rebuilt on every orchestrator DAG save. Enables reverse-lookup: which orchestrators include a given pipeline. Distinct from execution.orchestrator_pipeline_run_map which records actual run instances.';


--
-- TOC entry 5309 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN orchestrator_pipeline_map.orch_pipeline_map_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_pipeline_map.orch_pipeline_map_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5310 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN orchestrator_pipeline_map.orch_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_pipeline_map.orch_id IS 'FK to the orchestrator that references this pipeline.';


--
-- TOC entry 5311 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN orchestrator_pipeline_map.pipeline_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_pipeline_map.pipeline_id IS 'FK to the pipeline referenced by the orchestrator DAG.';


--
-- TOC entry 5312 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN orchestrator_pipeline_map.dag_node_ref_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_pipeline_map.dag_node_ref_text IS 'The node identifier within the DAG definition that references this pipeline. Matches dag_definition_json node id.';


--
-- TOC entry 5313 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN orchestrator_pipeline_map.dependency_order_num; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_pipeline_map.dependency_order_num IS 'Topological order of this pipeline within the orchestrator DAG (0 = no ordering constraint).';


--
-- TOC entry 267 (class 1259 OID 17547)
-- Name: orchestrator_versions; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.orchestrator_versions (
    orch_version_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    orch_id uuid NOT NULL,
    version_num_seq integer NOT NULL,
    dag_snapshot_json jsonb NOT NULL,
    commit_msg_text text,
    release_tag_label text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid
);


ALTER TABLE catalog.orchestrator_versions OWNER TO postgres;

--
-- TOC entry 5314 (class 0 OID 0)
-- Dependencies: 267
-- Name: TABLE orchestrator_versions; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.orchestrator_versions IS 'Immutable version snapshots for orchestrator DAG definitions, mirroring the pipeline versioning model.';


--
-- TOC entry 5315 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN orchestrator_versions.orch_version_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_versions.orch_version_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5316 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN orchestrator_versions.orch_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_versions.orch_id IS 'FK to the parent orchestrator; cascade-deleted when orchestrator is removed.';


--
-- TOC entry 5317 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN orchestrator_versions.version_num_seq; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_versions.version_num_seq IS 'Monotonically increasing version number (1, 2, 3...) within the orchestrator.';


--
-- TOC entry 5318 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN orchestrator_versions.dag_snapshot_json; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_versions.dag_snapshot_json IS 'Complete frozen snapshot of the DAG definition at the time of this commit.';


--
-- TOC entry 5319 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN orchestrator_versions.commit_msg_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_versions.commit_msg_text IS 'Developer message describing changes in this version.';


--
-- TOC entry 5320 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN orchestrator_versions.release_tag_label; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_versions.release_tag_label IS 'Optional semantic version label (e.g., v2.0.0, STABLE).';


--
-- TOC entry 5321 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN orchestrator_versions.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_versions.created_dtm IS 'Timestamp when this version was committed.';


--
-- TOC entry 5322 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN orchestrator_versions.created_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrator_versions.created_by_user_id IS 'FK to the user who committed this orchestrator version.';


--
-- TOC entry 243 (class 1259 OID 17012)
-- Name: orchestrators; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.orchestrators (
    orch_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid,
    folder_id uuid,
    orch_display_name text NOT NULL,
    orch_desc_text text,
    dag_definition_json jsonb NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid,
    active_orch_version_id uuid,
    updated_by_user_id uuid
);


ALTER TABLE catalog.orchestrators OWNER TO postgres;

--
-- TOC entry 5323 (class 0 OID 0)
-- Dependencies: 243
-- Name: TABLE orchestrators; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.orchestrators IS 'High-level DAG orchestration definitions that coordinate multiple pipeline executions.';


--
-- TOC entry 5324 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.orch_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.orch_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5325 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.project_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.project_id IS 'FK to the owning project. NULL for global (cross-project) orchestrators.';


--
-- TOC entry 5326 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.folder_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.folder_id IS 'FK to the navigation folder.';


--
-- TOC entry 5327 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.orch_display_name; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.orch_display_name IS 'Unique label for this orchestrator within the project.';


--
-- TOC entry 5328 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.orch_desc_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.orch_desc_text IS 'Optional description of the orchestrated workflow.';


--
-- TOC entry 5329 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.dag_definition_json; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.dag_definition_json IS 'JSONB DAG structure: pipeline_ids, dependency edges, retry policies, and scheduling parameters.';


--
-- TOC entry 5330 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.created_dtm IS 'Record creation timestamp.';


--
-- TOC entry 5331 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.updated_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.updated_dtm IS 'Timestamp of the last DAG or metadata update.';


--
-- TOC entry 5332 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.created_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.created_by_user_id IS 'FK to the user who created this orchestrator.';


--
-- TOC entry 5333 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.active_orch_version_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.active_orch_version_id IS 'FK to the most recently committed orchestrator version. NULL until first commit.';


--
-- TOC entry 5334 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN orchestrators.updated_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.orchestrators.updated_by_user_id IS 'FK to the last user who modified this orchestrator record.';


--
-- TOC entry 242 (class 1259 OID 16989)
-- Name: pipeline_contents; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.pipeline_contents (
    content_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version_id uuid NOT NULL,
    ir_payload_json jsonb NOT NULL,
    ui_layout_json jsonb,
    content_checksum_text text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.pipeline_contents OWNER TO postgres;

--
-- TOC entry 5335 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE pipeline_contents; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.pipeline_contents IS 'Law 14: Mandatory storage for pipeline body. Every version must have exactly one content record.';


--
-- TOC entry 5336 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN pipeline_contents.content_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_contents.content_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5337 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN pipeline_contents.version_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_contents.version_id IS 'FK to the parent pipeline version; 1:1 relationship.';


--
-- TOC entry 5338 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN pipeline_contents.ir_payload_json; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_contents.ir_payload_json IS 'THE PIPELINE BODY: complete Internal Representation (IR) JSON defining all nodes, edges, transformations, and parameters.';


--
-- TOC entry 5339 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN pipeline_contents.ui_layout_json; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_contents.ui_layout_json IS 'Frontend-only rendering metadata: node XY positions, zoom level, collapsed state, color overrides.';


--
-- TOC entry 5340 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN pipeline_contents.content_checksum_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_contents.content_checksum_text IS 'MD5 hash of ir_payload_json used to detect corruption or unauthorised modification.';


--
-- TOC entry 5341 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN pipeline_contents.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_contents.created_dtm IS 'Timestamp when this content snapshot was persisted.';


--
-- TOC entry 272 (class 1259 OID 17691)
-- Name: pipeline_dataset_map; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.pipeline_dataset_map (
    map_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_id uuid NOT NULL,
    version_id uuid NOT NULL,
    dataset_id uuid NOT NULL,
    access_mode_code text NOT NULL,
    node_id_text text
);


ALTER TABLE catalog.pipeline_dataset_map OWNER TO postgres;

--
-- TOC entry 5342 (class 0 OID 0)
-- Dependencies: 272
-- Name: TABLE pipeline_dataset_map; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.pipeline_dataset_map IS 'Explicit dataset dependency map for a pipeline version. Populated on commit to enable O(1) impact analysis queries without parsing the IR JSON.';


--
-- TOC entry 5343 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN pipeline_dataset_map.map_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_dataset_map.map_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5344 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN pipeline_dataset_map.pipeline_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_dataset_map.pipeline_id IS 'FK to the pipeline.';


--
-- TOC entry 5345 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN pipeline_dataset_map.version_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_dataset_map.version_id IS 'FK to the pipeline version this dependency applies to.';


--
-- TOC entry 5346 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN pipeline_dataset_map.dataset_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_dataset_map.dataset_id IS 'FK to the dataset being read from or written to.';


--
-- TOC entry 5347 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN pipeline_dataset_map.access_mode_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_dataset_map.access_mode_code IS 'Direction of data flow: READ (source node), WRITE (sink node), READ_WRITE (used as both).';


--
-- TOC entry 5348 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN pipeline_dataset_map.node_id_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_dataset_map.node_id_text IS 'IR node identifier for traceability back to the pipeline canvas.';


--
-- TOC entry 268 (class 1259 OID 17583)
-- Name: pipeline_parameters; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.pipeline_parameters (
    param_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_id uuid NOT NULL,
    param_key_name text NOT NULL,
    param_data_type_code text DEFAULT 'STRING'::text NOT NULL,
    default_value_text text,
    is_required_flag boolean DEFAULT false NOT NULL,
    param_desc_text text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.pipeline_parameters OWNER TO postgres;

--
-- TOC entry 5349 (class 0 OID 0)
-- Dependencies: 268
-- Name: TABLE pipeline_parameters; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.pipeline_parameters IS 'Declared, typed runtime parameters for a pipeline that can be overridden at execution time without modifying the pipeline body.';


--
-- TOC entry 5350 (class 0 OID 0)
-- Dependencies: 268
-- Name: COLUMN pipeline_parameters.param_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_parameters.param_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5351 (class 0 OID 0)
-- Dependencies: 268
-- Name: COLUMN pipeline_parameters.pipeline_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_parameters.pipeline_id IS 'FK to the pipeline that declares this parameter.';


--
-- TOC entry 5352 (class 0 OID 0)
-- Dependencies: 268
-- Name: COLUMN pipeline_parameters.param_key_name; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_parameters.param_key_name IS 'Unique parameter identifier within the pipeline (e.g., RUN_DATE, MAX_ROWS, SOURCE_SCHEMA).';


--
-- TOC entry 5353 (class 0 OID 0)
-- Dependencies: 268
-- Name: COLUMN pipeline_parameters.param_data_type_code; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_parameters.param_data_type_code IS 'Expected value type: STRING, INTEGER, BOOLEAN, DATE, TIMESTAMP.';


--
-- TOC entry 5354 (class 0 OID 0)
-- Dependencies: 268
-- Name: COLUMN pipeline_parameters.default_value_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_parameters.default_value_text IS 'Serialized default value used when no override is supplied at run time.';


--
-- TOC entry 5355 (class 0 OID 0)
-- Dependencies: 268
-- Name: COLUMN pipeline_parameters.is_required_flag; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_parameters.is_required_flag IS 'TRUE means the parameter must be explicitly supplied at run time; job fails if missing.';


--
-- TOC entry 5356 (class 0 OID 0)
-- Dependencies: 268
-- Name: COLUMN pipeline_parameters.param_desc_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_parameters.param_desc_text IS 'Description of the parameter purpose for the run-form UI and documentation.';


--
-- TOC entry 5357 (class 0 OID 0)
-- Dependencies: 268
-- Name: COLUMN pipeline_parameters.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_parameters.created_dtm IS 'Timestamp when the parameter was declared.';


--
-- TOC entry 274 (class 1259 OID 17744)
-- Name: pipeline_validation_results; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.pipeline_validation_results (
    validation_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_id uuid NOT NULL,
    validation_passed_flag boolean NOT NULL,
    error_count_num integer DEFAULT 0 NOT NULL,
    validation_errors_json jsonb,
    validated_by_user_id uuid,
    validated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.pipeline_validation_results OWNER TO postgres;

--
-- TOC entry 5358 (class 0 OID 0)
-- Dependencies: 274
-- Name: TABLE pipeline_validation_results; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.pipeline_validation_results IS 'History of pipeline validation gate outcomes. Enables auditors to verify that no invalid pipeline was ever committed.';


--
-- TOC entry 5359 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN pipeline_validation_results.validation_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_validation_results.validation_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5360 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN pipeline_validation_results.pipeline_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_validation_results.pipeline_id IS 'FK to the pipeline that was validated.';


--
-- TOC entry 5361 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN pipeline_validation_results.validation_passed_flag; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_validation_results.validation_passed_flag IS 'TRUE if the pipeline passed all structural validation rules.';


--
-- TOC entry 5362 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN pipeline_validation_results.error_count_num; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_validation_results.error_count_num IS 'Number of distinct validation errors found.';


--
-- TOC entry 5363 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN pipeline_validation_results.validation_errors_json; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_validation_results.validation_errors_json IS 'Full [{field, error}] array from fn_validate_pipeline_ir and fn_validate_column_mapping.';


--
-- TOC entry 5364 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN pipeline_validation_results.validated_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_validation_results.validated_by_user_id IS 'FK to the user who triggered the validation run.';


--
-- TOC entry 5365 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN pipeline_validation_results.validated_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_validation_results.validated_dtm IS 'Timestamp of the validation execution.';


--
-- TOC entry 241 (class 1259 OID 16964)
-- Name: pipeline_versions; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.pipeline_versions (
    version_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_id uuid NOT NULL,
    version_num_seq integer NOT NULL,
    commit_msg_text text,
    release_tag_label text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid
);


ALTER TABLE catalog.pipeline_versions OWNER TO postgres;

--
-- TOC entry 5366 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE pipeline_versions; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.pipeline_versions IS 'Immutable snapshots of a pipeline at a specific point in time.';


--
-- TOC entry 5367 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN pipeline_versions.version_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_versions.version_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5368 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN pipeline_versions.pipeline_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_versions.pipeline_id IS 'FK to the parent pipeline; cascade-deleted when pipeline is removed.';


--
-- TOC entry 5369 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN pipeline_versions.version_num_seq; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_versions.version_num_seq IS 'Monotonically increasing version number (1, 2, 3...).';


--
-- TOC entry 5370 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN pipeline_versions.commit_msg_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_versions.commit_msg_text IS 'Developer-provided message describing what changed in this version.';


--
-- TOC entry 5371 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN pipeline_versions.release_tag_label; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_versions.release_tag_label IS 'Optional semantic version label (e.g., v1.0.0, STABLE, RC-2).';


--
-- TOC entry 5372 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN pipeline_versions.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_versions.created_dtm IS 'Timestamp when this version was published.';


--
-- TOC entry 5373 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN pipeline_versions.created_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipeline_versions.created_by_user_id IS 'FK to the user who committed this version.';


--
-- TOC entry 240 (class 1259 OID 16927)
-- Name: pipelines; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.pipelines (
    pipeline_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid,
    folder_id uuid,
    pipeline_display_name text NOT NULL,
    pipeline_desc_text text,
    active_version_id uuid,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid
);


ALTER TABLE catalog.pipelines OWNER TO postgres;

--
-- TOC entry 5374 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE pipelines; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.pipelines IS 'Logical definition of a Spark ETL data flow. A pipeline exists once created; its state is implied by whether it has a committed version.';


--
-- TOC entry 5375 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN pipelines.pipeline_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipelines.pipeline_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5376 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN pipelines.project_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipelines.project_id IS 'FK to the owning project. NULL for global (cross-project) pipelines.';


--
-- TOC entry 5377 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN pipelines.folder_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipelines.folder_id IS 'FK to the navigation folder this pipeline lives in. NULL means project root.';


--
-- TOC entry 5378 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN pipelines.pipeline_display_name; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipelines.pipeline_display_name IS 'User-visible unique name for this pipeline within the project.';


--
-- TOC entry 5379 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN pipelines.pipeline_desc_text; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipelines.pipeline_desc_text IS 'Optional free-text summary of the pipeline purpose and expected output.';


--
-- TOC entry 5380 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN pipelines.active_version_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipelines.active_version_id IS 'FK to the most recently committed version. NULL until first commit.';


--
-- TOC entry 5381 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN pipelines.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipelines.created_dtm IS 'Record creation timestamp.';


--
-- TOC entry 5382 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN pipelines.updated_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipelines.updated_dtm IS 'Timestamp of the last metadata update (not version commit).';


--
-- TOC entry 5383 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN pipelines.created_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipelines.created_by_user_id IS 'FK to the user who originally created this pipeline.';


--
-- TOC entry 5384 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN pipelines.updated_by_user_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.pipelines.updated_by_user_id IS 'FK to the last user who modified the pipeline metadata.';


--
-- TOC entry 275 (class 1259 OID 17769)
-- Name: tags; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.tags (
    tag_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tag_display_name text NOT NULL,
    tag_color_hex text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.tags OWNER TO postgres;

--
-- TOC entry 5385 (class 0 OID 0)
-- Dependencies: 275
-- Name: TABLE tags; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON TABLE catalog.tags IS 'Global tag vocabulary for categorizing and discovering platform assets.';


--
-- TOC entry 5386 (class 0 OID 0)
-- Dependencies: 275
-- Name: COLUMN tags.tag_id; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.tags.tag_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5387 (class 0 OID 0)
-- Dependencies: 275
-- Name: COLUMN tags.tag_display_name; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.tags.tag_display_name IS 'Unique tag label shown in the UI (e.g., PII, finance, experimental).';


--
-- TOC entry 5388 (class 0 OID 0)
-- Dependencies: 275
-- Name: COLUMN tags.tag_color_hex; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.tags.tag_color_hex IS 'Optional hex color code for UI badge rendering (e.g., #FF5733).';


--
-- TOC entry 5389 (class 0 OID 0)
-- Dependencies: 275
-- Name: COLUMN tags.created_dtm; Type: COMMENT; Schema: catalog; Owner: postgres
--

COMMENT ON COLUMN catalog.tags.created_dtm IS 'Timestamp when the tag was created.';


--
-- TOC entry 236 (class 1259 OID 16804)
-- Name: folders; Type: TABLE; Schema: etl; Owner: postgres
--

CREATE TABLE etl.folders (
    folder_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    parent_folder_id uuid,
    folder_display_name text NOT NULL,
    hierarchical_path_ltree public.ltree NOT NULL,
    folder_type_code text NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE etl.folders OWNER TO postgres;

--
-- TOC entry 5390 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE folders; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON TABLE etl.folders IS 'Hierarchical navigation nodes within a project. Supports unlimited depth via LTREE.';


--
-- TOC entry 5391 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN folders.folder_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.folders.folder_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5392 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN folders.project_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.folders.project_id IS 'FK to the owning project; cascade-deleted when project is removed.';


--
-- TOC entry 5393 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN folders.parent_folder_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.folders.parent_folder_id IS 'Self-referential FK to parent folder. NULL for root-level folders.';


--
-- TOC entry 5394 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN folders.folder_display_name; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.folders.folder_display_name IS 'User-visible name of the folder as shown in the navigation tree.';


--
-- TOC entry 5395 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN folders.hierarchical_path_ltree; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.folders.hierarchical_path_ltree IS 'Materialized LTREE path (e.g., pipelines.etl.finance). Enables fast subtree and ancestor queries.';


--
-- TOC entry 5396 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN folders.folder_type_code; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.folders.folder_type_code IS 'Category constraint: PIPELINE_ROOT, ORCH_ROOT, PIPELINE, ORCHESTRATOR, RESOURCE.';


--
-- TOC entry 5397 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN folders.created_dtm; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.folders.created_dtm IS 'Record creation timestamp.';


--
-- TOC entry 5398 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN folders.updated_dtm; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.folders.updated_dtm IS 'Timestamp of the last folder rename or move.';


--
-- TOC entry 235 (class 1259 OID 16778)
-- Name: projects; Type: TABLE; Schema: etl; Owner: postgres
--

CREATE TABLE etl.projects (
    project_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_display_name text NOT NULL,
    project_desc_text text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid
);


ALTER TABLE etl.projects OWNER TO postgres;

--
-- TOC entry 5399 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE projects; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON TABLE etl.projects IS 'Top-level container for all data engineering artifacts. Access controlled via gov.user_roles.';


--
-- TOC entry 5400 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN projects.project_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.projects.project_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5401 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN projects.project_display_name; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.projects.project_display_name IS 'Human-readable unique name for the project across the instance.';


--
-- TOC entry 5402 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN projects.project_desc_text; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.projects.project_desc_text IS 'Optional free-text description of this project''s purpose and scope.';


--
-- TOC entry 5403 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN projects.created_dtm; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.projects.created_dtm IS 'Record creation timestamp; immutable after insert.';


--
-- TOC entry 5404 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN projects.updated_dtm; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.projects.updated_dtm IS 'Timestamp of the last project metadata modification.';


--
-- TOC entry 5405 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN projects.created_by_user_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.projects.created_by_user_id IS 'FK to the user who created this project.';


--
-- TOC entry 5406 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN projects.updated_by_user_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.projects.updated_by_user_id IS 'FK to the last user who modified this project record.';


--
-- TOC entry 229 (class 1259 OID 16671)
-- Name: user_attributes; Type: TABLE; Schema: etl; Owner: postgres
--

CREATE TABLE etl.user_attributes (
    attr_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    attr_key_name text NOT NULL,
    attr_value_text text NOT NULL,
    is_sensitive_flag boolean DEFAULT false NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE etl.user_attributes OWNER TO postgres;

--
-- TOC entry 5407 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE user_attributes; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON TABLE etl.user_attributes IS 'Extensible key-value profile metadata for users (e.g., theme preference, notification settings).';


--
-- TOC entry 5408 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN user_attributes.attr_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_attributes.attr_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5409 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN user_attributes.user_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_attributes.user_id IS 'FK to etl.users; cascade-deleted when user is removed.';


--
-- TOC entry 5410 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN user_attributes.attr_key_name; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_attributes.attr_key_name IS 'Logical attribute name (e.g., UI_THEME, DEFAULT_PROJECT_ID).';


--
-- TOC entry 5411 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN user_attributes.attr_value_text; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_attributes.attr_value_text IS 'String-serialized value for the attribute.';


--
-- TOC entry 5412 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN user_attributes.is_sensitive_flag; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_attributes.is_sensitive_flag IS 'When TRUE, the value must be masked in logs and API responses.';


--
-- TOC entry 5413 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN user_attributes.created_dtm; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_attributes.created_dtm IS 'Timestamp when this attribute was first set.';


--
-- TOC entry 263 (class 1259 OID 17440)
-- Name: user_work_drafts; Type: TABLE; Schema: etl; Owner: postgres
--

CREATE TABLE etl.user_work_drafts (
    draft_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    entity_type_code text NOT NULL,
    entity_id uuid,
    draft_payload_json jsonb NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE etl.user_work_drafts OWNER TO postgres;

--
-- TOC entry 5414 (class 0 OID 0)
-- Dependencies: 263
-- Name: TABLE user_work_drafts; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON TABLE etl.user_work_drafts IS 'Law 15: Persistence layer for unsaved UI state. Enables session recovery after browser close.';


--
-- TOC entry 5415 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN user_work_drafts.draft_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_work_drafts.draft_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5416 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN user_work_drafts.user_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_work_drafts.user_id IS 'FK to the user whose session this draft belongs to.';


--
-- TOC entry 5417 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN user_work_drafts.entity_type_code; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_work_drafts.entity_type_code IS 'Asset type being edited: PIPELINE, ORCHESTRATOR, CONNECTOR.';


--
-- TOC entry 5418 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN user_work_drafts.entity_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_work_drafts.entity_id IS 'FK to the entity being edited. NULL when the user is creating a brand-new unsaved asset.';


--
-- TOC entry 5419 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN user_work_drafts.draft_payload_json; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_work_drafts.draft_payload_json IS 'Complete serialized UI state snapshot (equivalent to what would be stored in pipeline_contents on save).';


--
-- TOC entry 5420 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN user_work_drafts.created_dtm; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_work_drafts.created_dtm IS 'Timestamp when the first autosave of this session occurred.';


--
-- TOC entry 5421 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN user_work_drafts.updated_dtm; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.user_work_drafts.updated_dtm IS 'Timestamp of the most recent autosave. Useful for "last edited at" display.';


--
-- TOC entry 228 (class 1259 OID 16649)
-- Name: users; Type: TABLE; Schema: etl; Owner: postgres
--

CREATE TABLE etl.users (
    user_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email_address text NOT NULL,
    password_hash_text text NOT NULL,
    user_full_name text NOT NULL,
    is_account_active boolean DEFAULT true NOT NULL,
    mfa_enabled_flag boolean DEFAULT false NOT NULL,
    mfa_secret_encrypted text,
    last_login_dtm timestamp with time zone,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE etl.users OWNER TO postgres;

--
-- TOC entry 5422 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE users; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON TABLE etl.users IS 'Central identity store for all platform users on this single-tenant instance.';


--
-- TOC entry 5423 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN users.user_id; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.users.user_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5424 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN users.email_address; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.users.email_address IS 'Primary unique login credential and communication address.';


--
-- TOC entry 5425 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN users.password_hash_text; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.users.password_hash_text IS 'bcrypt or pgcrypto salted hash of the user password. Never store plaintext.';


--
-- TOC entry 5426 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN users.user_full_name; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.users.user_full_name IS 'Display name shown across the UI (e.g., "Jane Doe").';


--
-- TOC entry 5427 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN users.is_account_active; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.users.is_account_active IS 'Administratively controlled flag; FALSE disables login without deleting the record.';


--
-- TOC entry 5428 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN users.mfa_enabled_flag; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.users.mfa_enabled_flag IS 'TRUE when the user has enrolled in TOTP-based Multi-Factor Authentication.';


--
-- TOC entry 5429 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN users.mfa_secret_encrypted; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.users.mfa_secret_encrypted IS 'pgcrypto-encrypted TOTP seed. Decrypted only during MFA verification.';


--
-- TOC entry 5430 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN users.last_login_dtm; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.users.last_login_dtm IS 'Timestamp of the most recent successful authentication event.';


--
-- TOC entry 5431 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN users.created_dtm; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.users.created_dtm IS 'Record creation timestamp; immutable after insert.';


--
-- TOC entry 5432 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN users.updated_dtm; Type: COMMENT; Schema: etl; Owner: postgres
--

COMMENT ON COLUMN etl.users.updated_dtm IS 'Timestamp of the last field modification; updated by trigger or application.';


--
-- TOC entry 246 (class 1259 OID 17100)
-- Name: environments; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.environments (
    env_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    env_display_name text NOT NULL,
    is_prod_env_flag boolean DEFAULT false NOT NULL,
    cluster_config_json jsonb NOT NULL,
    network_zone_code text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE execution.environments OWNER TO postgres;

--
-- TOC entry 5433 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE environments; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.environments IS 'Deployment targets with Spark cluster and network configurations.';


--
-- TOC entry 5434 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN environments.env_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.environments.env_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5435 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN environments.env_display_name; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.environments.env_display_name IS 'Unique label for the environment (e.g., DEV, QA, STAGING, PROD).';


--
-- TOC entry 5436 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN environments.is_prod_env_flag; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.environments.is_prod_env_flag IS 'TRUE for production environments requiring approval gates and stricter governance.';


--
-- TOC entry 5437 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN environments.cluster_config_json; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.environments.cluster_config_json IS 'JSONB: Spark master URL, executor memory, driver cores, dynamic allocation settings.';


--
-- TOC entry 5438 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN environments.network_zone_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.environments.network_zone_code IS 'Network isolation zone identifier (e.g., PRIVATE, DMZ, PUBLIC).';


--
-- TOC entry 5439 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN environments.created_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.environments.created_dtm IS 'Record creation timestamp.';


--
-- TOC entry 5440 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN environments.updated_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.environments.updated_dtm IS 'Timestamp of the last cluster configuration change.';


--
-- TOC entry 255 (class 1259 OID 17267)
-- Name: generated_artifacts; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.generated_artifacts (
    artifact_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_id uuid NOT NULL,
    pipeline_version_id uuid NOT NULL,
    technology_code text NOT NULL,
    spark_version_text text,
    generation_opts jsonb,
    metadata_json jsonb,
    files_json jsonb NOT NULL,
    warning_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    generated_by_user_id uuid,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE execution.generated_artifacts OWNER TO postgres;

--
-- TOC entry 5441 (class 0 OID 0)
-- Dependencies: 255
-- Name: TABLE generated_artifacts; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.generated_artifacts IS 'Immutable history of source code and build artifacts generated for pipelines.';


--
-- TOC entry 5442 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.artifact_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.artifact_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5443 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.pipeline_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.pipeline_id IS 'FK to the parent pipeline.';


--
-- TOC entry 5444 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.pipeline_version_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.pipeline_version_id IS 'FK to the exact committed version that was used for code generation.';


--
-- TOC entry 5445 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.technology_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.technology_code IS 'Codegen target: PYSPARK, SCALA_SPARK.';


--
-- TOC entry 5446 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.spark_version_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.spark_version_text IS 'Version of Spark targeted during generation (e.g., 3.4.0).';


--
-- TOC entry 5447 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.generation_opts; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.generation_opts IS 'JSON parameters passed to the codegen engine.';


--
-- TOC entry 5448 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.metadata_json; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.metadata_json IS 'Codegen results summary: imports, shared variables, metrics.';


--
-- TOC entry 5449 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.files_json; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.files_json IS 'Content of generated files (fileName, contents, extension).';


--
-- TOC entry 5450 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.warning_count; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.warning_count IS 'Number of warnings identified during generation.';


--
-- TOC entry 5451 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.error_count; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.error_count IS 'Number of errors (critical failures) during generation.';


--
-- TOC entry 5452 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.generated_by_user_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.generated_by_user_id IS 'FK to the user who triggered the codegen process.';


--
-- TOC entry 5453 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN generated_artifacts.created_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.generated_artifacts.created_dtm IS 'Record creation timestamp.';


--
-- TOC entry 249 (class 1259 OID 17187)
-- Name: orchestrator_pipeline_run_map; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.orchestrator_pipeline_run_map (
    orch_run_id uuid NOT NULL,
    pipeline_run_id uuid NOT NULL,
    dag_node_id_text text NOT NULL,
    execution_order_num integer NOT NULL
);


ALTER TABLE execution.orchestrator_pipeline_run_map OWNER TO postgres;

--
-- TOC entry 5454 (class 0 OID 0)
-- Dependencies: 249
-- Name: TABLE orchestrator_pipeline_run_map; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.orchestrator_pipeline_run_map IS 'Maps each pipeline_run to its parent orchestrator_run and position in the DAG.';


--
-- TOC entry 5455 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN orchestrator_pipeline_run_map.orch_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_pipeline_run_map.orch_run_id IS 'FK to the parent orchestrator run.';


--
-- TOC entry 5456 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN orchestrator_pipeline_run_map.pipeline_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_pipeline_run_map.pipeline_run_id IS 'FK to the child pipeline run.';


--
-- TOC entry 5457 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN orchestrator_pipeline_run_map.dag_node_id_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_pipeline_run_map.dag_node_id_text IS 'Node ID in the orchestrator DAG definition that corresponds to this pipeline.';


--
-- TOC entry 5458 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN orchestrator_pipeline_run_map.execution_order_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_pipeline_run_map.execution_order_num IS 'Topological order in which this pipeline was scheduled within the DAG.';


--
-- TOC entry 248 (class 1259 OID 17156)
-- Name: orchestrator_runs; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.orchestrator_runs (
    orch_run_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    orch_id uuid NOT NULL,
    env_id uuid,
    run_status_code text DEFAULT 'PENDING'::text NOT NULL,
    trigger_type_code text DEFAULT 'MANUAL'::text NOT NULL,
    triggered_by_user_id uuid,
    start_dtm timestamp with time zone,
    end_dtm timestamp with time zone,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    run_duration_ms integer,
    error_message_text text,
    retry_count_num integer DEFAULT 0 NOT NULL,
    run_options_json jsonb
);


ALTER TABLE execution.orchestrator_runs OWNER TO postgres;

--
-- TOC entry 5459 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE orchestrator_runs; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.orchestrator_runs IS 'One record per orchestrator DAG execution; parent of all its pipeline runs.';


--
-- TOC entry 5460 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.orch_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.orch_run_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5461 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.orch_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.orch_id IS 'FK to the orchestrator DAG that was executed.';


--
-- TOC entry 5462 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.env_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.env_id IS 'FK to the environment where the orchestrator ran.';


--
-- TOC entry 5463 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.run_status_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.run_status_code IS 'Aggregate DAG execution state: PENDING, RUNNING, SUCCESS, PARTIAL_FAIL, FAILED, KILLED.';


--
-- TOC entry 5464 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.trigger_type_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.trigger_type_code IS 'How this orchestrator was triggered: MANUAL, SCHEDULE, EVENT, API.';


--
-- TOC entry 5465 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.triggered_by_user_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.triggered_by_user_id IS 'FK to the user for MANUAL triggers; NULL for automated triggers.';


--
-- TOC entry 5466 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.start_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.start_dtm IS 'Timestamp when the first pipeline node began executing.';


--
-- TOC entry 5467 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.end_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.end_dtm IS 'Timestamp when the last pipeline node reached a terminal state.';


--
-- TOC entry 5468 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.created_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.created_dtm IS 'Timestamp when the orchestrator run record was created.';


--
-- TOC entry 5469 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.run_duration_ms; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.run_duration_ms IS 'Elapsed milliseconds from start_dtm to end_dtm; populated on terminal state transition.';


--
-- TOC entry 5470 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.error_message_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.error_message_text IS 'Aggregated error summary when the orchestrator run fails or is partially failed.';


--
-- TOC entry 5471 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.retry_count_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.retry_count_num IS 'Number of retries for this orchestrator run; zero-based.';


--
-- TOC entry 5472 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN orchestrator_runs.run_options_json; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.orchestrator_runs.run_options_json IS 'Optional run-time options payload captured at trigger time (e.g., environment, concurrency, execution flags).';


--
-- TOC entry 250 (class 1259 OID 17208)
-- Name: pipeline_node_runs; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.pipeline_node_runs (
    node_run_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_run_id uuid NOT NULL,
    node_id_in_ir_text text NOT NULL,
    node_display_name text,
    node_status_code text NOT NULL,
    start_dtm timestamp with time zone,
    end_dtm timestamp with time zone,
    node_metrics_json jsonb,
    rows_in_num bigint,
    rows_out_num bigint,
    error_message_text text
);


ALTER TABLE execution.pipeline_node_runs OWNER TO postgres;

--
-- TOC entry 5473 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE pipeline_node_runs; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.pipeline_node_runs IS 'Granular per-node telemetry for every DAG node within a pipeline run.';


--
-- TOC entry 5474 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.node_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.node_run_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5475 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.pipeline_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.pipeline_run_id IS 'FK to the parent pipeline run; cascade-deleted when run is purged.';


--
-- TOC entry 5476 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.node_id_in_ir_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.node_id_in_ir_text IS 'Node identifier from the pipeline IR; correlates to pipeline_contents.ir_payload_json.';


--
-- TOC entry 5477 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.node_display_name; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.node_display_name IS 'Human-readable node label for UI display (copied from IR at execution time).';


--
-- TOC entry 5478 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.node_status_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.node_status_code IS 'Node execution state: PENDING, RUNNING, SUCCESS, FAILED, SKIPPED.';


--
-- TOC entry 5479 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.start_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.start_dtm IS 'Timestamp when this node began processing.';


--
-- TOC entry 5480 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.end_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.end_dtm IS 'Timestamp when this node reached a terminal state.';


--
-- TOC entry 5481 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.node_metrics_json; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.node_metrics_json IS 'JSONB telemetry: input_row_count, output_row_count, bytes_read, bytes_written, spill_mb.';


--
-- TOC entry 5482 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.rows_in_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.rows_in_num IS 'Input row count for this node; populated at node completion.';


--
-- TOC entry 5483 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.rows_out_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.rows_out_num IS 'Output row count produced by this node; populated at node completion.';


--
-- TOC entry 5484 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN pipeline_node_runs.error_message_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_node_runs.error_message_text IS 'Error message when node_status_code is FAILED.';


--
-- TOC entry 252 (class 1259 OID 17228)
-- Name: pipeline_run_logs; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.pipeline_run_logs (
    log_id bigint NOT NULL,
    pipeline_run_id uuid NOT NULL,
    log_level_code text NOT NULL,
    log_source_code text,
    log_message_text text NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE execution.pipeline_run_logs OWNER TO postgres;

--
-- TOC entry 5485 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE pipeline_run_logs; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.pipeline_run_logs IS 'Chronological log stream from Spark driver and executors for a pipeline run.';


--
-- TOC entry 5486 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN pipeline_run_logs.log_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_logs.log_id IS 'Sequential surrogate key; BIGSERIAL preserves insertion order.';


--
-- TOC entry 5487 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN pipeline_run_logs.pipeline_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_logs.pipeline_run_id IS 'FK to the parent pipeline run.';


--
-- TOC entry 5488 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN pipeline_run_logs.log_level_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_logs.log_level_code IS 'Log severity: DEBUG, INFO, WARN, ERROR, FATAL.';


--
-- TOC entry 5489 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN pipeline_run_logs.log_source_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_logs.log_source_code IS 'Origin of the log line: DRIVER, EXECUTOR_n, SYSTEM_FINALIZER.';


--
-- TOC entry 5490 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN pipeline_run_logs.log_message_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_logs.log_message_text IS 'Raw log message text from the Spark runtime.';


--
-- TOC entry 5491 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN pipeline_run_logs.created_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_logs.created_dtm IS 'Timestamp when this log line was received and stored.';


--
-- TOC entry 251 (class 1259 OID 17227)
-- Name: pipeline_run_logs_log_id_seq; Type: SEQUENCE; Schema: execution; Owner: postgres
--

CREATE SEQUENCE execution.pipeline_run_logs_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE execution.pipeline_run_logs_log_id_seq OWNER TO postgres;

--
-- TOC entry 5492 (class 0 OID 0)
-- Dependencies: 251
-- Name: pipeline_run_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: execution; Owner: postgres
--

ALTER SEQUENCE execution.pipeline_run_logs_log_id_seq OWNED BY execution.pipeline_run_logs.log_id;


--
-- TOC entry 254 (class 1259 OID 17248)
-- Name: pipeline_run_metrics; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.pipeline_run_metrics (
    metric_id bigint NOT NULL,
    pipeline_run_id uuid NOT NULL,
    metric_name_text text NOT NULL,
    metric_value_num numeric NOT NULL,
    recorded_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE execution.pipeline_run_metrics OWNER TO postgres;

--
-- TOC entry 5493 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE pipeline_run_metrics; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.pipeline_run_metrics IS 'Numeric telemetry time-series for a pipeline run.';


--
-- TOC entry 5494 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN pipeline_run_metrics.metric_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_metrics.metric_id IS 'Sequential surrogate key; BIGSERIAL for ordering.';


--
-- TOC entry 5495 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN pipeline_run_metrics.pipeline_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_metrics.pipeline_run_id IS 'FK to the parent pipeline run.';


--
-- TOC entry 5496 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN pipeline_run_metrics.metric_name_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_metrics.metric_name_text IS 'Metric identifier (e.g., input_rows, output_rows, bytes_written, executor_memory_mb).';


--
-- TOC entry 5497 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN pipeline_run_metrics.metric_value_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_metrics.metric_value_num IS 'Numeric measurement at the time of recording.';


--
-- TOC entry 5498 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN pipeline_run_metrics.recorded_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_run_metrics.recorded_dtm IS 'Timestamp when this metric data point was captured.';


--
-- TOC entry 253 (class 1259 OID 17247)
-- Name: pipeline_run_metrics_metric_id_seq; Type: SEQUENCE; Schema: execution; Owner: postgres
--

CREATE SEQUENCE execution.pipeline_run_metrics_metric_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE execution.pipeline_run_metrics_metric_id_seq OWNER TO postgres;

--
-- TOC entry 5499 (class 0 OID 0)
-- Dependencies: 253
-- Name: pipeline_run_metrics_metric_id_seq; Type: SEQUENCE OWNED BY; Schema: execution; Owner: postgres
--

ALTER SEQUENCE execution.pipeline_run_metrics_metric_id_seq OWNED BY execution.pipeline_run_metrics.metric_id;


--
-- TOC entry 247 (class 1259 OID 17119)
-- Name: pipeline_runs; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.pipeline_runs (
    pipeline_run_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_id uuid NOT NULL,
    version_id uuid NOT NULL,
    env_id uuid,
    run_status_code text DEFAULT 'PENDING'::text NOT NULL,
    trigger_type_code text DEFAULT 'MANUAL'::text NOT NULL,
    external_engine_job_id text,
    triggered_by_user_id uuid,
    start_dtm timestamp with time zone,
    end_dtm timestamp with time zone,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    run_duration_ms integer,
    rows_processed_num bigint,
    bytes_read_num bigint,
    bytes_written_num bigint,
    error_message_text text,
    retry_count_num integer DEFAULT 0 NOT NULL,
    sla_status_code text DEFAULT 'N_A'::text NOT NULL,
    spark_ui_url_text text,
    run_options_json jsonb
);


ALTER TABLE execution.pipeline_runs OWNER TO postgres;

--
-- TOC entry 5500 (class 0 OID 0)
-- Dependencies: 247
-- Name: TABLE pipeline_runs; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.pipeline_runs IS 'One record per pipeline execution regardless of what triggered it.';


--
-- TOC entry 5501 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.pipeline_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.pipeline_run_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5502 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.pipeline_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.pipeline_id IS 'FK to the pipeline that was executed.';


--
-- TOC entry 5503 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.version_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.version_id IS 'FK to the exact version that was deployed during this run.';


--
-- TOC entry 5504 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.env_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.env_id IS 'FK to the environment (DEV/QA/PROD) where the run executed.';


--
-- TOC entry 5505 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.run_status_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.run_status_code IS 'Execution lifecycle: PENDING, RUNNING, SUCCESS, FAILED, KILLED.';


--
-- TOC entry 5506 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.trigger_type_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.trigger_type_code IS 'How this run was initiated: MANUAL, ORCHESTRATOR, SCHEDULE, EVENT, API.';


--
-- TOC entry 5507 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.external_engine_job_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.external_engine_job_id IS 'Spark Application ID for cross-referencing cluster-level logs.';


--
-- TOC entry 5508 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.triggered_by_user_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.triggered_by_user_id IS 'FK to the user for MANUAL triggers; NULL for automated triggers.';


--
-- TOC entry 5509 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.start_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.start_dtm IS 'Timestamp when the Spark job began executing on the cluster.';


--
-- TOC entry 5510 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.end_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.end_dtm IS 'Timestamp when the run reached a terminal state.';


--
-- TOC entry 5511 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.created_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.created_dtm IS 'Timestamp when the run record was created in PENDING state.';


--
-- TOC entry 5512 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.run_duration_ms; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.run_duration_ms IS 'Elapsed milliseconds from start_dtm to end_dtm; populated on terminal state transition.';


--
-- TOC entry 5513 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.rows_processed_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.rows_processed_num IS 'Total rows processed across all nodes in the run; populated by the execution engine.';


--
-- TOC entry 5514 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.bytes_read_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.bytes_read_num IS 'Total bytes read from all source datasets in the run.';


--
-- TOC entry 5515 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.bytes_written_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.bytes_written_num IS 'Total bytes written to all target datasets in the run.';


--
-- TOC entry 5516 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.error_message_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.error_message_text IS 'Human-readable error summary when run_status_code is FAILED or KILLED.';


--
-- TOC entry 5517 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.retry_count_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.retry_count_num IS 'Number of retries attempted for this logical run; zero-based.';


--
-- TOC entry 5518 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.sla_status_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.sla_status_code IS 'SLA compliance result: N_A, MET, BREACHED. Populated at run completion.';


--
-- TOC entry 5519 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.spark_ui_url_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.spark_ui_url_text IS 'URL to the Spark History Server entry for this run; populated when Spark job is submitted.';


--
-- TOC entry 5520 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN pipeline_runs.run_options_json; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.pipeline_runs.run_options_json IS 'Optional run-time options payload captured at trigger time (e.g., environment, technology, overrides).';


--
-- TOC entry 280 (class 1259 OID 17875)
-- Name: run_artifacts; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.run_artifacts (
    artifact_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_run_id uuid NOT NULL,
    artifact_type_code text NOT NULL,
    artifact_name_text text NOT NULL,
    storage_uri_text text NOT NULL,
    artifact_size_bytes bigint,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE execution.run_artifacts OWNER TO postgres;

--
-- TOC entry 5521 (class 0 OID 0)
-- Dependencies: 280
-- Name: TABLE run_artifacts; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.run_artifacts IS 'Files and outputs produced by a pipeline run. Used for debugging, compliance, and reproducibility.';


--
-- TOC entry 5522 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN run_artifacts.artifact_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_artifacts.artifact_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5523 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN run_artifacts.pipeline_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_artifacts.pipeline_run_id IS 'FK to the pipeline run that produced this artifact.';


--
-- TOC entry 5524 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN run_artifacts.artifact_type_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_artifacts.artifact_type_code IS 'Category: GENERATED_CODE (PySpark/Scala file), OUTPUT_FILE (result data), PROFILING_REPORT, ERROR_REPORT, LINEAGE_SNAPSHOT.';


--
-- TOC entry 5525 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN run_artifacts.artifact_name_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_artifacts.artifact_name_text IS 'Human-readable file name for display in the run detail UI.';


--
-- TOC entry 5526 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN run_artifacts.storage_uri_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_artifacts.storage_uri_text IS 'Object storage path where the artifact is persisted (e.g., s3://etl-artifacts/runs/...).';


--
-- TOC entry 5527 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN run_artifacts.artifact_size_bytes; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_artifacts.artifact_size_bytes IS 'File size in bytes, useful for storage monitoring.';


--
-- TOC entry 5528 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN run_artifacts.created_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_artifacts.created_dtm IS 'Timestamp when the artifact was stored.';


--
-- TOC entry 282 (class 1259 OID 17921)
-- Name: run_lineage; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.run_lineage (
    run_lineage_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_run_id uuid NOT NULL,
    src_dataset_id uuid,
    src_column_name_text text,
    tgt_dataset_id uuid,
    tgt_column_name_text text,
    rows_read_num bigint,
    rows_written_num bigint,
    transformation_desc_text text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE execution.run_lineage OWNER TO postgres;

--
-- TOC entry 5529 (class 0 OID 0)
-- Dependencies: 282
-- Name: TABLE run_lineage; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.run_lineage IS 'Runtime column-level lineage captured during actual pipeline execution. Complements catalog.data_lineage (design-time). Each row records one column-to-column flow for a specific run, including actual row counts observed at runtime.';


--
-- TOC entry 5530 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN run_lineage.run_lineage_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_lineage.run_lineage_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5531 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN run_lineage.pipeline_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_lineage.pipeline_run_id IS 'FK to the pipeline run during which this lineage was observed.';


--
-- TOC entry 5532 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN run_lineage.src_dataset_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_lineage.src_dataset_id IS 'FK to the source dataset data was read from. NULL for computed-only columns.';


--
-- TOC entry 5533 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN run_lineage.src_column_name_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_lineage.src_column_name_text IS 'Source column name as observed at runtime.';


--
-- TOC entry 5534 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN run_lineage.tgt_dataset_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_lineage.tgt_dataset_id IS 'FK to the target dataset data was written to.';


--
-- TOC entry 5535 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN run_lineage.tgt_column_name_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_lineage.tgt_column_name_text IS 'Target column name as observed at runtime.';


--
-- TOC entry 5536 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN run_lineage.rows_read_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_lineage.rows_read_num IS 'Actual number of rows read from the source in this run. NULL if not tracked at column level.';


--
-- TOC entry 5537 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN run_lineage.rows_written_num; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_lineage.rows_written_num IS 'Actual number of rows written to the target in this run.';


--
-- TOC entry 5538 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN run_lineage.transformation_desc_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_lineage.transformation_desc_text IS 'Transformation applied (e.g., CAST, UPPER, CONCAT). Mirrors the design-time description with any runtime-resolved overrides.';


--
-- TOC entry 5539 (class 0 OID 0)
-- Dependencies: 282
-- Name: COLUMN run_lineage.created_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_lineage.created_dtm IS 'Timestamp when this runtime lineage record was captured.';


--
-- TOC entry 269 (class 1259 OID 17607)
-- Name: run_parameters; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.run_parameters (
    run_param_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_run_id uuid NOT NULL,
    param_key_name text NOT NULL,
    param_value_text text
);


ALTER TABLE execution.run_parameters OWNER TO postgres;

--
-- TOC entry 5540 (class 0 OID 0)
-- Dependencies: 269
-- Name: TABLE run_parameters; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.run_parameters IS 'The exact parameter values used during a specific pipeline run. Enables full reproducibility and debugging of historic executions.';


--
-- TOC entry 5541 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN run_parameters.run_param_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_parameters.run_param_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5542 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN run_parameters.pipeline_run_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_parameters.pipeline_run_id IS 'FK to the pipeline run that consumed these parameters.';


--
-- TOC entry 5543 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN run_parameters.param_key_name; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_parameters.param_key_name IS 'Parameter key matching catalog.pipeline_parameters.param_key_name.';


--
-- TOC entry 5544 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN run_parameters.param_value_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.run_parameters.param_value_text IS 'Serialized value used for this run. NULL if the default was applied.';


--
-- TOC entry 270 (class 1259 OID 17625)
-- Name: schedules; Type: TABLE; Schema: execution; Owner: postgres
--

CREATE TABLE execution.schedules (
    schedule_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type_code text NOT NULL,
    entity_id uuid NOT NULL,
    cron_expression_text text NOT NULL,
    timezone_name_text text DEFAULT 'UTC'::text NOT NULL,
    env_id uuid,
    is_schedule_active boolean DEFAULT true NOT NULL,
    next_run_dtm timestamp with time zone,
    last_run_dtm timestamp with time zone,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid
);


ALTER TABLE execution.schedules OWNER TO postgres;

--
-- TOC entry 5545 (class 0 OID 0)
-- Dependencies: 270
-- Name: TABLE schedules; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON TABLE execution.schedules IS 'Cron-based trigger schedules for pipelines and orchestrators. Referenced by trigger_type_code = SCHEDULE in pipeline_runs and orchestrator_runs.';


--
-- TOC entry 5546 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.schedule_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.schedule_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5547 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.entity_type_code; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.entity_type_code IS 'Entity being scheduled: PIPELINE or ORCHESTRATOR.';


--
-- TOC entry 5548 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.entity_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.entity_id IS 'UUID of the scheduled entity (pipeline_id or orch_id).';


--
-- TOC entry 5549 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.cron_expression_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.cron_expression_text IS 'Standard 5-field cron expression (e.g., 0 2 * * * = 2 AM daily). Validated by the scheduler engine.';


--
-- TOC entry 5550 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.timezone_name_text; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.timezone_name_text IS 'IANA timezone name for cron evaluation (e.g., America/New_York, UTC).';


--
-- TOC entry 5551 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.env_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.env_id IS 'Target deployment environment for scheduled runs.';


--
-- TOC entry 5552 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.is_schedule_active; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.is_schedule_active IS 'FALSE to pause a schedule without deleting it.';


--
-- TOC entry 5553 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.next_run_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.next_run_dtm IS 'Computed next fire time. Updated by the scheduler after each execution.';


--
-- TOC entry 5554 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.last_run_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.last_run_dtm IS 'Timestamp of the most recent triggered execution.';


--
-- TOC entry 5555 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.created_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.created_dtm IS 'Timestamp when this schedule was defined.';


--
-- TOC entry 5556 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.updated_dtm; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.updated_dtm IS 'Timestamp of the last schedule configuration change.';


--
-- TOC entry 5557 (class 0 OID 0)
-- Dependencies: 270
-- Name: COLUMN schedules.created_by_user_id; Type: COMMENT; Schema: execution; Owner: postgres
--

COMMENT ON COLUMN execution.schedules.created_by_user_id IS 'FK to the user who created this schedule.';


--
-- TOC entry 265 (class 1259 OID 17493)
-- Name: connector_access; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.connector_access (
    access_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    connector_id uuid NOT NULL,
    user_id uuid,
    role_id uuid,
    granted_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    granted_by_user_id uuid,
    CONSTRAINT ck_connector_access_subject CHECK (((user_id IS NOT NULL) OR (role_id IS NOT NULL)))
);


ALTER TABLE gov.connector_access OWNER TO postgres;

--
-- TOC entry 5558 (class 0 OID 0)
-- Dependencies: 265
-- Name: TABLE connector_access; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.connector_access IS 'Per-connector access grants controlling which users or roles may use a given connector. Prevents unrestricted access to production credentials.';


--
-- TOC entry 5559 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN connector_access.access_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.connector_access.access_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5560 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN connector_access.connector_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.connector_access.connector_id IS 'FK to the connector being access-controlled.';


--
-- TOC entry 5561 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN connector_access.user_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.connector_access.user_id IS 'FK to a specific user granted access. Mutually optional with role_id but at least one is required.';


--
-- TOC entry 5562 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN connector_access.role_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.connector_access.role_id IS 'FK to a role whose members are granted access. Mutually optional with user_id but at least one is required.';


--
-- TOC entry 5563 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN connector_access.granted_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.connector_access.granted_dtm IS 'Timestamp when access was granted.';


--
-- TOC entry 5564 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN connector_access.granted_by_user_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.connector_access.granted_by_user_id IS 'FK to the administrator who granted the access.';


--
-- TOC entry 266 (class 1259 OID 17524)
-- Name: data_classifications; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.data_classifications (
    classification_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    target_type_code text NOT NULL,
    target_id uuid NOT NULL,
    sensitivity_code text NOT NULL,
    classification_notes_text text,
    classified_by_user_id uuid,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE gov.data_classifications OWNER TO postgres;

--
-- TOC entry 5565 (class 0 OID 0)
-- Dependencies: 266
-- Name: TABLE data_classifications; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.data_classifications IS 'Compliance sensitivity labels on datasets and columns. Drives masking, access restrictions, and audit requirements.';


--
-- TOC entry 5566 (class 0 OID 0)
-- Dependencies: 266
-- Name: COLUMN data_classifications.classification_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_classifications.classification_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5567 (class 0 OID 0)
-- Dependencies: 266
-- Name: COLUMN data_classifications.target_type_code; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_classifications.target_type_code IS 'Entity being classified: DATASET or COLUMN.';


--
-- TOC entry 5568 (class 0 OID 0)
-- Dependencies: 266
-- Name: COLUMN data_classifications.target_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_classifications.target_id IS 'UUID of the classified entity (dataset_id or column_id).';


--
-- TOC entry 5569 (class 0 OID 0)
-- Dependencies: 266
-- Name: COLUMN data_classifications.sensitivity_code; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_classifications.sensitivity_code IS 'Regulatory/business sensitivity tier: PII, PHI, FINANCIAL, CONFIDENTIAL, INTERNAL, PUBLIC.';


--
-- TOC entry 5570 (class 0 OID 0)
-- Dependencies: 266
-- Name: COLUMN data_classifications.classification_notes_text; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_classifications.classification_notes_text IS 'Optional justification or notes from the data steward.';


--
-- TOC entry 5571 (class 0 OID 0)
-- Dependencies: 266
-- Name: COLUMN data_classifications.classified_by_user_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_classifications.classified_by_user_id IS 'FK to the data steward who applied this classification.';


--
-- TOC entry 5572 (class 0 OID 0)
-- Dependencies: 266
-- Name: COLUMN data_classifications.created_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_classifications.created_dtm IS 'Timestamp when the classification was first applied.';


--
-- TOC entry 5573 (class 0 OID 0)
-- Dependencies: 266
-- Name: COLUMN data_classifications.updated_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_classifications.updated_dtm IS 'Timestamp when the classification was last changed.';


--
-- TOC entry 259 (class 1259 OID 17369)
-- Name: data_contracts; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.data_contracts (
    contract_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dataset_id uuid NOT NULL,
    sla_availability_pct numeric,
    sla_freshness_sec integer,
    contact_email_addr text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT data_contracts_sla_availability_pct_check CHECK (((sla_availability_pct >= (0)::numeric) AND (sla_availability_pct <= (100)::numeric)))
);


ALTER TABLE gov.data_contracts OWNER TO postgres;

--
-- TOC entry 5574 (class 0 OID 0)
-- Dependencies: 259
-- Name: TABLE data_contracts; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.data_contracts IS 'Formal SLA agreements defining availability and freshness expectations for datasets.';


--
-- TOC entry 5575 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN data_contracts.contract_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_contracts.contract_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5576 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN data_contracts.dataset_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_contracts.dataset_id IS 'FK to the dataset this contract governs.';


--
-- TOC entry 5577 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN data_contracts.sla_availability_pct; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_contracts.sla_availability_pct IS 'Required uptime percentage (e.g., 99.9).';


--
-- TOC entry 5578 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN data_contracts.sla_freshness_sec; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_contracts.sla_freshness_sec IS 'Maximum allowed data age in seconds before the SLA is considered breached.';


--
-- TOC entry 5579 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN data_contracts.contact_email_addr; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_contracts.contact_email_addr IS 'On-call contact email for SLA breach notifications.';


--
-- TOC entry 5580 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN data_contracts.created_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.data_contracts.created_dtm IS 'Timestamp when this contract was established.';


--
-- TOC entry 257 (class 1259 OID 17322)
-- Name: dq_results; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.dq_results (
    result_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_run_id uuid NOT NULL,
    rule_id uuid,
    passed_flag boolean NOT NULL,
    actual_value_text text,
    error_message_text text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE gov.dq_results OWNER TO postgres;

--
-- TOC entry 5581 (class 0 OID 0)
-- Dependencies: 257
-- Name: TABLE dq_results; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.dq_results IS 'Runtime evaluation results for DQ rules executed within a pipeline run.';


--
-- TOC entry 5582 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN dq_results.result_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_results.result_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5583 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN dq_results.pipeline_run_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_results.pipeline_run_id IS 'FK to the pipeline run during which this DQ check was evaluated.';


--
-- TOC entry 5584 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN dq_results.rule_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_results.rule_id IS 'FK to the DQ rule that was evaluated. NULL for ad-hoc assertions.';


--
-- TOC entry 5585 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN dq_results.passed_flag; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_results.passed_flag IS 'TRUE if data satisfied the rule; FALSE triggers severity-based action (log/alert/fail).';


--
-- TOC entry 5586 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN dq_results.actual_value_text; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_results.actual_value_text IS 'The observed metric value at evaluation time (e.g., "982" rows vs threshold "1000").';


--
-- TOC entry 5587 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN dq_results.error_message_text; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_results.error_message_text IS 'Human-readable failure description when passed_flag is FALSE.';


--
-- TOC entry 5588 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN dq_results.created_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_results.created_dtm IS 'Timestamp when this DQ result was recorded.';


--
-- TOC entry 256 (class 1259 OID 17301)
-- Name: dq_rules; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.dq_rules (
    rule_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    target_type_code text NOT NULL,
    target_id uuid NOT NULL,
    rule_type_code text NOT NULL,
    rule_config_json jsonb NOT NULL,
    severity_code text DEFAULT 'ERROR'::text NOT NULL,
    is_active_flag boolean DEFAULT true NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE gov.dq_rules OWNER TO postgres;

--
-- TOC entry 5589 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE dq_rules; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.dq_rules IS 'Declarative data quality validation rules applicable to datasets, columns, or pipeline sinks.';


--
-- TOC entry 5590 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN dq_rules.rule_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_rules.rule_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5591 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN dq_rules.target_type_code; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_rules.target_type_code IS 'Entity this rule applies to: DATASET, COLUMN, PIPELINE_SINK.';


--
-- TOC entry 5592 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN dq_rules.target_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_rules.target_id IS 'UUID of the target entity (dataset_id, column_id, etc.).';


--
-- TOC entry 5593 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN dq_rules.rule_type_code; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_rules.rule_type_code IS 'Rule category: NULL_CHECK, ROW_COUNT_THRESHOLD, SCHEMA_DRIFT, REGEX, UNIQUENESS.';


--
-- TOC entry 5594 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN dq_rules.rule_config_json; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_rules.rule_config_json IS 'JSONB parameters for the rule (e.g., {"threshold": 1000, "operator": "GT"}).';


--
-- TOC entry 5595 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN dq_rules.severity_code; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_rules.severity_code IS 'Failure impact: INFO (log only), WARNING (alert), ERROR (fail job).';


--
-- TOC entry 5596 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN dq_rules.is_active_flag; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_rules.is_active_flag IS 'FALSE to suspend a rule without deleting its history.';


--
-- TOC entry 5597 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN dq_rules.created_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_rules.created_dtm IS 'Record creation timestamp.';


--
-- TOC entry 5598 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN dq_rules.updated_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.dq_rules.updated_dtm IS 'Timestamp of the last rule configuration change.';


--
-- TOC entry 258 (class 1259 OID 17345)
-- Name: glossary_terms; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.glossary_terms (
    term_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    term_display_name text NOT NULL,
    term_def_text text NOT NULL,
    owner_user_id uuid,
    approval_status_code text DEFAULT 'DRAFT'::text NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE gov.glossary_terms OWNER TO postgres;

--
-- TOC entry 5599 (class 0 OID 0)
-- Dependencies: 258
-- Name: TABLE glossary_terms; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.glossary_terms IS 'Enterprise business vocabulary for standardizing data definitions.';


--
-- TOC entry 5600 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN glossary_terms.term_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.glossary_terms.term_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5601 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN glossary_terms.term_display_name; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.glossary_terms.term_display_name IS 'Unique business term (e.g., "Customer Lifetime Value").';


--
-- TOC entry 5602 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN glossary_terms.term_def_text; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.glossary_terms.term_def_text IS 'Full formal definition of the term as agreed by the data governance board.';


--
-- TOC entry 5603 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN glossary_terms.owner_user_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.glossary_terms.owner_user_id IS 'FK to the data steward responsible for this term.';


--
-- TOC entry 5604 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN glossary_terms.approval_status_code; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.glossary_terms.approval_status_code IS 'Lifecycle: DRAFT, IN_REVIEW, APPROVED, DEPRECATED.';


--
-- TOC entry 5605 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN glossary_terms.created_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.glossary_terms.created_dtm IS 'Record creation timestamp.';


--
-- TOC entry 5606 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN glossary_terms.updated_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.glossary_terms.updated_dtm IS 'Timestamp of the last definition update.';


--
-- TOC entry 277 (class 1259 OID 17809)
-- Name: notification_rules; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.notification_rules (
    notification_rule_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type_code text NOT NULL,
    entity_id uuid NOT NULL,
    event_type_code text NOT NULL,
    channel_type_code text NOT NULL,
    channel_target_text text NOT NULL,
    is_rule_active_flag boolean DEFAULT true NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid
);


ALTER TABLE gov.notification_rules OWNER TO postgres;

--
-- TOC entry 5607 (class 0 OID 0)
-- Dependencies: 277
-- Name: TABLE notification_rules; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.notification_rules IS 'Alert routing rules for platform events. Each row specifies what event on which entity should fire an alert to which channel.';


--
-- TOC entry 5608 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN notification_rules.notification_rule_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.notification_rules.notification_rule_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5609 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN notification_rules.entity_type_code; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.notification_rules.entity_type_code IS 'The type of entity being watched: PIPELINE, ORCHESTRATOR, or DATASET.';


--
-- TOC entry 5610 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN notification_rules.entity_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.notification_rules.entity_id IS 'UUID of the watched entity (pipeline_id, orch_id, or dataset_id).';


--
-- TOC entry 5611 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN notification_rules.event_type_code; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.notification_rules.event_type_code IS 'Triggering event: RUN_FAILURE, RUN_SUCCESS, DQ_BREACH, SLA_VIOLATION, RUN_START.';


--
-- TOC entry 5612 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN notification_rules.channel_type_code; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.notification_rules.channel_type_code IS 'Delivery channel: EMAIL, SLACK, WEBHOOK, PAGERDUTY.';


--
-- TOC entry 5613 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN notification_rules.channel_target_text; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.notification_rules.channel_target_text IS 'Channel destination: email address, Slack webhook URL, or generic webhook URL.';


--
-- TOC entry 5614 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN notification_rules.is_rule_active_flag; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.notification_rules.is_rule_active_flag IS 'FALSE to mute notifications without deleting the rule.';


--
-- TOC entry 5615 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN notification_rules.created_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.notification_rules.created_dtm IS 'Timestamp when this notification rule was created.';


--
-- TOC entry 5616 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN notification_rules.created_by_user_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.notification_rules.created_by_user_id IS 'FK to the user who created this alert rule.';


--
-- TOC entry 230 (class 1259 OID 16694)
-- Name: permissions; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.permissions (
    permission_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    perm_code_name text NOT NULL,
    perm_display_name text NOT NULL,
    perm_desc_text text,
    is_system_flag boolean DEFAULT false NOT NULL
);


ALTER TABLE gov.permissions OWNER TO postgres;

--
-- TOC entry 5617 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE permissions; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.permissions IS 'Atomic, system-defined access rights (e.g., pipeline.publish, user.delete).';


--
-- TOC entry 5618 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN permissions.permission_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.permissions.permission_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5619 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN permissions.perm_code_name; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.permissions.perm_code_name IS 'Machine-readable permission code (e.g., PIPELINE_PUBLISH). Must be unique.';


--
-- TOC entry 5620 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN permissions.perm_display_name; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.permissions.perm_display_name IS 'Human-readable label for the permission to display in the Admin UI.';


--
-- TOC entry 5621 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN permissions.perm_desc_text; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.permissions.perm_desc_text IS 'Detailed explanation of what this permission grants.';


--
-- TOC entry 5622 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN permissions.is_system_flag; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.permissions.is_system_flag IS 'TRUE for permissions seeded by the platform. Cannot be deleted or modified.';


--
-- TOC entry 264 (class 1259 OID 17463)
-- Name: project_user_roles; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.project_user_roles (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    granted_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    granted_by_user_id uuid
);


ALTER TABLE gov.project_user_roles OWNER TO postgres;

--
-- TOC entry 5623 (class 0 OID 0)
-- Dependencies: 264
-- Name: TABLE project_user_roles; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.project_user_roles IS 'Project-scoped role assignments. A user may be ADMIN in Project A but only VIEWER in Project B. Extends the global gov.user_roles with project context.';


--
-- TOC entry 5624 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN project_user_roles.project_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.project_user_roles.project_id IS 'FK to the project this role assignment is scoped to.';


--
-- TOC entry 5625 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN project_user_roles.user_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.project_user_roles.user_id IS 'FK to the user receiving the project-scoped role.';


--
-- TOC entry 5626 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN project_user_roles.role_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.project_user_roles.role_id IS 'FK to the role granted within this project.';


--
-- TOC entry 5627 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN project_user_roles.granted_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.project_user_roles.granted_dtm IS 'Timestamp when the project role was granted.';


--
-- TOC entry 5628 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN project_user_roles.granted_by_user_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.project_user_roles.granted_by_user_id IS 'FK to the administrator who granted this project role.';


--
-- TOC entry 232 (class 1259 OID 16725)
-- Name: role_permissions; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


ALTER TABLE gov.role_permissions OWNER TO postgres;

--
-- TOC entry 5629 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE role_permissions; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.role_permissions IS 'M2M mapping granting permissions to roles.';


--
-- TOC entry 5630 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN role_permissions.role_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.role_permissions.role_id IS 'FK to gov.roles.';


--
-- TOC entry 5631 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN role_permissions.permission_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.role_permissions.permission_id IS 'FK to gov.permissions.';


--
-- TOC entry 231 (class 1259 OID 16709)
-- Name: roles; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.roles (
    role_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    role_display_name text NOT NULL,
    role_desc_text text,
    is_system_role_flag boolean DEFAULT false NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE gov.roles OWNER TO postgres;

--
-- TOC entry 5632 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE roles; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.roles IS 'Named bundles of permissions assigned to users (e.g., ADMIN, DEVELOPER, VIEWER).';


--
-- TOC entry 5633 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN roles.role_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.roles.role_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5634 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN roles.role_display_name; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.roles.role_display_name IS 'Unique human-readable label for the role.';


--
-- TOC entry 5635 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN roles.role_desc_text; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.roles.role_desc_text IS 'Description of the role''s scope and responsibilities.';


--
-- TOC entry 5636 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN roles.is_system_role_flag; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.roles.is_system_role_flag IS 'TRUE for built-in roles (SUPER_ADMIN) that cannot be deleted via the UI.';


--
-- TOC entry 5637 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN roles.created_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.roles.created_dtm IS 'Timestamp when this role was defined.';


--
-- TOC entry 234 (class 1259 OID 16759)
-- Name: secrets; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.secrets (
    secret_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    secret_key_name text NOT NULL,
    secret_value_encrypted text NOT NULL,
    vault_provider_type text DEFAULT 'INTERNAL'::text NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE gov.secrets OWNER TO postgres;

--
-- TOC entry 5638 (class 0 OID 0)
-- Dependencies: 234
-- Name: TABLE secrets; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.secrets IS 'Encrypted vault for connector credentials and API keys.';


--
-- TOC entry 5639 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN secrets.secret_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.secrets.secret_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5640 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN secrets.secret_key_name; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.secrets.secret_key_name IS 'Logical name for referencing this secret (e.g., PROD_SNOWFLAKE_PWD).';


--
-- TOC entry 5641 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN secrets.secret_value_encrypted; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.secrets.secret_value_encrypted IS 'pgp_sym_encrypt output. Decrypted at runtime using app.encryption_key session variable.';


--
-- TOC entry 5642 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN secrets.vault_provider_type; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.secrets.vault_provider_type IS 'Where the secret originates: INTERNAL, AWS_SECRETS_MANAGER, HASHICORP_VAULT, GCP_SECRET_MANAGER.';


--
-- TOC entry 5643 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN secrets.created_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.secrets.created_dtm IS 'Timestamp when the secret was first stored.';


--
-- TOC entry 5644 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN secrets.updated_dtm; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.secrets.updated_dtm IS 'Timestamp of the last rotation or update.';


--
-- TOC entry 233 (class 1259 OID 16742)
-- Name: user_roles; Type: TABLE; Schema: gov; Owner: postgres
--

CREATE TABLE gov.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


ALTER TABLE gov.user_roles OWNER TO postgres;

--
-- TOC entry 5645 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE user_roles; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON TABLE gov.user_roles IS 'M2M mapping assigning roles to platform users.';


--
-- TOC entry 5646 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN user_roles.user_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.user_roles.user_id IS 'FK to etl.users.';


--
-- TOC entry 5647 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN user_roles.role_id; Type: COMMENT; Schema: gov; Owner: postgres
--

COMMENT ON COLUMN gov.user_roles.role_id IS 'FK to gov.roles.';


--
-- TOC entry 318 (class 1259 OID 18337)
-- Name: cdc_configurations_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.cdc_configurations_history (
    cdc_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT cdc_configurations_cdc_id_not_null NOT NULL,
    dataset_id uuid CONSTRAINT cdc_configurations_dataset_id_not_null NOT NULL,
    cdc_mode_code text CONSTRAINT cdc_configurations_cdc_mode_code_not_null NOT NULL,
    watermark_column_name text,
    cdc_config_json jsonb,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT cdc_configurations_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT cdc_configurations_updated_dtm_not_null NOT NULL,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.cdc_configurations_history OWNER TO postgres;

--
-- TOC entry 5648 (class 0 OID 0)
-- Dependencies: 318
-- Name: TABLE cdc_configurations_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.cdc_configurations_history IS 'Immutable row-image history for meta.cdc_configurations.';


--
-- TOC entry 5649 (class 0 OID 0)
-- Dependencies: 318
-- Name: COLUMN cdc_configurations_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.cdc_configurations_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5650 (class 0 OID 0)
-- Dependencies: 318
-- Name: COLUMN cdc_configurations_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.cdc_configurations_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5651 (class 0 OID 0)
-- Dependencies: 318
-- Name: COLUMN cdc_configurations_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.cdc_configurations_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5652 (class 0 OID 0)
-- Dependencies: 318
-- Name: COLUMN cdc_configurations_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.cdc_configurations_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 317 (class 1259 OID 18336)
-- Name: cdc_configurations_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.cdc_configurations_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.cdc_configurations_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5653 (class 0 OID 0)
-- Dependencies: 317
-- Name: cdc_configurations_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.cdc_configurations_history_hist_id_seq OWNED BY history.cdc_configurations_history.hist_id;


--
-- TOC entry 322 (class 1259 OID 18374)
-- Name: connector_health_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.connector_health_history (
    health_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT connector_health_health_id_not_null NOT NULL,
    connector_id uuid CONSTRAINT connector_health_connector_id_not_null NOT NULL,
    health_status_code text DEFAULT 'UNKNOWN'::text CONSTRAINT connector_health_health_status_code_not_null NOT NULL,
    check_latency_ms integer,
    check_error_text text,
    consecutive_fail_num integer DEFAULT 0 CONSTRAINT connector_health_consecutive_fail_num_not_null NOT NULL,
    last_check_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT connector_health_last_check_dtm_not_null NOT NULL,
    next_check_dtm timestamp with time zone,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.connector_health_history OWNER TO postgres;

--
-- TOC entry 5654 (class 0 OID 0)
-- Dependencies: 322
-- Name: TABLE connector_health_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.connector_health_history IS 'Immutable row-image history for catalog.connector_health. Tracks health status transitions over time for SLA reporting.';


--
-- TOC entry 5655 (class 0 OID 0)
-- Dependencies: 322
-- Name: COLUMN connector_health_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.connector_health_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5656 (class 0 OID 0)
-- Dependencies: 322
-- Name: COLUMN connector_health_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.connector_health_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5657 (class 0 OID 0)
-- Dependencies: 322
-- Name: COLUMN connector_health_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.connector_health_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5658 (class 0 OID 0)
-- Dependencies: 322
-- Name: COLUMN connector_health_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.connector_health_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 321 (class 1259 OID 18373)
-- Name: connector_health_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.connector_health_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.connector_health_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5659 (class 0 OID 0)
-- Dependencies: 321
-- Name: connector_health_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.connector_health_history_hist_id_seq OWNED BY history.connector_health_history.hist_id;


--
-- TOC entry 298 (class 1259 OID 18128)
-- Name: connectors_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.connectors_history (
    connector_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT connectors_connector_id_not_null NOT NULL,
    connector_display_name text CONSTRAINT connectors_connector_display_name_not_null NOT NULL,
    connector_type_code text CONSTRAINT connectors_connector_type_code_not_null NOT NULL,
    conn_config_json_encrypted text CONSTRAINT connectors_conn_config_json_encrypted_not_null NOT NULL,
    conn_secrets_json_encrypted text,
    conn_jdbc_driver_class text,
    conn_test_query text,
    conn_spark_config_json jsonb,
    conn_ssl_mode text DEFAULT 'REQUIRE'::text CONSTRAINT connectors_conn_ssl_mode_not_null NOT NULL,
    conn_ssh_tunnel_json_encrypted text,
    conn_proxy_json_encrypted text,
    conn_max_pool_size_num integer DEFAULT 5 CONSTRAINT connectors_conn_max_pool_size_num_not_null NOT NULL,
    conn_idle_timeout_sec integer DEFAULT 600 CONSTRAINT connectors_conn_idle_timeout_sec_not_null NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT connectors_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT connectors_updated_dtm_not_null NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.connectors_history OWNER TO postgres;

--
-- TOC entry 5660 (class 0 OID 0)
-- Dependencies: 298
-- Name: TABLE connectors_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.connectors_history IS 'Immutable row-image history for catalog.connectors.';


--
-- TOC entry 5661 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN connectors_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.connectors_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5662 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN connectors_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.connectors_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5663 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN connectors_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.connectors_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5664 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN connectors_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.connectors_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 297 (class 1259 OID 18127)
-- Name: connectors_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.connectors_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.connectors_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5665 (class 0 OID 0)
-- Dependencies: 297
-- Name: connectors_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.connectors_history_hist_id_seq OWNED BY history.connectors_history.hist_id;


--
-- TOC entry 308 (class 1259 OID 18232)
-- Name: data_classifications_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.data_classifications_history (
    classification_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT data_classifications_classification_id_not_null NOT NULL,
    target_type_code text CONSTRAINT data_classifications_target_type_code_not_null NOT NULL,
    target_id uuid CONSTRAINT data_classifications_target_id_not_null NOT NULL,
    sensitivity_code text CONSTRAINT data_classifications_sensitivity_code_not_null NOT NULL,
    classification_notes_text text,
    classified_by_user_id uuid,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT data_classifications_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT data_classifications_updated_dtm_not_null NOT NULL,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.data_classifications_history OWNER TO postgres;

--
-- TOC entry 5666 (class 0 OID 0)
-- Dependencies: 308
-- Name: TABLE data_classifications_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.data_classifications_history IS 'Immutable row-image history for gov.data_classifications. Required for compliance audit trails.';


--
-- TOC entry 5667 (class 0 OID 0)
-- Dependencies: 308
-- Name: COLUMN data_classifications_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.data_classifications_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5668 (class 0 OID 0)
-- Dependencies: 308
-- Name: COLUMN data_classifications_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.data_classifications_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5669 (class 0 OID 0)
-- Dependencies: 308
-- Name: COLUMN data_classifications_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.data_classifications_history.hist_action_dtm IS 'Timestamp when the classification was changed.';


--
-- TOC entry 5670 (class 0 OID 0)
-- Dependencies: 308
-- Name: COLUMN data_classifications_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.data_classifications_history.hist_action_by IS 'User ID who changed the classification.';


--
-- TOC entry 307 (class 1259 OID 18231)
-- Name: data_classifications_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.data_classifications_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.data_classifications_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5671 (class 0 OID 0)
-- Dependencies: 307
-- Name: data_classifications_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.data_classifications_history_hist_id_seq OWNED BY history.data_classifications_history.hist_id;


--
-- TOC entry 300 (class 1259 OID 18154)
-- Name: datasets_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.datasets_history (
    dataset_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT datasets_dataset_id_not_null NOT NULL,
    connector_id uuid CONSTRAINT datasets_connector_id_not_null NOT NULL,
    db_name_text text,
    schema_name_text text,
    table_name_text text CONSTRAINT datasets_table_name_text_not_null NOT NULL,
    dataset_type_code text DEFAULT 'TABLE'::text CONSTRAINT datasets_dataset_type_code_not_null NOT NULL,
    estimated_row_count_num bigint,
    last_introspection_dtm timestamp with time zone,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT datasets_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT datasets_updated_dtm_not_null NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.datasets_history OWNER TO postgres;

--
-- TOC entry 5672 (class 0 OID 0)
-- Dependencies: 300
-- Name: TABLE datasets_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.datasets_history IS 'Immutable row-image history for catalog.datasets.';


--
-- TOC entry 5673 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN datasets_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.datasets_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5674 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN datasets_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.datasets_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5675 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN datasets_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.datasets_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5676 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN datasets_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.datasets_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 299 (class 1259 OID 18153)
-- Name: datasets_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.datasets_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.datasets_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5677 (class 0 OID 0)
-- Dependencies: 299
-- Name: datasets_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.datasets_history_hist_id_seq OWNED BY history.datasets_history.hist_id;


--
-- TOC entry 324 (class 1259 OID 18394)
-- Name: file_format_options_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.file_format_options_history (
    format_option_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT file_format_options_format_option_id_not_null NOT NULL,
    connector_id uuid CONSTRAINT file_format_options_connector_id_not_null NOT NULL,
    file_format_code text CONSTRAINT file_format_options_file_format_code_not_null NOT NULL,
    field_separator_char text DEFAULT ','::text,
    decimal_separator_char text DEFAULT '.'::text,
    date_format_text text DEFAULT 'yyyy-MM-dd'::text,
    timestamp_format_text text DEFAULT 'yyyy-MM-dd HH:mm:ss'::text,
    encoding_standard_code text DEFAULT 'UTF-8'::text,
    has_header_flag boolean DEFAULT true,
    quote_char_text text DEFAULT '"'::text,
    escape_char_text text DEFAULT '\\'::text,
    null_value_text text,
    line_separator_text text,
    multiline_flag boolean DEFAULT false,
    sheet_name_text text,
    sheet_index_num integer DEFAULT 0,
    root_tag_text text,
    row_tag_text text,
    corrupt_record_mode text DEFAULT 'PERMISSIVE'::text,
    column_widths_text text,
    skip_rows_num integer DEFAULT 0,
    compression_code text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT file_format_options_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT file_format_options_updated_dtm_not_null NOT NULL,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.file_format_options_history OWNER TO postgres;

--
-- TOC entry 5678 (class 0 OID 0)
-- Dependencies: 324
-- Name: TABLE file_format_options_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.file_format_options_history IS 'Immutable row-image history for catalog.file_format_options.';


--
-- TOC entry 5679 (class 0 OID 0)
-- Dependencies: 324
-- Name: COLUMN file_format_options_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.file_format_options_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5680 (class 0 OID 0)
-- Dependencies: 324
-- Name: COLUMN file_format_options_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.file_format_options_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5681 (class 0 OID 0)
-- Dependencies: 324
-- Name: COLUMN file_format_options_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.file_format_options_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5682 (class 0 OID 0)
-- Dependencies: 324
-- Name: COLUMN file_format_options_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.file_format_options_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 323 (class 1259 OID 18393)
-- Name: file_format_options_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.file_format_options_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.file_format_options_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5683 (class 0 OID 0)
-- Dependencies: 323
-- Name: file_format_options_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.file_format_options_history_hist_id_seq OWNED BY history.file_format_options_history.hist_id;


--
-- TOC entry 290 (class 1259 OID 18051)
-- Name: folders_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.folders_history (
    folder_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT folders_folder_id_not_null NOT NULL,
    project_id uuid CONSTRAINT folders_project_id_not_null NOT NULL,
    parent_folder_id uuid,
    folder_display_name text CONSTRAINT folders_folder_display_name_not_null NOT NULL,
    hierarchical_path_ltree public.ltree CONSTRAINT folders_hierarchical_path_ltree_not_null NOT NULL,
    folder_type_code text CONSTRAINT folders_folder_type_code_not_null NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT folders_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT folders_updated_dtm_not_null NOT NULL,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.folders_history OWNER TO postgres;

--
-- TOC entry 5684 (class 0 OID 0)
-- Dependencies: 290
-- Name: TABLE folders_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.folders_history IS 'Immutable row-image history for etl.folders.';


--
-- TOC entry 5685 (class 0 OID 0)
-- Dependencies: 290
-- Name: COLUMN folders_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.folders_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5686 (class 0 OID 0)
-- Dependencies: 290
-- Name: COLUMN folders_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.folders_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5687 (class 0 OID 0)
-- Dependencies: 290
-- Name: COLUMN folders_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.folders_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5688 (class 0 OID 0)
-- Dependencies: 290
-- Name: COLUMN folders_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.folders_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 289 (class 1259 OID 18050)
-- Name: folders_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.folders_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.folders_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5689 (class 0 OID 0)
-- Dependencies: 289
-- Name: folders_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.folders_history_hist_id_seq OWNED BY history.folders_history.hist_id;


--
-- TOC entry 304 (class 1259 OID 18193)
-- Name: glossary_terms_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.glossary_terms_history (
    term_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT glossary_terms_term_id_not_null NOT NULL,
    term_display_name text CONSTRAINT glossary_terms_term_display_name_not_null NOT NULL,
    term_def_text text CONSTRAINT glossary_terms_term_def_text_not_null NOT NULL,
    owner_user_id uuid,
    approval_status_code text DEFAULT 'DRAFT'::text CONSTRAINT glossary_terms_approval_status_code_not_null NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT glossary_terms_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT glossary_terms_updated_dtm_not_null NOT NULL,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.glossary_terms_history OWNER TO postgres;

--
-- TOC entry 5690 (class 0 OID 0)
-- Dependencies: 304
-- Name: TABLE glossary_terms_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.glossary_terms_history IS 'Immutable row-image history for gov.glossary_terms.';


--
-- TOC entry 5691 (class 0 OID 0)
-- Dependencies: 304
-- Name: COLUMN glossary_terms_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.glossary_terms_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5692 (class 0 OID 0)
-- Dependencies: 304
-- Name: COLUMN glossary_terms_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.glossary_terms_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5693 (class 0 OID 0)
-- Dependencies: 304
-- Name: COLUMN glossary_terms_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.glossary_terms_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5694 (class 0 OID 0)
-- Dependencies: 304
-- Name: COLUMN glossary_terms_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.glossary_terms_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 303 (class 1259 OID 18192)
-- Name: glossary_terms_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.glossary_terms_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.glossary_terms_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5695 (class 0 OID 0)
-- Dependencies: 303
-- Name: glossary_terms_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.glossary_terms_history_hist_id_seq OWNED BY history.glossary_terms_history.hist_id;


--
-- TOC entry 314 (class 1259 OID 18297)
-- Name: notification_rules_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.notification_rules_history (
    notification_rule_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT notification_rules_notification_rule_id_not_null NOT NULL,
    entity_type_code text CONSTRAINT notification_rules_entity_type_code_not_null NOT NULL,
    entity_id uuid CONSTRAINT notification_rules_entity_id_not_null NOT NULL,
    event_type_code text CONSTRAINT notification_rules_event_type_code_not_null NOT NULL,
    channel_type_code text CONSTRAINT notification_rules_channel_type_code_not_null NOT NULL,
    channel_target_text text CONSTRAINT notification_rules_channel_target_text_not_null NOT NULL,
    is_rule_active_flag boolean DEFAULT true CONSTRAINT notification_rules_is_rule_active_flag_not_null NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT notification_rules_created_dtm_not_null NOT NULL,
    created_by_user_id uuid,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.notification_rules_history OWNER TO postgres;

--
-- TOC entry 5696 (class 0 OID 0)
-- Dependencies: 314
-- Name: TABLE notification_rules_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.notification_rules_history IS 'Immutable row-image history for gov.notification_rules.';


--
-- TOC entry 5697 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN notification_rules_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.notification_rules_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5698 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN notification_rules_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.notification_rules_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5699 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN notification_rules_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.notification_rules_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5700 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN notification_rules_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.notification_rules_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 313 (class 1259 OID 18296)
-- Name: notification_rules_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.notification_rules_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.notification_rules_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5701 (class 0 OID 0)
-- Dependencies: 313
-- Name: notification_rules_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.notification_rules_history_hist_id_seq OWNED BY history.notification_rules_history.hist_id;


--
-- TOC entry 320 (class 1259 OID 18356)
-- Name: orchestrator_pipeline_map_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.orchestrator_pipeline_map_history (
    orch_pipeline_map_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT orchestrator_pipeline_map_orch_pipeline_map_id_not_null NOT NULL,
    orch_id uuid CONSTRAINT orchestrator_pipeline_map_orch_id_not_null NOT NULL,
    pipeline_id uuid CONSTRAINT orchestrator_pipeline_map_pipeline_id_not_null NOT NULL,
    dag_node_ref_text text CONSTRAINT orchestrator_pipeline_map_dag_node_ref_text_not_null NOT NULL,
    dependency_order_num integer DEFAULT 0 CONSTRAINT orchestrator_pipeline_map_dependency_order_num_not_null NOT NULL,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.orchestrator_pipeline_map_history OWNER TO postgres;

--
-- TOC entry 5702 (class 0 OID 0)
-- Dependencies: 320
-- Name: TABLE orchestrator_pipeline_map_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.orchestrator_pipeline_map_history IS 'Immutable row-image history for catalog.orchestrator_pipeline_map. Captures DAG membership changes over time.';


--
-- TOC entry 5703 (class 0 OID 0)
-- Dependencies: 320
-- Name: COLUMN orchestrator_pipeline_map_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrator_pipeline_map_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5704 (class 0 OID 0)
-- Dependencies: 320
-- Name: COLUMN orchestrator_pipeline_map_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrator_pipeline_map_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5705 (class 0 OID 0)
-- Dependencies: 320
-- Name: COLUMN orchestrator_pipeline_map_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrator_pipeline_map_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5706 (class 0 OID 0)
-- Dependencies: 320
-- Name: COLUMN orchestrator_pipeline_map_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrator_pipeline_map_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 319 (class 1259 OID 18355)
-- Name: orchestrator_pipeline_map_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.orchestrator_pipeline_map_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.orchestrator_pipeline_map_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5707 (class 0 OID 0)
-- Dependencies: 319
-- Name: orchestrator_pipeline_map_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.orchestrator_pipeline_map_history_hist_id_seq OWNED BY history.orchestrator_pipeline_map_history.hist_id;


--
-- TOC entry 306 (class 1259 OID 18214)
-- Name: orchestrator_versions_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.orchestrator_versions_history (
    orch_version_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT orchestrator_versions_orch_version_id_not_null NOT NULL,
    orch_id uuid CONSTRAINT orchestrator_versions_orch_id_not_null NOT NULL,
    version_num_seq integer CONSTRAINT orchestrator_versions_version_num_seq_not_null NOT NULL,
    dag_snapshot_json jsonb CONSTRAINT orchestrator_versions_dag_snapshot_json_not_null NOT NULL,
    commit_msg_text text,
    release_tag_label text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT orchestrator_versions_created_dtm_not_null NOT NULL,
    created_by_user_id uuid,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.orchestrator_versions_history OWNER TO postgres;

--
-- TOC entry 5708 (class 0 OID 0)
-- Dependencies: 306
-- Name: TABLE orchestrator_versions_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.orchestrator_versions_history IS 'Immutable row-image history for catalog.orchestrator_versions.';


--
-- TOC entry 5709 (class 0 OID 0)
-- Dependencies: 306
-- Name: COLUMN orchestrator_versions_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrator_versions_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5710 (class 0 OID 0)
-- Dependencies: 306
-- Name: COLUMN orchestrator_versions_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrator_versions_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5711 (class 0 OID 0)
-- Dependencies: 306
-- Name: COLUMN orchestrator_versions_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrator_versions_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5712 (class 0 OID 0)
-- Dependencies: 306
-- Name: COLUMN orchestrator_versions_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrator_versions_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 305 (class 1259 OID 18213)
-- Name: orchestrator_versions_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.orchestrator_versions_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.orchestrator_versions_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5713 (class 0 OID 0)
-- Dependencies: 305
-- Name: orchestrator_versions_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.orchestrator_versions_history_hist_id_seq OWNED BY history.orchestrator_versions_history.hist_id;


--
-- TOC entry 296 (class 1259 OID 18108)
-- Name: orchestrators_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.orchestrators_history (
    orch_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT orchestrators_orch_id_not_null NOT NULL,
    project_id uuid CONSTRAINT orchestrators_project_id_not_null NOT NULL,
    folder_id uuid,
    orch_display_name text CONSTRAINT orchestrators_orch_display_name_not_null NOT NULL,
    orch_desc_text text,
    dag_definition_json jsonb CONSTRAINT orchestrators_dag_definition_json_not_null NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT orchestrators_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT orchestrators_updated_dtm_not_null NOT NULL,
    created_by_user_id uuid,
    active_orch_version_id uuid,
    updated_by_user_id uuid,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.orchestrators_history OWNER TO postgres;

--
-- TOC entry 5714 (class 0 OID 0)
-- Dependencies: 296
-- Name: TABLE orchestrators_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.orchestrators_history IS 'Immutable row-image history for catalog.orchestrators.';


--
-- TOC entry 5715 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN orchestrators_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrators_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5716 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN orchestrators_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrators_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5717 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN orchestrators_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrators_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5718 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN orchestrators_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.orchestrators_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 295 (class 1259 OID 18107)
-- Name: orchestrators_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.orchestrators_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.orchestrators_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5719 (class 0 OID 0)
-- Dependencies: 295
-- Name: orchestrators_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.orchestrators_history_hist_id_seq OWNED BY history.orchestrators_history.hist_id;


--
-- TOC entry 310 (class 1259 OID 18252)
-- Name: pipeline_parameters_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.pipeline_parameters_history (
    param_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT pipeline_parameters_param_id_not_null NOT NULL,
    pipeline_id uuid CONSTRAINT pipeline_parameters_pipeline_id_not_null NOT NULL,
    param_key_name text CONSTRAINT pipeline_parameters_param_key_name_not_null NOT NULL,
    param_data_type_code text DEFAULT 'STRING'::text CONSTRAINT pipeline_parameters_param_data_type_code_not_null NOT NULL,
    default_value_text text,
    is_required_flag boolean DEFAULT false CONSTRAINT pipeline_parameters_is_required_flag_not_null NOT NULL,
    param_desc_text text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT pipeline_parameters_created_dtm_not_null NOT NULL,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.pipeline_parameters_history OWNER TO postgres;

--
-- TOC entry 5720 (class 0 OID 0)
-- Dependencies: 310
-- Name: TABLE pipeline_parameters_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.pipeline_parameters_history IS 'Immutable row-image history for catalog.pipeline_parameters.';


--
-- TOC entry 5721 (class 0 OID 0)
-- Dependencies: 310
-- Name: COLUMN pipeline_parameters_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipeline_parameters_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5722 (class 0 OID 0)
-- Dependencies: 310
-- Name: COLUMN pipeline_parameters_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipeline_parameters_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5723 (class 0 OID 0)
-- Dependencies: 310
-- Name: COLUMN pipeline_parameters_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipeline_parameters_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5724 (class 0 OID 0)
-- Dependencies: 310
-- Name: COLUMN pipeline_parameters_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipeline_parameters_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 309 (class 1259 OID 18251)
-- Name: pipeline_parameters_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.pipeline_parameters_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.pipeline_parameters_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5725 (class 0 OID 0)
-- Dependencies: 309
-- Name: pipeline_parameters_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.pipeline_parameters_history_hist_id_seq OWNED BY history.pipeline_parameters_history.hist_id;


--
-- TOC entry 294 (class 1259 OID 18091)
-- Name: pipeline_versions_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.pipeline_versions_history (
    version_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT pipeline_versions_version_id_not_null NOT NULL,
    pipeline_id uuid CONSTRAINT pipeline_versions_pipeline_id_not_null NOT NULL,
    version_num_seq integer CONSTRAINT pipeline_versions_version_num_seq_not_null NOT NULL,
    commit_msg_text text,
    release_tag_label text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT pipeline_versions_created_dtm_not_null NOT NULL,
    created_by_user_id uuid,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.pipeline_versions_history OWNER TO postgres;

--
-- TOC entry 5726 (class 0 OID 0)
-- Dependencies: 294
-- Name: TABLE pipeline_versions_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.pipeline_versions_history IS 'Immutable row-image history for catalog.pipeline_versions.';


--
-- TOC entry 5727 (class 0 OID 0)
-- Dependencies: 294
-- Name: COLUMN pipeline_versions_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipeline_versions_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5728 (class 0 OID 0)
-- Dependencies: 294
-- Name: COLUMN pipeline_versions_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipeline_versions_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5729 (class 0 OID 0)
-- Dependencies: 294
-- Name: COLUMN pipeline_versions_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipeline_versions_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5730 (class 0 OID 0)
-- Dependencies: 294
-- Name: COLUMN pipeline_versions_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipeline_versions_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 293 (class 1259 OID 18090)
-- Name: pipeline_versions_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.pipeline_versions_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.pipeline_versions_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5731 (class 0 OID 0)
-- Dependencies: 293
-- Name: pipeline_versions_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.pipeline_versions_history_hist_id_seq OWNED BY history.pipeline_versions_history.hist_id;


--
-- TOC entry 292 (class 1259 OID 18072)
-- Name: pipelines_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.pipelines_history (
    pipeline_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT pipelines_pipeline_id_not_null NOT NULL,
    project_id uuid CONSTRAINT pipelines_project_id_not_null NOT NULL,
    folder_id uuid,
    pipeline_display_name text CONSTRAINT pipelines_pipeline_display_name_not_null NOT NULL,
    pipeline_desc_text text,
    active_version_id uuid,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT pipelines_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT pipelines_updated_dtm_not_null NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.pipelines_history OWNER TO postgres;

--
-- TOC entry 5732 (class 0 OID 0)
-- Dependencies: 292
-- Name: TABLE pipelines_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.pipelines_history IS 'Immutable row-image history for catalog.pipelines.';


--
-- TOC entry 5733 (class 0 OID 0)
-- Dependencies: 292
-- Name: COLUMN pipelines_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipelines_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5734 (class 0 OID 0)
-- Dependencies: 292
-- Name: COLUMN pipelines_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipelines_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5735 (class 0 OID 0)
-- Dependencies: 292
-- Name: COLUMN pipelines_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipelines_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5736 (class 0 OID 0)
-- Dependencies: 292
-- Name: COLUMN pipelines_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.pipelines_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 291 (class 1259 OID 18071)
-- Name: pipelines_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.pipelines_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.pipelines_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5737 (class 0 OID 0)
-- Dependencies: 291
-- Name: pipelines_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.pipelines_history_hist_id_seq OWNED BY history.pipelines_history.hist_id;


--
-- TOC entry 316 (class 1259 OID 18319)
-- Name: platform_settings_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.platform_settings_history (
    setting_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT platform_settings_setting_id_not_null NOT NULL,
    setting_key_name text CONSTRAINT platform_settings_setting_key_name_not_null NOT NULL,
    setting_value_text text,
    setting_desc_text text,
    is_sensitive_flag boolean DEFAULT false CONSTRAINT platform_settings_is_sensitive_flag_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT platform_settings_updated_dtm_not_null NOT NULL,
    updated_by_user_id uuid,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.platform_settings_history OWNER TO postgres;

--
-- TOC entry 5738 (class 0 OID 0)
-- Dependencies: 316
-- Name: TABLE platform_settings_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.platform_settings_history IS 'Immutable row-image history for meta.platform_settings. Enables audit of instance configuration changes.';


--
-- TOC entry 5739 (class 0 OID 0)
-- Dependencies: 316
-- Name: COLUMN platform_settings_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.platform_settings_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5740 (class 0 OID 0)
-- Dependencies: 316
-- Name: COLUMN platform_settings_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.platform_settings_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5741 (class 0 OID 0)
-- Dependencies: 316
-- Name: COLUMN platform_settings_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.platform_settings_history.hist_action_dtm IS 'Timestamp when the setting was changed.';


--
-- TOC entry 5742 (class 0 OID 0)
-- Dependencies: 316
-- Name: COLUMN platform_settings_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.platform_settings_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 315 (class 1259 OID 18318)
-- Name: platform_settings_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.platform_settings_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.platform_settings_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5743 (class 0 OID 0)
-- Dependencies: 315
-- Name: platform_settings_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.platform_settings_history_hist_id_seq OWNED BY history.platform_settings_history.hist_id;


--
-- TOC entry 288 (class 1259 OID 18033)
-- Name: projects_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.projects_history (
    project_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT projects_project_id_not_null NOT NULL,
    project_display_name text CONSTRAINT projects_project_display_name_not_null NOT NULL,
    project_desc_text text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT projects_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT projects_updated_dtm_not_null NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.projects_history OWNER TO postgres;

--
-- TOC entry 5744 (class 0 OID 0)
-- Dependencies: 288
-- Name: TABLE projects_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.projects_history IS 'Immutable row-image history for etl.projects.';


--
-- TOC entry 5745 (class 0 OID 0)
-- Dependencies: 288
-- Name: COLUMN projects_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.projects_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5746 (class 0 OID 0)
-- Dependencies: 288
-- Name: COLUMN projects_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.projects_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5747 (class 0 OID 0)
-- Dependencies: 288
-- Name: COLUMN projects_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.projects_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5748 (class 0 OID 0)
-- Dependencies: 288
-- Name: COLUMN projects_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.projects_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 287 (class 1259 OID 18032)
-- Name: projects_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.projects_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.projects_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5749 (class 0 OID 0)
-- Dependencies: 287
-- Name: projects_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.projects_history_hist_id_seq OWNED BY history.projects_history.hist_id;


--
-- TOC entry 302 (class 1259 OID 18175)
-- Name: roles_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.roles_history (
    role_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT roles_role_id_not_null NOT NULL,
    role_display_name text CONSTRAINT roles_role_display_name_not_null NOT NULL,
    role_desc_text text,
    is_system_role_flag boolean DEFAULT false CONSTRAINT roles_is_system_role_flag_not_null NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT roles_created_dtm_not_null NOT NULL,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.roles_history OWNER TO postgres;

--
-- TOC entry 5750 (class 0 OID 0)
-- Dependencies: 302
-- Name: TABLE roles_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.roles_history IS 'Immutable row-image history for gov.roles.';


--
-- TOC entry 5751 (class 0 OID 0)
-- Dependencies: 302
-- Name: COLUMN roles_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.roles_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5752 (class 0 OID 0)
-- Dependencies: 302
-- Name: COLUMN roles_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.roles_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5753 (class 0 OID 0)
-- Dependencies: 302
-- Name: COLUMN roles_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.roles_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5754 (class 0 OID 0)
-- Dependencies: 302
-- Name: COLUMN roles_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.roles_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 301 (class 1259 OID 18174)
-- Name: roles_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.roles_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.roles_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5755 (class 0 OID 0)
-- Dependencies: 301
-- Name: roles_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.roles_history_hist_id_seq OWNED BY history.roles_history.hist_id;


--
-- TOC entry 312 (class 1259 OID 18273)
-- Name: schedules_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.schedules_history (
    schedule_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT schedules_schedule_id_not_null NOT NULL,
    entity_type_code text CONSTRAINT schedules_entity_type_code_not_null NOT NULL,
    entity_id uuid CONSTRAINT schedules_entity_id_not_null NOT NULL,
    cron_expression_text text CONSTRAINT schedules_cron_expression_text_not_null NOT NULL,
    timezone_name_text text DEFAULT 'UTC'::text CONSTRAINT schedules_timezone_name_text_not_null NOT NULL,
    env_id uuid,
    is_schedule_active boolean DEFAULT true CONSTRAINT schedules_is_schedule_active_not_null NOT NULL,
    next_run_dtm timestamp with time zone,
    last_run_dtm timestamp with time zone,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT schedules_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT schedules_updated_dtm_not_null NOT NULL,
    created_by_user_id uuid,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.schedules_history OWNER TO postgres;

--
-- TOC entry 5756 (class 0 OID 0)
-- Dependencies: 312
-- Name: TABLE schedules_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.schedules_history IS 'Immutable row-image history for execution.schedules. Enables audit of schedule changes (cron updates, pauses, deletions).';


--
-- TOC entry 5757 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN schedules_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.schedules_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5758 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN schedules_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.schedules_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5759 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN schedules_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.schedules_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5760 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN schedules_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.schedules_history.hist_action_by IS 'User ID who performed the action.';


--
-- TOC entry 311 (class 1259 OID 18272)
-- Name: schedules_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.schedules_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.schedules_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5761 (class 0 OID 0)
-- Dependencies: 311
-- Name: schedules_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.schedules_history_hist_id_seq OWNED BY history.schedules_history.hist_id;


--
-- TOC entry 286 (class 1259 OID 18009)
-- Name: users_history; Type: TABLE; Schema: history; Owner: postgres
--

CREATE TABLE history.users_history (
    user_id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT users_user_id_not_null NOT NULL,
    email_address text CONSTRAINT users_email_address_not_null NOT NULL,
    password_hash_text text CONSTRAINT users_password_hash_text_not_null NOT NULL,
    user_full_name text CONSTRAINT users_user_full_name_not_null NOT NULL,
    is_account_active boolean DEFAULT true CONSTRAINT users_is_account_active_not_null NOT NULL,
    mfa_enabled_flag boolean DEFAULT false CONSTRAINT users_mfa_enabled_flag_not_null NOT NULL,
    mfa_secret_encrypted text,
    last_login_dtm timestamp with time zone,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT users_created_dtm_not_null NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT users_updated_dtm_not_null NOT NULL,
    hist_id bigint NOT NULL,
    hist_action_cd character(1) NOT NULL,
    hist_action_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hist_action_by uuid
);


ALTER TABLE history.users_history OWNER TO postgres;

--
-- TOC entry 5762 (class 0 OID 0)
-- Dependencies: 286
-- Name: TABLE users_history; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON TABLE history.users_history IS 'Immutable row-image history for etl.users. Populated by trigger before DELETE or UPDATE.';


--
-- TOC entry 5763 (class 0 OID 0)
-- Dependencies: 286
-- Name: COLUMN users_history.hist_id; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.users_history.hist_id IS 'Sequential audit record identifier.';


--
-- TOC entry 5764 (class 0 OID 0)
-- Dependencies: 286
-- Name: COLUMN users_history.hist_action_cd; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.users_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';


--
-- TOC entry 5765 (class 0 OID 0)
-- Dependencies: 286
-- Name: COLUMN users_history.hist_action_dtm; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.users_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';


--
-- TOC entry 5766 (class 0 OID 0)
-- Dependencies: 286
-- Name: COLUMN users_history.hist_action_by; Type: COMMENT; Schema: history; Owner: postgres
--

COMMENT ON COLUMN history.users_history.hist_action_by IS 'User ID from session variable app.user_id who performed the action.';


--
-- TOC entry 285 (class 1259 OID 18008)
-- Name: users_history_hist_id_seq; Type: SEQUENCE; Schema: history; Owner: postgres
--

CREATE SEQUENCE history.users_history_hist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE history.users_history_hist_id_seq OWNER TO postgres;

--
-- TOC entry 5767 (class 0 OID 0)
-- Dependencies: 285
-- Name: users_history_hist_id_seq; Type: SEQUENCE OWNED BY; Schema: history; Owner: postgres
--

ALTER SEQUENCE history.users_history_hist_id_seq OWNED BY history.users_history.hist_id;


--
-- TOC entry 278 (class 1259 OID 17832)
-- Name: cdc_configurations; Type: TABLE; Schema: meta; Owner: postgres
--

CREATE TABLE meta.cdc_configurations (
    cdc_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dataset_id uuid NOT NULL,
    cdc_mode_code text NOT NULL,
    watermark_column_name text,
    cdc_config_json jsonb,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE meta.cdc_configurations OWNER TO postgres;

--
-- TOC entry 5768 (class 0 OID 0)
-- Dependencies: 278
-- Name: TABLE cdc_configurations; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON TABLE meta.cdc_configurations IS 'Change Data Capture configuration per dataset. Drives how the pipeline engine fetches incremental changes vs full reloads.';


--
-- TOC entry 5769 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN cdc_configurations.cdc_id; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.cdc_configurations.cdc_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5770 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN cdc_configurations.dataset_id; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.cdc_configurations.dataset_id IS 'FK to the dataset this CDC config governs. One config per dataset.';


--
-- TOC entry 5771 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN cdc_configurations.cdc_mode_code; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.cdc_configurations.cdc_mode_code IS 'Extraction strategy: FULL_REFRESH, INCREMENTAL_WATERMARK (timestamp/sequence), LOG_BASED (Debezium/DMS), CDC_MERGE (upsert).';


--
-- TOC entry 5772 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN cdc_configurations.watermark_column_name; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.cdc_configurations.watermark_column_name IS 'Column used as the high-watermark for INCREMENTAL_WATERMARK mode (e.g., UPDATED_AT, SEQ_NUM).';


--
-- TOC entry 5773 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN cdc_configurations.cdc_config_json; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.cdc_configurations.cdc_config_json IS 'Mode-specific extended settings JSONB (e.g., initial_load_date, batch_size, log_position).';


--
-- TOC entry 5774 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN cdc_configurations.created_dtm; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.cdc_configurations.created_dtm IS 'Timestamp when this CDC configuration was defined.';


--
-- TOC entry 5775 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN cdc_configurations.updated_dtm; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.cdc_configurations.updated_dtm IS 'Timestamp of the last configuration change.';


--
-- TOC entry 262 (class 1259 OID 17421)
-- Name: global_variable_registry; Type: TABLE; Schema: meta; Owner: postgres
--

CREATE TABLE meta.global_variable_registry (
    var_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid,
    var_key_name text NOT NULL,
    var_value_text text,
    is_secret_flag boolean DEFAULT false NOT NULL
);


ALTER TABLE meta.global_variable_registry OWNER TO postgres;

--
-- TOC entry 5776 (class 0 OID 0)
-- Dependencies: 262
-- Name: TABLE global_variable_registry; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON TABLE meta.global_variable_registry IS 'Project-scoped runtime variables and parameters for pipeline configuration.';


--
-- TOC entry 5777 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN global_variable_registry.var_id; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.global_variable_registry.var_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5778 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN global_variable_registry.project_id; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.global_variable_registry.project_id IS 'FK to the project. NULL for instance-wide variables.';


--
-- TOC entry 5779 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN global_variable_registry.var_key_name; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.global_variable_registry.var_key_name IS 'Variable identifier (e.g., SPARK_MAX_PARTITIONS, DEFAULT_DATE_FORMAT).';


--
-- TOC entry 5780 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN global_variable_registry.var_value_text; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.global_variable_registry.var_value_text IS 'Serialized variable value.';


--
-- TOC entry 5781 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN global_variable_registry.is_secret_flag; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.global_variable_registry.is_secret_flag IS 'TRUE if the value should be resolved via gov.secrets at runtime.';


--
-- TOC entry 279 (class 1259 OID 17854)
-- Name: platform_settings; Type: TABLE; Schema: meta; Owner: postgres
--

CREATE TABLE meta.platform_settings (
    setting_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    setting_key_name text NOT NULL,
    setting_value_text text,
    setting_desc_text text,
    is_sensitive_flag boolean DEFAULT false NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by_user_id uuid
);


ALTER TABLE meta.platform_settings OWNER TO postgres;

--
-- TOC entry 5782 (class 0 OID 0)
-- Dependencies: 279
-- Name: TABLE platform_settings; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON TABLE meta.platform_settings IS 'Instance-wide admin-controlled settings (max concurrent runs, session timeout, SMTP config, default timezone, etc.).';


--
-- TOC entry 5783 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN platform_settings.setting_id; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.platform_settings.setting_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5784 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN platform_settings.setting_key_name; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.platform_settings.setting_key_name IS 'Unique machine-readable key (e.g., MAX_CONCURRENT_RUNS, DEFAULT_TIMEZONE, SMTP_HOST).';


--
-- TOC entry 5785 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN platform_settings.setting_value_text; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.platform_settings.setting_value_text IS 'Serialized setting value. Sensitive settings stored encrypted elsewhere in gov.secrets.';


--
-- TOC entry 5786 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN platform_settings.setting_desc_text; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.platform_settings.setting_desc_text IS 'Description of what this setting controls and its expected value format.';


--
-- TOC entry 5787 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN platform_settings.is_sensitive_flag; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.platform_settings.is_sensitive_flag IS 'TRUE means the value must be masked in API responses and logs.';


--
-- TOC entry 5788 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN platform_settings.updated_dtm; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.platform_settings.updated_dtm IS 'Timestamp of the last value change.';


--
-- TOC entry 5789 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN platform_settings.updated_by_user_id; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.platform_settings.updated_by_user_id IS 'FK to the administrator who last changed this setting.';


--
-- TOC entry 332 (class 1259 OID 24628)
-- Name: technology_types; Type: TABLE; Schema: meta; Owner: postgres
--

CREATE TABLE meta.technology_types (
    tech_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tech_code text NOT NULL,
    display_name text NOT NULL,
    category text NOT NULL,
    icon_name text,
    tech_desc_text text,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE meta.technology_types OWNER TO postgres;

--
-- TOC entry 5790 (class 0 OID 0)
-- Dependencies: 332
-- Name: TABLE technology_types; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON TABLE meta.technology_types IS 'Static registry of supported technologies (RDBMS, Cloud Storage, File Formats, etc.).';


--
-- TOC entry 5791 (class 0 OID 0)
-- Dependencies: 332
-- Name: COLUMN technology_types.tech_id; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.technology_types.tech_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5792 (class 0 OID 0)
-- Dependencies: 332
-- Name: COLUMN technology_types.tech_code; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.technology_types.tech_code IS 'Machine-readable unique code matching connector_type_code.';


--
-- TOC entry 5793 (class 0 OID 0)
-- Dependencies: 332
-- Name: COLUMN technology_types.display_name; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.technology_types.display_name IS 'Human-readable label for the technology.';


--
-- TOC entry 5794 (class 0 OID 0)
-- Dependencies: 332
-- Name: COLUMN technology_types.category; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.technology_types.category IS 'Grouping category for the technology UI (e.g., RDBMS, CLOUD_STORAGE, ANALYTICS, FILES).';


--
-- TOC entry 5795 (class 0 OID 0)
-- Dependencies: 332
-- Name: COLUMN technology_types.icon_name; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.technology_types.icon_name IS 'Logical icon name for UI rendering (Lucide icon identifier).';


--
-- TOC entry 5796 (class 0 OID 0)
-- Dependencies: 332
-- Name: COLUMN technology_types.tech_desc_text; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.technology_types.tech_desc_text IS 'Brief description of the technology and its typical use case.';


--
-- TOC entry 261 (class 1259 OID 17404)
-- Name: transform_library; Type: TABLE; Schema: meta; Owner: postgres
--

CREATE TABLE meta.transform_library (
    lib_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lib_display_name text NOT NULL,
    lib_type_code text NOT NULL,
    storage_uri_text text NOT NULL,
    version_label_text text NOT NULL,
    is_active_flag boolean DEFAULT true NOT NULL,
    created_dtm timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE meta.transform_library OWNER TO postgres;

--
-- TOC entry 5797 (class 0 OID 0)
-- Dependencies: 261
-- Name: TABLE transform_library; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON TABLE meta.transform_library IS 'Registry of reusable code assets: JARs, Python wheels, and SQL UDFs.';


--
-- TOC entry 5798 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN transform_library.lib_id; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.transform_library.lib_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5799 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN transform_library.lib_display_name; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.transform_library.lib_display_name IS 'Human-readable name for the library (e.g., "Finance UDFs v2").';


--
-- TOC entry 5800 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN transform_library.lib_type_code; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.transform_library.lib_type_code IS 'Asset type: JAR, WHL, PY_SCRIPT, SQL_SNIPPET.';


--
-- TOC entry 5801 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN transform_library.storage_uri_text; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.transform_library.storage_uri_text IS 'Object storage path where the binary is stored (e.g., s3://libs/finance-udfs-2.0.jar).';


--
-- TOC entry 5802 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN transform_library.version_label_text; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.transform_library.version_label_text IS 'Semantic version label (e.g., 2.0.1).';


--
-- TOC entry 5803 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN transform_library.is_active_flag; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.transform_library.is_active_flag IS 'FALSE to deprecate without removing pipeline references.';


--
-- TOC entry 5804 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN transform_library.created_dtm; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.transform_library.created_dtm IS 'Timestamp when this library version was registered.';


--
-- TOC entry 260 (class 1259 OID 17387)
-- Name: type_mapping_registry; Type: TABLE; Schema: meta; Owner: postgres
--

CREATE TABLE meta.type_mapping_registry (
    mapping_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    src_tech_code text NOT NULL,
    target_tech_code text NOT NULL,
    src_type_name text NOT NULL,
    target_type_name text NOT NULL,
    is_lossless_flag boolean DEFAULT true NOT NULL
);


ALTER TABLE meta.type_mapping_registry OWNER TO postgres;

--
-- TOC entry 5805 (class 0 OID 0)
-- Dependencies: 260
-- Name: TABLE type_mapping_registry; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON TABLE meta.type_mapping_registry IS 'Cross-technology data type translation registry used by the pipeline compiler.';


--
-- TOC entry 5806 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN type_mapping_registry.mapping_id; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.type_mapping_registry.mapping_id IS 'Surrogate primary key; UUID v4.';


--
-- TOC entry 5807 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN type_mapping_registry.src_tech_code; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.type_mapping_registry.src_tech_code IS 'Source technology (e.g., SNOWFLAKE, ORACLE, POSTGRES).';


--
-- TOC entry 5808 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN type_mapping_registry.target_tech_code; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.type_mapping_registry.target_tech_code IS 'Target technology (e.g., SPARK_SQL, DATABRICKS_DELTA).';


--
-- TOC entry 5809 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN type_mapping_registry.src_type_name; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.type_mapping_registry.src_type_name IS 'Source-native type string (e.g., NUMBER(38,0)).';


--
-- TOC entry 5810 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN type_mapping_registry.target_type_name; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.type_mapping_registry.target_type_name IS 'Equivalent target type string (e.g., DECIMAL(38,0)).';


--
-- TOC entry 5811 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN type_mapping_registry.is_lossless_flag; Type: COMMENT; Schema: meta; Owner: postgres
--

COMMENT ON COLUMN meta.type_mapping_registry.is_lossless_flag IS 'FALSE indicates potential precision or range loss in the conversion.';


--
-- TOC entry 329 (class 1259 OID 18699)
-- Name: generated_artifacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.generated_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_id uuid NOT NULL,
    pipeline_version character varying(50) NOT NULL,
    technology character varying(50) NOT NULL,
    spark_version character varying(20),
    generation_options jsonb,
    metadata jsonb NOT NULL,
    files jsonb NOT NULL,
    warning_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    generated_by character varying(255),
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.generated_artifacts OWNER TO postgres;

--
-- TOC entry 331 (class 1259 OID 18754)
-- Name: node_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.node_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100),
    sub_type character varying(100),
    technology character varying(50),
    description text,
    config_template jsonb NOT NULL,
    tags jsonb,
    is_public boolean DEFAULT true NOT NULL,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.node_templates OWNER TO postgres;

--
-- TOC entry 330 (class 1259 OID 18727)
-- Name: pipeline_executions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_id uuid NOT NULL,
    artifact_id uuid,
    execution_id character varying(255),
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    environment character varying(50),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_seconds numeric(10,2),
    row_counts jsonb,
    error_message text,
    triggered_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pipeline_executions OWNER TO postgres;

--
-- TOC entry 328 (class 1259 OID 18678)
-- Name: pipeline_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_id uuid NOT NULL,
    version character varying(50) NOT NULL,
    definition jsonb NOT NULL,
    change_summary text,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pipeline_versions OWNER TO postgres;

--
-- TOC entry 327 (class 1259 OID 18654)
-- Name: pipelines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipelines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    version character varying(50) DEFAULT '1.0.0'::character varying NOT NULL,
    description text,
    technology character varying(50) NOT NULL,
    spark_version character varying(20),
    definition jsonb NOT NULL,
    tags jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(255),
    updated_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pipelines OWNER TO postgres;

--
-- TOC entry 326 (class 1259 OID 18642)
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO postgres;

--
-- TOC entry 325 (class 1259 OID 18641)
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schema_migrations_id_seq OWNER TO postgres;

--
-- TOC entry 5812 (class 0 OID 0)
-- Dependencies: 325
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- TOC entry 4127 (class 2604 OID 17231)
-- Name: pipeline_run_logs log_id; Type: DEFAULT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_run_logs ALTER COLUMN log_id SET DEFAULT nextval('execution.pipeline_run_logs_log_id_seq'::regclass);


--
-- TOC entry 4129 (class 2604 OID 17251)
-- Name: pipeline_run_metrics metric_id; Type: DEFAULT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_run_metrics ALTER COLUMN metric_id SET DEFAULT nextval('execution.pipeline_run_metrics_metric_id_seq'::regclass);


--
-- TOC entry 4313 (class 2604 OID 18340)
-- Name: cdc_configurations_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.cdc_configurations_history ALTER COLUMN hist_id SET DEFAULT nextval('history.cdc_configurations_history_hist_id_seq'::regclass);


--
-- TOC entry 4323 (class 2604 OID 18377)
-- Name: connector_health_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.connector_health_history ALTER COLUMN hist_id SET DEFAULT nextval('history.connector_health_history_hist_id_seq'::regclass);


--
-- TOC entry 4259 (class 2604 OID 18131)
-- Name: connectors_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.connectors_history ALTER COLUMN hist_id SET DEFAULT nextval('history.connectors_history_hist_id_seq'::regclass);


--
-- TOC entry 4285 (class 2604 OID 18235)
-- Name: data_classifications_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.data_classifications_history ALTER COLUMN hist_id SET DEFAULT nextval('history.data_classifications_history_hist_id_seq'::regclass);


--
-- TOC entry 4265 (class 2604 OID 18157)
-- Name: datasets_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.datasets_history ALTER COLUMN hist_id SET DEFAULT nextval('history.datasets_history_hist_id_seq'::regclass);


--
-- TOC entry 4340 (class 2604 OID 18397)
-- Name: file_format_options_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.file_format_options_history ALTER COLUMN hist_id SET DEFAULT nextval('history.file_format_options_history_hist_id_seq'::regclass);


--
-- TOC entry 4237 (class 2604 OID 18054)
-- Name: folders_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.folders_history ALTER COLUMN hist_id SET DEFAULT nextval('history.folders_history_hist_id_seq'::regclass);


--
-- TOC entry 4276 (class 2604 OID 18196)
-- Name: glossary_terms_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.glossary_terms_history ALTER COLUMN hist_id SET DEFAULT nextval('history.glossary_terms_history_hist_id_seq'::regclass);


--
-- TOC entry 4303 (class 2604 OID 18300)
-- Name: notification_rules_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.notification_rules_history ALTER COLUMN hist_id SET DEFAULT nextval('history.notification_rules_history_hist_id_seq'::regclass);


--
-- TOC entry 4317 (class 2604 OID 18359)
-- Name: orchestrator_pipeline_map_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.orchestrator_pipeline_map_history ALTER COLUMN hist_id SET DEFAULT nextval('history.orchestrator_pipeline_map_history_hist_id_seq'::regclass);


--
-- TOC entry 4280 (class 2604 OID 18217)
-- Name: orchestrator_versions_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.orchestrator_versions_history ALTER COLUMN hist_id SET DEFAULT nextval('history.orchestrator_versions_history_hist_id_seq'::regclass);


--
-- TOC entry 4251 (class 2604 OID 18111)
-- Name: orchestrators_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.orchestrators_history ALTER COLUMN hist_id SET DEFAULT nextval('history.orchestrators_history_hist_id_seq'::regclass);


--
-- TOC entry 4291 (class 2604 OID 18255)
-- Name: pipeline_parameters_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.pipeline_parameters_history ALTER COLUMN hist_id SET DEFAULT nextval('history.pipeline_parameters_history_hist_id_seq'::regclass);


--
-- TOC entry 4246 (class 2604 OID 18094)
-- Name: pipeline_versions_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.pipeline_versions_history ALTER COLUMN hist_id SET DEFAULT nextval('history.pipeline_versions_history_hist_id_seq'::regclass);


--
-- TOC entry 4242 (class 2604 OID 18075)
-- Name: pipelines_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.pipelines_history ALTER COLUMN hist_id SET DEFAULT nextval('history.pipelines_history_hist_id_seq'::regclass);


--
-- TOC entry 4308 (class 2604 OID 18322)
-- Name: platform_settings_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.platform_settings_history ALTER COLUMN hist_id SET DEFAULT nextval('history.platform_settings_history_hist_id_seq'::regclass);


--
-- TOC entry 4232 (class 2604 OID 18036)
-- Name: projects_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.projects_history ALTER COLUMN hist_id SET DEFAULT nextval('history.projects_history_hist_id_seq'::regclass);


--
-- TOC entry 4270 (class 2604 OID 18178)
-- Name: roles_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.roles_history ALTER COLUMN hist_id SET DEFAULT nextval('history.roles_history_hist_id_seq'::regclass);


--
-- TOC entry 4298 (class 2604 OID 18276)
-- Name: schedules_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.schedules_history ALTER COLUMN hist_id SET DEFAULT nextval('history.schedules_history_hist_id_seq'::regclass);


--
-- TOC entry 4227 (class 2604 OID 18012)
-- Name: users_history hist_id; Type: DEFAULT; Schema: history; Owner: postgres
--

ALTER TABLE ONLY history.users_history ALTER COLUMN hist_id SET DEFAULT nextval('history.users_history_hist_id_seq'::regclass);


--
-- TOC entry 4342 (class 2604 OID 18645)
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- TOC entry 4910 (class 0 OID 17783)
-- Dependencies: 276
-- Data for Name: asset_tags; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4879 (class 0 OID 17070)
-- Dependencies: 245
-- Data for Name: branches; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4907 (class 0 OID 17721)
-- Dependencies: 273
-- Data for Name: connection_test_results; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4917 (class 0 OID 17951)
-- Dependencies: 283
-- Data for Name: connector_health; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

INSERT INTO catalog.connector_health VALUES ('0481342d-f854-42b4-9fd5-4808a7a60b8e', 'f047f953-6e2c-456d-b9f8-9bbbf74fe729', 'UNKNOWN', NULL, NULL, 0, '2026-03-19 07:44:31.516111+05:30', NULL);


--
-- TOC entry 4871 (class 0 OID 16832)
-- Dependencies: 237
-- Data for Name: connectors; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

INSERT INTO catalog.connectors VALUES ('f047f953-6e2c-456d-b9f8-9bbbf74fe729', 'TransactionFee', 'FILE_CSV', '\xc30d040703027657637fee8491e172d2ad01200804c7faf776270414bc0b3b1b3c5f39f0f5fd63e19b910232554430c664d4b673aec7ddc533f42d119c85e215bf37c917e9f9187b36f39cfb3d136d0ea7c70d268c34fdc8b393fbd363196aa9df90187d2712f1ddb30fa401e17aa5f434f2d844c4f66505f4e6a5d44edc63616d7106e46c45a05c1787b8a09e4779277c7b625b76ebc056f35d60fdc854c4f0aa159cafd4b07721ca0a2610c09fcef45775815015e8a19272eea0c81aa1', '\xc30d0407030257f128b51041d12e6cd23301fb17d565b4faec6c71a936d8c825c21c4a5f6a7189aba712582d28b81ed9d7339edac893b1cf24f46547bbb87556b227644e', NULL, NULL, NULL, 'REQUIRE', NULL, NULL, 5, 600, '2026-03-19 07:44:31.516111+05:30', '2026-03-19 07:44:31.516111+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', NULL, NULL);


--
-- TOC entry 4905 (class 0 OID 17655)
-- Dependencies: 271
-- Data for Name: data_lineage; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4873 (class 0 OID 16898)
-- Dependencies: 239
-- Data for Name: dataset_columns; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4872 (class 0 OID 16866)
-- Dependencies: 238
-- Data for Name: datasets; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4918 (class 0 OID 17974)
-- Dependencies: 284
-- Data for Name: file_format_options; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4878 (class 0 OID 17045)
-- Dependencies: 244
-- Data for Name: node_templates; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

INSERT INTO catalog.node_templates VALUES ('97612aa1-c185-4102-88f6-600f284b15a8', 'PostgreSQL Source', 'source', 'jdbc', 'pyspark', 'Read from PostgreSQL with parallel partitioning', '{"url": "jdbc:postgresql://HOST:5432/DATABASE", "table": "schema.table_name", "driver": "org.postgresql.Driver", "fetchSize": 50000, "lowerBound": 1, "upperBound": 10000000, "numPartitions": 10, "passwordSecret": "DB_CREDS", "partitionColumn": "id"}', NULL, true, NULL, '2026-03-08 20:03:29.644882+05:30', '2026-03-08 20:03:29.644882+05:30');
INSERT INTO catalog.node_templates VALUES ('ea7d460f-f796-44a0-b22f-08a5eee25e84', 'S3 Parquet Source', 'source', 'file', NULL, 'Read partitioned Parquet from S3', '{"path": "s3a://BUCKET/PREFIX/", "format": "parquet", "mergeSchema": false, "recursiveFileLookup": true}', NULL, true, NULL, '2026-03-08 20:03:29.651541+05:30', '2026-03-08 20:03:29.651541+05:30');
INSERT INTO catalog.node_templates VALUES ('524159ac-81d9-4e9e-ba36-469474585cf9', 'Delta Lake Source', 'source', 'delta', NULL, 'Read Delta table (optionally time-travel)', '{"path": "s3a://BUCKET/delta/TABLE_NAME"}', NULL, true, NULL, '2026-03-08 20:03:29.65382+05:30', '2026-03-08 20:03:29.65382+05:30');
INSERT INTO catalog.node_templates VALUES ('0007aac0-7c39-4de4-b7db-418cb55d27d7', 'Delta Lake Sink (Overwrite)', 'sink', 'delta', NULL, 'Write to Delta with optimizeWrite and autoCompact', '{"mode": "overwrite", "path": "s3a://BUCKET/delta/OUTPUT_TABLE", "autoCompact": true, "partitionBy": [], "optimizeWrite": true}', NULL, true, NULL, '2026-03-08 20:03:29.655809+05:30', '2026-03-08 20:03:29.655809+05:30');
INSERT INTO catalog.node_templates VALUES ('a21479f0-6e7a-4e4b-9036-71e3b5adf045', 'Delta Lake Sink (Merge)', 'sink', 'delta', NULL, 'Upsert into Delta table using MERGE', '{"mode": "merge", "mergeKey": ["id"], "tableName": "catalog.schema.table"}', NULL, true, NULL, '2026-03-08 20:03:29.658101+05:30', '2026-03-08 20:03:29.658101+05:30');


--
-- TOC entry 4915 (class 0 OID 17895)
-- Dependencies: 281
-- Data for Name: orchestrator_pipeline_map; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4901 (class 0 OID 17547)
-- Dependencies: 267
-- Data for Name: orchestrator_versions; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4877 (class 0 OID 17012)
-- Dependencies: 243
-- Data for Name: orchestrators; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

INSERT INTO catalog.orchestrators VALUES ('c1d4862d-83ec-4121-8bb1-098e519853ee', NULL, NULL, 'Test_Global_Orchestrator', NULL, '{}', '2026-03-19 07:36:29.061225+05:30', '2026-03-19 07:36:29.061225+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', NULL, NULL);


--
-- TOC entry 4876 (class 0 OID 16989)
-- Dependencies: 242
-- Data for Name: pipeline_contents; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

INSERT INTO catalog.pipeline_contents VALUES ('9b5d8d40-e5d2-47df-9bdb-a8e19d953ce1', '0e981c41-09c3-494d-97e8-cd213b976525', '{"edges": [], "nodes": []}', NULL, NULL, '2026-03-18 09:49:27.342066+05:30');
INSERT INTO catalog.pipeline_contents VALUES ('30307870-3e2e-4fc7-a434-86304d8e7d8b', '0a0e751e-610c-48d3-93ae-28adde690738', '{"edges": [], "nodes": []}', NULL, 'c07431ea66bd1210de91d7ef11418fdd', '2026-03-18 19:35:38.458952+05:30');
INSERT INTO catalog.pipeline_contents VALUES ('9a05dd01-219c-4140-a7be-26834c4b0f63', 'a26902ee-906f-466b-9682-539460985eee', '{"edges": [], "nodes": []}', NULL, 'c07431ea66bd1210de91d7ef11418fdd', '2026-03-18 19:35:43.701417+05:30');


--
-- TOC entry 4906 (class 0 OID 17691)
-- Dependencies: 272
-- Data for Name: pipeline_dataset_map; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4902 (class 0 OID 17583)
-- Dependencies: 268
-- Data for Name: pipeline_parameters; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4908 (class 0 OID 17744)
-- Dependencies: 274
-- Data for Name: pipeline_validation_results; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

INSERT INTO catalog.pipeline_validation_results VALUES ('bbe1f648-dde7-491d-907a-7ead0263b928', '7a538483-5151-415d-87e5-a3b457082857', false, 2, '[{"code": "NO_NODES", "message": "Pipeline has no nodes."}, {"code": "NO_SOURCE", "message": "Pipeline must have at least one source node."}]', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '2026-03-18 19:35:54.7086+05:30');


--
-- TOC entry 4875 (class 0 OID 16964)
-- Dependencies: 241
-- Data for Name: pipeline_versions; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

INSERT INTO catalog.pipeline_versions VALUES ('0e981c41-09c3-494d-97e8-cd213b976525', '7a538483-5151-415d-87e5-a3b457082857', 1, 'Auto-save v1', NULL, '2026-03-18 09:49:27.342066+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');
INSERT INTO catalog.pipeline_versions VALUES ('0a0e751e-610c-48d3-93ae-28adde690738', '7a538483-5151-415d-87e5-a3b457082857', 2, 'Saved from Header toolbar', NULL, '2026-03-18 19:35:38.458952+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');
INSERT INTO catalog.pipeline_versions VALUES ('a26902ee-906f-466b-9682-539460985eee', '7a538483-5151-415d-87e5-a3b457082857', 3, 'Saved from Pipeline workspace', NULL, '2026-03-18 19:35:43.701417+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');


--
-- TOC entry 4874 (class 0 OID 16927)
-- Dependencies: 240
-- Data for Name: pipelines; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

INSERT INTO catalog.pipelines VALUES ('7a538483-5151-415d-87e5-a3b457082857', '450b32fd-8018-46bd-9f18-029b438bd280', NULL, 'Test1', '', 'a26902ee-906f-466b-9682-539460985eee', '2026-03-18 09:49:18.968194+05:30', '2026-03-18 19:35:43.701417+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');
INSERT INTO catalog.pipelines VALUES ('8fbbebe2-a15c-47ec-bde8-bb50bf2930d7', NULL, NULL, 'Test_Global_Pipeline', NULL, NULL, '2026-03-19 07:35:37.612837+05:30', '2026-03-19 07:35:37.612837+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', NULL);


--
-- TOC entry 4909 (class 0 OID 17769)
-- Dependencies: 275
-- Data for Name: tags; Type: TABLE DATA; Schema: catalog; Owner: postgres
--



--
-- TOC entry 4870 (class 0 OID 16804)
-- Dependencies: 236
-- Data for Name: folders; Type: TABLE DATA; Schema: etl; Owner: postgres
--

INSERT INTO etl.folders VALUES ('5bd28edb-2a32-4fa6-bfcc-918069ce9763', '450b32fd-8018-46bd-9f18-029b438bd280', NULL, 'First Folder', 'first_folder', 'PIPELINE', '2026-03-18 09:45:47.310323+05:30', '2026-03-18 09:45:47.310323+05:30');
INSERT INTO etl.folders VALUES ('304cc41a-b8cb-4601-a6e0-6fb4bc579b88', '450b32fd-8018-46bd-9f18-029b438bd280', '5bd28edb-2a32-4fa6-bfcc-918069ce9763', 'First Sub-Folder', 'first_folder.first_sub_folder', 'PIPELINE', '2026-03-18 09:45:59.923965+05:30', '2026-03-18 09:45:59.923965+05:30');
INSERT INTO etl.folders VALUES ('4ed32c72-f90d-4318-afef-c1548893bca1', '450b32fd-8018-46bd-9f18-029b438bd280', NULL, 'Second Project', 'Second_Project', 'PIPELINE', '2026-03-18 19:18:17.516921+05:30', '2026-03-18 19:18:17.516921+05:30');


--
-- TOC entry 4869 (class 0 OID 16778)
-- Dependencies: 235
-- Data for Name: projects; Type: TABLE DATA; Schema: etl; Owner: postgres
--

INSERT INTO etl.projects VALUES ('450b32fd-8018-46bd-9f18-029b438bd280', 'Demo1', NULL, '2026-03-08 23:03:27.881769+05:30', '2026-03-18 09:45:22.426066+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');


--
-- TOC entry 4863 (class 0 OID 16671)
-- Dependencies: 229
-- Data for Name: user_attributes; Type: TABLE DATA; Schema: etl; Owner: postgres
--



--
-- TOC entry 4897 (class 0 OID 17440)
-- Dependencies: 263
-- Data for Name: user_work_drafts; Type: TABLE DATA; Schema: etl; Owner: postgres
--



--
-- TOC entry 4862 (class 0 OID 16649)
-- Dependencies: 228
-- Data for Name: users; Type: TABLE DATA; Schema: etl; Owner: postgres
--

INSERT INTO etl.users VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-19 07:39:18.072601+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-19 07:39:18.072601+05:30');


--
-- TOC entry 4880 (class 0 OID 17100)
-- Dependencies: 246
-- Data for Name: environments; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4889 (class 0 OID 17267)
-- Dependencies: 255
-- Data for Name: generated_artifacts; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4883 (class 0 OID 17187)
-- Dependencies: 249
-- Data for Name: orchestrator_pipeline_run_map; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4882 (class 0 OID 17156)
-- Dependencies: 248
-- Data for Name: orchestrator_runs; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4884 (class 0 OID 17208)
-- Dependencies: 250
-- Data for Name: pipeline_node_runs; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4886 (class 0 OID 17228)
-- Dependencies: 252
-- Data for Name: pipeline_run_logs; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4888 (class 0 OID 17248)
-- Dependencies: 254
-- Data for Name: pipeline_run_metrics; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4881 (class 0 OID 17119)
-- Dependencies: 247
-- Data for Name: pipeline_runs; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4914 (class 0 OID 17875)
-- Dependencies: 280
-- Data for Name: run_artifacts; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4916 (class 0 OID 17921)
-- Dependencies: 282
-- Data for Name: run_lineage; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4903 (class 0 OID 17607)
-- Dependencies: 269
-- Data for Name: run_parameters; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4904 (class 0 OID 17625)
-- Dependencies: 270
-- Data for Name: schedules; Type: TABLE DATA; Schema: execution; Owner: postgres
--



--
-- TOC entry 4899 (class 0 OID 17493)
-- Dependencies: 265
-- Data for Name: connector_access; Type: TABLE DATA; Schema: gov; Owner: postgres
--



--
-- TOC entry 4900 (class 0 OID 17524)
-- Dependencies: 266
-- Data for Name: data_classifications; Type: TABLE DATA; Schema: gov; Owner: postgres
--



--
-- TOC entry 4893 (class 0 OID 17369)
-- Dependencies: 259
-- Data for Name: data_contracts; Type: TABLE DATA; Schema: gov; Owner: postgres
--



--
-- TOC entry 4891 (class 0 OID 17322)
-- Dependencies: 257
-- Data for Name: dq_results; Type: TABLE DATA; Schema: gov; Owner: postgres
--



--
-- TOC entry 4890 (class 0 OID 17301)
-- Dependencies: 256
-- Data for Name: dq_rules; Type: TABLE DATA; Schema: gov; Owner: postgres
--



--
-- TOC entry 4892 (class 0 OID 17345)
-- Dependencies: 258
-- Data for Name: glossary_terms; Type: TABLE DATA; Schema: gov; Owner: postgres
--



--
-- TOC entry 4911 (class 0 OID 17809)
-- Dependencies: 277
-- Data for Name: notification_rules; Type: TABLE DATA; Schema: gov; Owner: postgres
--



--
-- TOC entry 4864 (class 0 OID 16694)
-- Dependencies: 230
-- Data for Name: permissions; Type: TABLE DATA; Schema: gov; Owner: postgres
--

INSERT INTO gov.permissions VALUES ('b0e7fe3a-8a18-448d-a09b-a6f8d7bab33d', 'PIPELINE_VIEW', 'View Pipelines', 'Can view pipeline definitions, history, and status.', true);
INSERT INTO gov.permissions VALUES ('3ff3203f-f036-43e2-85ed-5b252b386dbe', 'PIPELINE_CREATE', 'Create Pipeline', 'Can create brand-new pipeline assets.', true);
INSERT INTO gov.permissions VALUES ('06094390-7c5d-4098-9eda-6bfdfe15b822', 'PIPELINE_EDIT', 'Edit Pipeline', 'Can modify existing pipeline definitions and bodies.', true);
INSERT INTO gov.permissions VALUES ('59d3413e-b3ca-441e-a1ce-ed9a0a0338f5', 'PIPELINE_DELETE', 'Delete Pipeline', 'Can physically remove pipelines from the catalog.', true);
INSERT INTO gov.permissions VALUES ('46c0cfe6-3c28-4f53-b9c6-32ac62425279', 'PIPELINE_RUN', 'Execute Pipeline', 'Can trigger manual or scheduled pipeline executions.', true);
INSERT INTO gov.permissions VALUES ('5f681260-08a8-4faf-aa06-371bc07ce4e2', 'CONNECTION_VIEW', 'View Connections', 'Can see connection metadata (but not raw secrets).', true);
INSERT INTO gov.permissions VALUES ('c5a8d330-5f23-4075-81c7-645a1bb0a32f', 'CONNECTION_CREATE', 'Create Connection', 'Can register new data source/sink connectors.', true);
INSERT INTO gov.permissions VALUES ('c4b32449-07b8-468a-8097-bb9baa3e2f93', 'CONNECTION_EDIT', 'Edit Connection', 'Can modify existing connector configurations.', true);
INSERT INTO gov.permissions VALUES ('0af880fa-5965-4763-bc86-97448bf17977', 'CONNECTION_DELETE', 'Delete Connection', 'Can remove connectors from the catalog.', true);
INSERT INTO gov.permissions VALUES ('d25e7670-ed9e-41be-a858-8e3f43e66062', 'USER_MANAGE', 'Manage Users', 'Can create users and assign instance-wide roles.', true);
INSERT INTO gov.permissions VALUES ('a5a4be54-3db3-4aef-8fa4-93a931f5a6ae', 'ROLE_MANAGE', 'Manage Roles', 'Can create custom roles and modify permission mappings.', true);
INSERT INTO gov.permissions VALUES ('c8e819dd-33e3-4359-978d-5fa4e67bfdf8', 'AUDIT_VIEW', 'View Audit Logs', 'Can browse platform-wide activity and security logs.', true);
INSERT INTO gov.permissions VALUES ('3b19f167-1cfb-4907-bdbb-3a12eb64bcd3', 'SECRET_MANAGE', 'Manage Secrets', 'Can store and rotate global system secrets.', true);


--
-- TOC entry 4898 (class 0 OID 17463)
-- Dependencies: 264
-- Data for Name: project_user_roles; Type: TABLE DATA; Schema: gov; Owner: postgres
--



--
-- TOC entry 4866 (class 0 OID 16725)
-- Dependencies: 232
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: gov; Owner: postgres
--

INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', 'b0e7fe3a-8a18-448d-a09b-a6f8d7bab33d');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', '3ff3203f-f036-43e2-85ed-5b252b386dbe');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', '06094390-7c5d-4098-9eda-6bfdfe15b822');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', '59d3413e-b3ca-441e-a1ce-ed9a0a0338f5');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', '46c0cfe6-3c28-4f53-b9c6-32ac62425279');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', '5f681260-08a8-4faf-aa06-371bc07ce4e2');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', 'c5a8d330-5f23-4075-81c7-645a1bb0a32f');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', 'c4b32449-07b8-468a-8097-bb9baa3e2f93');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', '0af880fa-5965-4763-bc86-97448bf17977');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', 'd25e7670-ed9e-41be-a858-8e3f43e66062');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', 'a5a4be54-3db3-4aef-8fa4-93a931f5a6ae');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', 'c8e819dd-33e3-4359-978d-5fa4e67bfdf8');
INSERT INTO gov.role_permissions VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', '3b19f167-1cfb-4907-bdbb-3a12eb64bcd3');
INSERT INTO gov.role_permissions VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', 'b0e7fe3a-8a18-448d-a09b-a6f8d7bab33d');
INSERT INTO gov.role_permissions VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', '3ff3203f-f036-43e2-85ed-5b252b386dbe');
INSERT INTO gov.role_permissions VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', '06094390-7c5d-4098-9eda-6bfdfe15b822');
INSERT INTO gov.role_permissions VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', '59d3413e-b3ca-441e-a1ce-ed9a0a0338f5');
INSERT INTO gov.role_permissions VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', '46c0cfe6-3c28-4f53-b9c6-32ac62425279');
INSERT INTO gov.role_permissions VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', '5f681260-08a8-4faf-aa06-371bc07ce4e2');
INSERT INTO gov.role_permissions VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', 'c5a8d330-5f23-4075-81c7-645a1bb0a32f');
INSERT INTO gov.role_permissions VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', 'c4b32449-07b8-468a-8097-bb9baa3e2f93');
INSERT INTO gov.role_permissions VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', '0af880fa-5965-4763-bc86-97448bf17977');
INSERT INTO gov.role_permissions VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', 'c8e819dd-33e3-4359-978d-5fa4e67bfdf8');
INSERT INTO gov.role_permissions VALUES ('90123fc2-2de8-4109-a228-ce77c49abda5', 'b0e7fe3a-8a18-448d-a09b-a6f8d7bab33d');
INSERT INTO gov.role_permissions VALUES ('90123fc2-2de8-4109-a228-ce77c49abda5', '46c0cfe6-3c28-4f53-b9c6-32ac62425279');
INSERT INTO gov.role_permissions VALUES ('90123fc2-2de8-4109-a228-ce77c49abda5', '5f681260-08a8-4faf-aa06-371bc07ce4e2');
INSERT INTO gov.role_permissions VALUES ('6f2c8a93-2fc1-44fa-a569-28f0d08b2ca7', 'b0e7fe3a-8a18-448d-a09b-a6f8d7bab33d');
INSERT INTO gov.role_permissions VALUES ('6f2c8a93-2fc1-44fa-a569-28f0d08b2ca7', '5f681260-08a8-4faf-aa06-371bc07ce4e2');


--
-- TOC entry 4865 (class 0 OID 16709)
-- Dependencies: 231
-- Data for Name: roles; Type: TABLE DATA; Schema: gov; Owner: postgres
--

INSERT INTO gov.roles VALUES ('7a788fb9-d83a-4eff-9ffc-af402026f3f7', 'ADMIN', 'Full platform administrator. Can manage all assets and users.', true, '2026-03-08 19:52:18.952797+05:30');
INSERT INTO gov.roles VALUES ('d22bca7a-53b9-4a25-9171-80c9d5435cb3', 'DEVELOPER', 'Data Engineer. Can manage pipelines and connectors, but not users.', true, '2026-03-08 19:52:18.952797+05:30');
INSERT INTO gov.roles VALUES ('90123fc2-2de8-4109-a228-ce77c49abda5', 'OPERATOR', 'Platform Operator. Can run and monitor pipelines but not edit them.', true, '2026-03-08 19:52:18.952797+05:30');
INSERT INTO gov.roles VALUES ('6f2c8a93-2fc1-44fa-a569-28f0d08b2ca7', 'VIEWER', 'Read-only observer. Can view metadata and execution status.', true, '2026-03-08 19:52:18.952797+05:30');


--
-- TOC entry 4868 (class 0 OID 16759)
-- Dependencies: 234
-- Data for Name: secrets; Type: TABLE DATA; Schema: gov; Owner: postgres
--



--
-- TOC entry 4867 (class 0 OID 16742)
-- Dependencies: 233
-- Data for Name: user_roles; Type: TABLE DATA; Schema: gov; Owner: postgres
--

INSERT INTO gov.user_roles VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '7a788fb9-d83a-4eff-9ffc-af402026f3f7');
INSERT INTO gov.user_roles VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'd22bca7a-53b9-4a25-9171-80c9d5435cb3');


--
-- TOC entry 4952 (class 0 OID 18337)
-- Dependencies: 318
-- Data for Name: cdc_configurations_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4956 (class 0 OID 18374)
-- Dependencies: 322
-- Data for Name: connector_health_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4932 (class 0 OID 18128)
-- Dependencies: 298
-- Data for Name: connectors_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4942 (class 0 OID 18232)
-- Dependencies: 308
-- Data for Name: data_classifications_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4934 (class 0 OID 18154)
-- Dependencies: 300
-- Data for Name: datasets_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4958 (class 0 OID 18394)
-- Dependencies: 324
-- Data for Name: file_format_options_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4924 (class 0 OID 18051)
-- Dependencies: 290
-- Data for Name: folders_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4938 (class 0 OID 18193)
-- Dependencies: 304
-- Data for Name: glossary_terms_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4948 (class 0 OID 18297)
-- Dependencies: 314
-- Data for Name: notification_rules_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4954 (class 0 OID 18356)
-- Dependencies: 320
-- Data for Name: orchestrator_pipeline_map_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4940 (class 0 OID 18214)
-- Dependencies: 306
-- Data for Name: orchestrator_versions_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4930 (class 0 OID 18108)
-- Dependencies: 296
-- Data for Name: orchestrators_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4944 (class 0 OID 18252)
-- Dependencies: 310
-- Data for Name: pipeline_parameters_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4928 (class 0 OID 18091)
-- Dependencies: 294
-- Data for Name: pipeline_versions_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4926 (class 0 OID 18072)
-- Dependencies: 292
-- Data for Name: pipelines_history; Type: TABLE DATA; Schema: history; Owner: postgres
--

INSERT INTO history.pipelines_history VALUES ('a328b39a-c7be-4b45-b58c-110d470c3743', '450b32fd-8018-46bd-9f18-029b438bd280', NULL, 'Test', NULL, NULL, '2026-03-08 23:08:37.208284+05:30', '2026-03-08 23:08:37.208284+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 1, 'D', '2026-03-18 09:46:21.769495+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');
INSERT INTO history.pipelines_history VALUES ('7a538483-5151-415d-87e5-a3b457082857', '450b32fd-8018-46bd-9f18-029b438bd280', NULL, 'Test', NULL, NULL, '2026-03-18 09:49:18.968194+05:30', '2026-03-18 09:49:18.968194+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 2, 'U', '2026-03-18 09:49:27.342066+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');
INSERT INTO history.pipelines_history VALUES ('7a538483-5151-415d-87e5-a3b457082857', '450b32fd-8018-46bd-9f18-029b438bd280', NULL, 'Test', NULL, '0e981c41-09c3-494d-97e8-cd213b976525', '2026-03-18 09:49:18.968194+05:30', '2026-03-18 09:49:27.342066+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 3, 'U', '2026-03-18 19:35:38.458952+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');
INSERT INTO history.pipelines_history VALUES ('7a538483-5151-415d-87e5-a3b457082857', '450b32fd-8018-46bd-9f18-029b438bd280', NULL, 'Test1', '', '0e981c41-09c3-494d-97e8-cd213b976525', '2026-03-18 09:49:18.968194+05:30', '2026-03-18 19:35:38.458952+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 4, 'U', '2026-03-18 19:35:38.458952+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');
INSERT INTO history.pipelines_history VALUES ('7a538483-5151-415d-87e5-a3b457082857', '450b32fd-8018-46bd-9f18-029b438bd280', NULL, 'Test1', '', '0a0e751e-610c-48d3-93ae-28adde690738', '2026-03-18 09:49:18.968194+05:30', '2026-03-18 19:35:38.458952+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 5, 'U', '2026-03-18 19:35:43.701417+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');
INSERT INTO history.pipelines_history VALUES ('7a538483-5151-415d-87e5-a3b457082857', '450b32fd-8018-46bd-9f18-029b438bd280', NULL, 'Test1', '', '0a0e751e-610c-48d3-93ae-28adde690738', '2026-03-18 09:49:18.968194+05:30', '2026-03-18 19:35:43.701417+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 6, 'U', '2026-03-18 19:35:43.701417+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');


--
-- TOC entry 4950 (class 0 OID 18319)
-- Dependencies: 316
-- Data for Name: platform_settings_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4922 (class 0 OID 18033)
-- Dependencies: 288
-- Data for Name: projects_history; Type: TABLE DATA; Schema: history; Owner: postgres
--

INSERT INTO history.projects_history VALUES ('450b32fd-8018-46bd-9f18-029b438bd280', 'Demo', NULL, '2026-03-08 23:03:27.881769+05:30', '2026-03-08 23:03:27.881769+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 1, 'U', '2026-03-18 08:23:06.033267+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');
INSERT INTO history.projects_history VALUES ('450b32fd-8018-46bd-9f18-029b438bd280', 'Demo', NULL, '2026-03-08 23:03:27.881769+05:30', '2026-03-18 08:23:06.033267+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 2, 'U', '2026-03-18 09:45:22.426066+05:30', '6003cd09-4184-4ec6-9bf4-c88daa37d3ee');


--
-- TOC entry 4936 (class 0 OID 18175)
-- Dependencies: 302
-- Data for Name: roles_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4946 (class 0 OID 18273)
-- Dependencies: 312
-- Data for Name: schedules_history; Type: TABLE DATA; Schema: history; Owner: postgres
--



--
-- TOC entry 4920 (class 0 OID 18009)
-- Dependencies: 286
-- Data for Name: users_history; Type: TABLE DATA; Schema: history; Owner: postgres
--

INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, NULL, '2026-03-08 22:37:14.619067+05:30', '2026-03-08 22:37:14.619067+05:30', 1, 'U', '2026-03-08 22:37:48.328554+05:30', NULL);
INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-08 22:37:48.328554+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-08 22:37:48.328554+05:30', 2, 'U', '2026-03-08 22:39:14.962745+05:30', NULL);
INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-08 22:39:14.962745+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-08 22:39:14.962745+05:30', 3, 'U', '2026-03-08 22:51:18.684032+05:30', NULL);
INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-08 22:51:18.684032+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-08 22:51:18.684032+05:30', 4, 'U', '2026-03-08 23:02:42.965984+05:30', NULL);
INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-08 23:02:42.965984+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-08 23:02:42.965984+05:30', 5, 'U', '2026-03-18 08:21:57.992958+05:30', NULL);
INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-18 08:21:57.992958+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-18 08:21:57.992958+05:30', 6, 'U', '2026-03-18 08:38:05.801202+05:30', NULL);
INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-18 08:38:05.801202+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-18 08:38:05.801202+05:30', 7, 'U', '2026-03-18 10:08:34.399283+05:30', NULL);
INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-18 10:08:34.399283+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-18 10:08:34.399283+05:30', 8, 'U', '2026-03-18 10:08:38.910514+05:30', NULL);
INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-18 10:08:38.910514+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-18 10:08:38.910514+05:30', 9, 'U', '2026-03-18 18:11:28.889536+05:30', NULL);
INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-18 18:11:28.889536+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-18 18:11:28.889536+05:30', 10, 'U', '2026-03-19 07:35:03.491077+05:30', NULL);
INSERT INTO history.users_history VALUES ('6003cd09-4184-4ec6-9bf4-c88daa37d3ee', 'admin@etl1.local', '$2b$10$w02Iabh2LZnT7VoFmGo6wut7o65R2VVzAOtVELgq7Xi47sxUK/cqi', 'Platform Admin', true, false, NULL, '2026-03-19 07:35:03.491077+05:30', '2026-03-08 22:37:14.619067+05:30', '2026-03-19 07:35:03.491077+05:30', 11, 'U', '2026-03-19 07:39:18.072601+05:30', NULL);


--
-- TOC entry 4912 (class 0 OID 17832)
-- Dependencies: 278
-- Data for Name: cdc_configurations; Type: TABLE DATA; Schema: meta; Owner: postgres
--



--
-- TOC entry 4896 (class 0 OID 17421)
-- Dependencies: 262
-- Data for Name: global_variable_registry; Type: TABLE DATA; Schema: meta; Owner: postgres
--



--
-- TOC entry 4913 (class 0 OID 17854)
-- Dependencies: 279
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: meta; Owner: postgres
--



--
-- TOC entry 4966 (class 0 OID 24628)
-- Dependencies: 332
-- Data for Name: technology_types; Type: TABLE DATA; Schema: meta; Owner: postgres
--

INSERT INTO meta.technology_types VALUES ('4ab46565-6073-46db-b0f2-9ef6211c8cd0', 'POSTGRESQL', 'PostgreSQL', 'RDBMS', 'Database', 'Open-source relational database management system.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('7354d226-21c9-4c63-8f85-6ff64f774597', 'MYSQL', 'MySQL', 'RDBMS', 'Database', 'Open-source relational database management system often used for web apps.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('5c1f8e6a-8c9f-48dc-8d0d-78ec77276f35', 'SQLSERVER', 'SQL Server', 'RDBMS', 'Database', 'Microsoft SQL Server enterprise relational database.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('b42d17af-7a0a-409d-8330-5485944d3f83', 'ORACLE', 'Oracle', 'RDBMS', 'Database', 'Enterprise-grade Oracle Database.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('4d98ff2a-4b1a-4bcd-aa3f-744283c13ac5', 'MARIADB', 'MariaDB', 'RDBMS', 'Database', 'Open-source RDBMS, fork of MySQL.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('667b6d56-13ef-42a4-84aa-d3fb08818376', 'DB2', 'IBM Db2', 'RDBMS', 'Database', 'IBM enterprise relational database.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('291fca2c-cef5-4a27-8a62-f05bfbd68895', 'SAP_HANA', 'SAP HANA', 'RDBMS', 'Database', 'In-memory, column-oriented database from SAP.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('26fb9eca-2731-4a52-88a6-62d5fa1d3839', 'AWS_S3', 'Amazon S3', 'CLOUD_STORAGE', 'Cloud', 'Scalable object storage from AWS.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('06cf20a4-885a-489a-98de-3433a31fb000', 'GCP_GCS', 'Google GCS', 'CLOUD_STORAGE', 'Cloud', 'Object storage for Google Cloud Platform.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('9fbfa81a-00fe-4047-b4e3-2bf6b2c25ffa', 'AZURE_BLOB', 'Azure Blob', 'CLOUD_STORAGE', 'Cloud', 'Object storage for Microsoft Azure.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('ccadf0b1-a489-45b3-9fc6-f8a37be4b860', 'OCI_OBJECT', 'OCI Object', 'CLOUD_STORAGE', 'Cloud', 'Object storage for Oracle Cloud Infrastructure.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('59e94e3a-cc6f-4480-8182-d1c95e0052ef', 'SNOWFLAKE', 'Snowflake', 'ANALYTICS', 'Zap', 'Cloud data platform for high-performance analytics.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('a595d4ac-ae42-4e25-91d9-5ca7c1f5f8f1', 'DATABRICKS', 'Databricks', 'ANALYTICS', 'Zap', 'Unified data analytics platform built on Spark.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('dd851307-eeb6-45b8-a3b6-b10c31573b3c', 'AWS_REDSHIFT', 'Redshift', 'ANALYTICS', 'Zap', 'Managed data warehouse service in AWS.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('d5adc74b-69aa-4d1d-8e0e-181d5c5cc5a5', 'GCP_BIGQUERY', 'BigQuery', 'ANALYTICS', 'Zap', 'Serverless, highly scalable enterprise data warehouse.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('b6cf1bfc-20d9-41c6-a90a-28c6292e58ec', 'AZURE_SYNAPSE', 'Synapse', 'ANALYTICS', 'Zap', 'Enterprise analytics service on Microsoft Azure.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('68332698-8749-4a75-b761-dba5f43a5e2c', 'CSV', 'CSV File', 'FILES', 'FileText', 'Comma-separated values file format.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('97c90a93-92b0-4a79-b872-b92ce7e349cf', 'PARQUET', 'Parquet File', 'FILES', 'FileText', 'Columnar storage format for Hadoop and Spark.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('38817303-c116-49d7-8306-389c50362644', 'JSON', 'JSON File', 'FILES', 'FileText', 'JavaScript Object Notation light-weight data interchange format.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('6eedfc53-b964-4f6e-ab4a-b0ab6b19e0db', 'EXCEL', 'Excel File', 'FILES', 'FileText', 'Binary spreadsheet file format (.xlsx, .xls).', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');
INSERT INTO meta.technology_types VALUES ('1f6e0de5-1158-4a86-abe7-287fe710c6cd', 'DELTA', 'Delta Lake', 'FILES', 'Layers', 'Open-source storage layer that brings ACID transactions to Spark.', '2026-03-18 22:51:00.197485+05:30', '2026-03-18 22:51:00.197485+05:30');


--
-- TOC entry 4895 (class 0 OID 17404)
-- Dependencies: 261
-- Data for Name: transform_library; Type: TABLE DATA; Schema: meta; Owner: postgres
--



--
-- TOC entry 4894 (class 0 OID 17387)
-- Dependencies: 260
-- Data for Name: type_mapping_registry; Type: TABLE DATA; Schema: meta; Owner: postgres
--



--
-- TOC entry 4963 (class 0 OID 18699)
-- Dependencies: 329
-- Data for Name: generated_artifacts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4965 (class 0 OID 18754)
-- Dependencies: 331
-- Data for Name: node_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.node_templates VALUES ('b053d8c7-173b-4b86-a271-78b000329d76', 'PostgreSQL Source', 'source', 'jdbc', 'pyspark', 'Read from PostgreSQL with parallel partitioning', '{"url": "jdbc:postgresql://HOST:5432/DATABASE", "table": "schema.table_name", "driver": "org.postgresql.Driver", "fetchSize": 50000, "lowerBound": 1, "upperBound": 10000000, "numPartitions": 10, "passwordSecret": "DB_CREDS", "partitionColumn": "id"}', NULL, true, NULL, '2026-03-08 22:17:25.839721+05:30', '2026-03-08 22:17:25.839721+05:30');
INSERT INTO public.node_templates VALUES ('d461d7dd-7b41-41d8-960a-76e927b05c45', 'S3 Parquet Source', 'source', 'file', NULL, 'Read partitioned Parquet from S3', '{"path": "s3a://BUCKET/PREFIX/", "format": "parquet", "mergeSchema": false, "recursiveFileLookup": true}', NULL, true, NULL, '2026-03-08 22:17:25.844917+05:30', '2026-03-08 22:17:25.844917+05:30');
INSERT INTO public.node_templates VALUES ('a3e6bae6-fc45-409d-ad16-7d4e765114bd', 'Delta Lake Source', 'source', 'delta', NULL, 'Read Delta table (optionally time-travel)', '{"path": "s3a://BUCKET/delta/TABLE_NAME"}', NULL, true, NULL, '2026-03-08 22:17:25.849165+05:30', '2026-03-08 22:17:25.849165+05:30');
INSERT INTO public.node_templates VALUES ('389c8931-46a2-4b94-922b-03dac38082a7', 'Delta Lake Sink (Overwrite)', 'sink', 'delta', NULL, 'Write to Delta with optimizeWrite and autoCompact', '{"mode": "overwrite", "path": "s3a://BUCKET/delta/OUTPUT_TABLE", "autoCompact": true, "partitionBy": [], "optimizeWrite": true}', NULL, true, NULL, '2026-03-08 22:17:25.852105+05:30', '2026-03-08 22:17:25.852105+05:30');
INSERT INTO public.node_templates VALUES ('d3f1d904-d69f-45cd-8738-afb8adbb9270', 'Delta Lake Sink (Merge)', 'sink', 'delta', NULL, 'Upsert into Delta table using MERGE', '{"mode": "merge", "mergeKey": ["id"], "tableName": "catalog.schema.table"}', NULL, true, NULL, '2026-03-08 22:17:25.854807+05:30', '2026-03-08 22:17:25.854807+05:30');


--
-- TOC entry 4964 (class 0 OID 18727)
-- Dependencies: 330
-- Data for Name: pipeline_executions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4962 (class 0 OID 18678)
-- Dependencies: 328
-- Data for Name: pipeline_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4961 (class 0 OID 18654)
-- Dependencies: 327
-- Data for Name: pipelines; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4960 (class 0 OID 18642)
-- Dependencies: 326
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.schema_migrations VALUES (1, '001_create_codegen_tables.sql', '2026-03-08 20:00:57.842459+05:30');
INSERT INTO public.schema_migrations VALUES (2, '002_global_pipelines_orchestrators.sql', '2026-03-18 10:12:13.262487+05:30');
INSERT INTO public.schema_migrations VALUES (3, '003_add_runtime_helper_routines.sql', '2026-03-18 16:33:34.467755+05:30');
INSERT INTO public.schema_migrations VALUES (4, '004_add_run_options_support.sql', '2026-03-18 16:33:34.472364+05:30');
INSERT INTO public.schema_migrations VALUES (5, '005_add_asset_permission_routines.sql', '2026-03-18 16:33:34.476493+05:30');
INSERT INTO public.schema_migrations VALUES (6, '006_add_governance_user_update_routines.sql', '2026-03-18 16:33:34.479277+05:30');
INSERT INTO public.schema_migrations VALUES (7, '007_add_audit_closure_routines.sql', '2026-03-18 18:11:23.685071+05:30');
INSERT INTO public.schema_migrations VALUES (8, '008_add_static_sql_replacements.sql', '2026-03-18 22:51:25.085484+05:30');
INSERT INTO public.schema_migrations VALUES (9, '009_fix_artifact_pipeline_fk.sql', '2026-03-18 22:51:25.090943+05:30');


--
-- TOC entry 5813 (class 0 OID 0)
-- Dependencies: 251
-- Name: pipeline_run_logs_log_id_seq; Type: SEQUENCE SET; Schema: execution; Owner: postgres
--

SELECT pg_catalog.setval('execution.pipeline_run_logs_log_id_seq', 1, false);


--
-- TOC entry 5814 (class 0 OID 0)
-- Dependencies: 253
-- Name: pipeline_run_metrics_metric_id_seq; Type: SEQUENCE SET; Schema: execution; Owner: postgres
--

SELECT pg_catalog.setval('execution.pipeline_run_metrics_metric_id_seq', 1, false);


--
-- TOC entry 5815 (class 0 OID 0)
-- Dependencies: 317
-- Name: cdc_configurations_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.cdc_configurations_history_hist_id_seq', 1, false);


--
-- TOC entry 5816 (class 0 OID 0)
-- Dependencies: 321
-- Name: connector_health_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.connector_health_history_hist_id_seq', 1, false);


--
-- TOC entry 5817 (class 0 OID 0)
-- Dependencies: 297
-- Name: connectors_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.connectors_history_hist_id_seq', 1, false);


--
-- TOC entry 5818 (class 0 OID 0)
-- Dependencies: 307
-- Name: data_classifications_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.data_classifications_history_hist_id_seq', 1, false);


--
-- TOC entry 5819 (class 0 OID 0)
-- Dependencies: 299
-- Name: datasets_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.datasets_history_hist_id_seq', 1, false);


--
-- TOC entry 5820 (class 0 OID 0)
-- Dependencies: 323
-- Name: file_format_options_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.file_format_options_history_hist_id_seq', 1, false);


--
-- TOC entry 5821 (class 0 OID 0)
-- Dependencies: 289
-- Name: folders_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.folders_history_hist_id_seq', 1, false);


--
-- TOC entry 5822 (class 0 OID 0)
-- Dependencies: 303
-- Name: glossary_terms_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.glossary_terms_history_hist_id_seq', 1, false);


--
-- TOC entry 5823 (class 0 OID 0)
-- Dependencies: 313
-- Name: notification_rules_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.notification_rules_history_hist_id_seq', 1, false);


--
-- TOC entry 5824 (class 0 OID 0)
-- Dependencies: 319
-- Name: orchestrator_pipeline_map_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.orchestrator_pipeline_map_history_hist_id_seq', 1, false);


--
-- TOC entry 5825 (class 0 OID 0)
-- Dependencies: 305
-- Name: orchestrator_versions_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.orchestrator_versions_history_hist_id_seq', 1, false);


--
-- TOC entry 5826 (class 0 OID 0)
-- Dependencies: 295
-- Name: orchestrators_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.orchestrators_history_hist_id_seq', 1, false);


--
-- TOC entry 5827 (class 0 OID 0)
-- Dependencies: 309
-- Name: pipeline_parameters_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.pipeline_parameters_history_hist_id_seq', 1, false);


--
-- TOC entry 5828 (class 0 OID 0)
-- Dependencies: 293
-- Name: pipeline_versions_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.pipeline_versions_history_hist_id_seq', 1, false);


--
-- TOC entry 5829 (class 0 OID 0)
-- Dependencies: 291
-- Name: pipelines_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.pipelines_history_hist_id_seq', 9, true);


--
-- TOC entry 5830 (class 0 OID 0)
-- Dependencies: 315
-- Name: platform_settings_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.platform_settings_history_hist_id_seq', 1, false);


--
-- TOC entry 5831 (class 0 OID 0)
-- Dependencies: 287
-- Name: projects_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.projects_history_hist_id_seq', 2, true);


--
-- TOC entry 5832 (class 0 OID 0)
-- Dependencies: 301
-- Name: roles_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.roles_history_hist_id_seq', 1, false);


--
-- TOC entry 5833 (class 0 OID 0)
-- Dependencies: 311
-- Name: schedules_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.schedules_history_hist_id_seq', 1, false);


--
-- TOC entry 5834 (class 0 OID 0)
-- Dependencies: 285
-- Name: users_history_hist_id_seq; Type: SEQUENCE SET; Schema: history; Owner: postgres
--

SELECT pg_catalog.setval('history.users_history_hist_id_seq', 11, true);


--
-- TOC entry 5835 (class 0 OID 0)
-- Dependencies: 325
-- Name: schema_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.schema_migrations_id_seq', 9, true);


--
-- TOC entry 4514 (class 2606 OID 17796)
-- Name: asset_tags asset_tags_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.asset_tags
    ADD CONSTRAINT asset_tags_pkey PRIMARY KEY (asset_tag_id);


--
-- TOC entry 4516 (class 2606 OID 17798)
-- Name: asset_tags asset_tags_tag_id_asset_type_code_asset_id_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.asset_tags
    ADD CONSTRAINT asset_tags_tag_id_asset_type_code_asset_id_key UNIQUE (tag_id, asset_type_code, asset_id);


--
-- TOC entry 4427 (class 2606 OID 17084)
-- Name: branches branches_pipeline_id_branch_display_name_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.branches
    ADD CONSTRAINT branches_pipeline_id_branch_display_name_key UNIQUE (pipeline_id, branch_display_name);


--
-- TOC entry 4429 (class 2606 OID 17082)
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (branch_id);


--
-- TOC entry 4506 (class 2606 OID 17733)
-- Name: connection_test_results connection_test_results_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connection_test_results
    ADD CONSTRAINT connection_test_results_pkey PRIMARY KEY (test_result_id);


--
-- TOC entry 4539 (class 2606 OID 17968)
-- Name: connector_health connector_health_connector_id_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connector_health
    ADD CONSTRAINT connector_health_connector_id_key UNIQUE (connector_id);


--
-- TOC entry 4541 (class 2606 OID 17966)
-- Name: connector_health connector_health_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connector_health
    ADD CONSTRAINT connector_health_pkey PRIMARY KEY (health_id);


--
-- TOC entry 4399 (class 2606 OID 16855)
-- Name: connectors connectors_connector_display_name_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connectors
    ADD CONSTRAINT connectors_connector_display_name_key UNIQUE (connector_display_name);


--
-- TOC entry 4401 (class 2606 OID 16853)
-- Name: connectors connectors_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connectors
    ADD CONSTRAINT connectors_pkey PRIMARY KEY (connector_id);


--
-- TOC entry 4497 (class 2606 OID 17667)
-- Name: data_lineage data_lineage_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.data_lineage
    ADD CONSTRAINT data_lineage_pkey PRIMARY KEY (lineage_id);


--
-- TOC entry 4405 (class 2606 OID 16916)
-- Name: dataset_columns dataset_columns_dataset_id_column_name_text_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.dataset_columns
    ADD CONSTRAINT dataset_columns_dataset_id_column_name_text_key UNIQUE (dataset_id, column_name_text);


--
-- TOC entry 4407 (class 2606 OID 16914)
-- Name: dataset_columns dataset_columns_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.dataset_columns
    ADD CONSTRAINT dataset_columns_pkey PRIMARY KEY (column_id);


--
-- TOC entry 4403 (class 2606 OID 16882)
-- Name: datasets datasets_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.datasets
    ADD CONSTRAINT datasets_pkey PRIMARY KEY (dataset_id);


--
-- TOC entry 4543 (class 2606 OID 18002)
-- Name: file_format_options file_format_options_connector_id_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.file_format_options
    ADD CONSTRAINT file_format_options_connector_id_key UNIQUE (connector_id);


--
-- TOC entry 4545 (class 2606 OID 18000)
-- Name: file_format_options file_format_options_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.file_format_options
    ADD CONSTRAINT file_format_options_pkey PRIMARY KEY (format_option_id);


--
-- TOC entry 4423 (class 2606 OID 17062)
-- Name: node_templates node_templates_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.node_templates
    ADD CONSTRAINT node_templates_pkey PRIMARY KEY (template_id);


--
-- TOC entry 4425 (class 2606 OID 17064)
-- Name: node_templates node_templates_template_name_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.node_templates
    ADD CONSTRAINT node_templates_template_name_key UNIQUE (template_name);


--
-- TOC entry 4530 (class 2606 OID 17910)
-- Name: orchestrator_pipeline_map orchestrator_pipeline_map_orch_id_pipeline_id_dag_node_ref__key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrator_pipeline_map
    ADD CONSTRAINT orchestrator_pipeline_map_orch_id_pipeline_id_dag_node_ref__key UNIQUE (orch_id, pipeline_id, dag_node_ref_text);


--
-- TOC entry 4532 (class 2606 OID 17908)
-- Name: orchestrator_pipeline_map orchestrator_pipeline_map_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrator_pipeline_map
    ADD CONSTRAINT orchestrator_pipeline_map_pkey PRIMARY KEY (orch_pipeline_map_id);


--
-- TOC entry 4483 (class 2606 OID 17562)
-- Name: orchestrator_versions orchestrator_versions_orch_id_version_num_seq_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrator_versions
    ADD CONSTRAINT orchestrator_versions_orch_id_version_num_seq_key UNIQUE (orch_id, version_num_seq);


--
-- TOC entry 4485 (class 2606 OID 17560)
-- Name: orchestrator_versions orchestrator_versions_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrator_versions
    ADD CONSTRAINT orchestrator_versions_pkey PRIMARY KEY (orch_version_id);


--
-- TOC entry 4419 (class 2606 OID 17027)
-- Name: orchestrators orchestrators_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrators
    ADD CONSTRAINT orchestrators_pkey PRIMARY KEY (orch_id);


--
-- TOC entry 4421 (class 2606 OID 17029)
-- Name: orchestrators orchestrators_project_id_orch_display_name_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrators
    ADD CONSTRAINT orchestrators_project_id_orch_display_name_key UNIQUE (project_id, orch_display_name);


--
-- TOC entry 4417 (class 2606 OID 17001)
-- Name: pipeline_contents pipeline_contents_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_contents
    ADD CONSTRAINT pipeline_contents_pkey PRIMARY KEY (content_id);


--
-- TOC entry 4502 (class 2606 OID 17705)
-- Name: pipeline_dataset_map pipeline_dataset_map_pipeline_id_version_id_dataset_id_acce_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_dataset_map
    ADD CONSTRAINT pipeline_dataset_map_pipeline_id_version_id_dataset_id_acce_key UNIQUE (pipeline_id, version_id, dataset_id, access_mode_code);


--
-- TOC entry 4504 (class 2606 OID 17703)
-- Name: pipeline_dataset_map pipeline_dataset_map_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_dataset_map
    ADD CONSTRAINT pipeline_dataset_map_pkey PRIMARY KEY (map_id);


--
-- TOC entry 4487 (class 2606 OID 17601)
-- Name: pipeline_parameters pipeline_parameters_pipeline_id_param_key_name_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_parameters
    ADD CONSTRAINT pipeline_parameters_pipeline_id_param_key_name_key UNIQUE (pipeline_id, param_key_name);


--
-- TOC entry 4489 (class 2606 OID 17599)
-- Name: pipeline_parameters pipeline_parameters_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_parameters
    ADD CONSTRAINT pipeline_parameters_pkey PRIMARY KEY (param_id);


--
-- TOC entry 4508 (class 2606 OID 17758)
-- Name: pipeline_validation_results pipeline_validation_results_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_validation_results
    ADD CONSTRAINT pipeline_validation_results_pkey PRIMARY KEY (validation_id);


--
-- TOC entry 4413 (class 2606 OID 16978)
-- Name: pipeline_versions pipeline_versions_pipeline_id_version_num_seq_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_versions
    ADD CONSTRAINT pipeline_versions_pipeline_id_version_num_seq_key UNIQUE (pipeline_id, version_num_seq);


--
-- TOC entry 4415 (class 2606 OID 16976)
-- Name: pipeline_versions pipeline_versions_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_versions
    ADD CONSTRAINT pipeline_versions_pkey PRIMARY KEY (version_id);


--
-- TOC entry 4409 (class 2606 OID 16941)
-- Name: pipelines pipelines_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipelines
    ADD CONSTRAINT pipelines_pkey PRIMARY KEY (pipeline_id);


--
-- TOC entry 4411 (class 2606 OID 16943)
-- Name: pipelines pipelines_project_id_pipeline_display_name_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipelines
    ADD CONSTRAINT pipelines_project_id_pipeline_display_name_key UNIQUE (project_id, pipeline_display_name);


--
-- TOC entry 4510 (class 2606 OID 17780)
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (tag_id);


--
-- TOC entry 4512 (class 2606 OID 17782)
-- Name: tags tags_tag_display_name_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.tags
    ADD CONSTRAINT tags_tag_display_name_key UNIQUE (tag_display_name);


--
-- TOC entry 4396 (class 2606 OID 16820)
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (folder_id);


--
-- TOC entry 4392 (class 2606 OID 16791)
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (project_id);


--
-- TOC entry 4394 (class 2606 OID 16793)
-- Name: projects projects_project_display_name_key; Type: CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.projects
    ADD CONSTRAINT projects_project_display_name_key UNIQUE (project_display_name);


--
-- TOC entry 4372 (class 2606 OID 16686)
-- Name: user_attributes user_attributes_pkey; Type: CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.user_attributes
    ADD CONSTRAINT user_attributes_pkey PRIMARY KEY (attr_id);


--
-- TOC entry 4374 (class 2606 OID 16688)
-- Name: user_attributes user_attributes_user_id_attr_key_name_key; Type: CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.user_attributes
    ADD CONSTRAINT user_attributes_user_id_attr_key_name_key UNIQUE (user_id, attr_key_name);


--
-- TOC entry 4471 (class 2606 OID 17455)
-- Name: user_work_drafts user_work_drafts_pkey; Type: CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.user_work_drafts
    ADD CONSTRAINT user_work_drafts_pkey PRIMARY KEY (draft_id);


--
-- TOC entry 4473 (class 2606 OID 17457)
-- Name: user_work_drafts user_work_drafts_user_id_entity_type_code_entity_id_key; Type: CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.user_work_drafts
    ADD CONSTRAINT user_work_drafts_user_id_entity_type_code_entity_id_key UNIQUE (user_id, entity_type_code, entity_id);


--
-- TOC entry 4368 (class 2606 OID 16670)
-- Name: users users_email_address_key; Type: CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.users
    ADD CONSTRAINT users_email_address_key UNIQUE (email_address);


--
-- TOC entry 4370 (class 2606 OID 16668)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4431 (class 2606 OID 17118)
-- Name: environments environments_env_display_name_key; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.environments
    ADD CONSTRAINT environments_env_display_name_key UNIQUE (env_display_name);


--
-- TOC entry 4433 (class 2606 OID 17116)
-- Name: environments environments_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.environments
    ADD CONSTRAINT environments_pkey PRIMARY KEY (env_id);


--
-- TOC entry 4449 (class 2606 OID 17285)
-- Name: generated_artifacts generated_artifacts_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.generated_artifacts
    ADD CONSTRAINT generated_artifacts_pkey PRIMARY KEY (artifact_id);


--
-- TOC entry 4439 (class 2606 OID 17197)
-- Name: orchestrator_pipeline_run_map orchestrator_pipeline_run_map_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.orchestrator_pipeline_run_map
    ADD CONSTRAINT orchestrator_pipeline_run_map_pkey PRIMARY KEY (orch_run_id, pipeline_run_id);


--
-- TOC entry 4437 (class 2606 OID 17171)
-- Name: orchestrator_runs orchestrator_runs_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.orchestrator_runs
    ADD CONSTRAINT orchestrator_runs_pkey PRIMARY KEY (orch_run_id);


--
-- TOC entry 4441 (class 2606 OID 17221)
-- Name: pipeline_node_runs pipeline_node_runs_pipeline_run_id_node_id_in_ir_text_key; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_node_runs
    ADD CONSTRAINT pipeline_node_runs_pipeline_run_id_node_id_in_ir_text_key UNIQUE (pipeline_run_id, node_id_in_ir_text);


--
-- TOC entry 4443 (class 2606 OID 17219)
-- Name: pipeline_node_runs pipeline_node_runs_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_node_runs
    ADD CONSTRAINT pipeline_node_runs_pkey PRIMARY KEY (node_run_id);


--
-- TOC entry 4445 (class 2606 OID 17241)
-- Name: pipeline_run_logs pipeline_run_logs_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_run_logs
    ADD CONSTRAINT pipeline_run_logs_pkey PRIMARY KEY (log_id);


--
-- TOC entry 4447 (class 2606 OID 17261)
-- Name: pipeline_run_metrics pipeline_run_metrics_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_run_metrics
    ADD CONSTRAINT pipeline_run_metrics_pkey PRIMARY KEY (metric_id);


--
-- TOC entry 4435 (class 2606 OID 17135)
-- Name: pipeline_runs pipeline_runs_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_runs
    ADD CONSTRAINT pipeline_runs_pkey PRIMARY KEY (pipeline_run_id);


--
-- TOC entry 4528 (class 2606 OID 17889)
-- Name: run_artifacts run_artifacts_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.run_artifacts
    ADD CONSTRAINT run_artifacts_pkey PRIMARY KEY (artifact_id);


--
-- TOC entry 4537 (class 2606 OID 17932)
-- Name: run_lineage run_lineage_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.run_lineage
    ADD CONSTRAINT run_lineage_pkey PRIMARY KEY (run_lineage_id);


--
-- TOC entry 4491 (class 2606 OID 17619)
-- Name: run_parameters run_parameters_pipeline_run_id_param_key_name_key; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.run_parameters
    ADD CONSTRAINT run_parameters_pipeline_run_id_param_key_name_key UNIQUE (pipeline_run_id, param_key_name);


--
-- TOC entry 4493 (class 2606 OID 17617)
-- Name: run_parameters run_parameters_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.run_parameters
    ADD CONSTRAINT run_parameters_pkey PRIMARY KEY (run_param_id);


--
-- TOC entry 4495 (class 2606 OID 17644)
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (schedule_id);


--
-- TOC entry 4477 (class 2606 OID 17503)
-- Name: connector_access connector_access_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.connector_access
    ADD CONSTRAINT connector_access_pkey PRIMARY KEY (access_id);


--
-- TOC entry 4479 (class 2606 OID 17539)
-- Name: data_classifications data_classifications_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.data_classifications
    ADD CONSTRAINT data_classifications_pkey PRIMARY KEY (classification_id);


--
-- TOC entry 4481 (class 2606 OID 17541)
-- Name: data_classifications data_classifications_target_type_code_target_id_key; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.data_classifications
    ADD CONSTRAINT data_classifications_target_type_code_target_id_key UNIQUE (target_type_code, target_id);


--
-- TOC entry 4459 (class 2606 OID 17381)
-- Name: data_contracts data_contracts_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.data_contracts
    ADD CONSTRAINT data_contracts_pkey PRIMARY KEY (contract_id);


--
-- TOC entry 4453 (class 2606 OID 17334)
-- Name: dq_results dq_results_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.dq_results
    ADD CONSTRAINT dq_results_pkey PRIMARY KEY (result_id);


--
-- TOC entry 4451 (class 2606 OID 17321)
-- Name: dq_rules dq_rules_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.dq_rules
    ADD CONSTRAINT dq_rules_pkey PRIMARY KEY (rule_id);


--
-- TOC entry 4455 (class 2606 OID 17361)
-- Name: glossary_terms glossary_terms_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.glossary_terms
    ADD CONSTRAINT glossary_terms_pkey PRIMARY KEY (term_id);


--
-- TOC entry 4457 (class 2606 OID 17363)
-- Name: glossary_terms glossary_terms_term_display_name_key; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.glossary_terms
    ADD CONSTRAINT glossary_terms_term_display_name_key UNIQUE (term_display_name);


--
-- TOC entry 4518 (class 2606 OID 17826)
-- Name: notification_rules notification_rules_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.notification_rules
    ADD CONSTRAINT notification_rules_pkey PRIMARY KEY (notification_rule_id);


--
-- TOC entry 4376 (class 2606 OID 16708)
-- Name: permissions permissions_perm_code_name_key; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.permissions
    ADD CONSTRAINT permissions_perm_code_name_key UNIQUE (perm_code_name);


--
-- TOC entry 4378 (class 2606 OID 16706)
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (permission_id);


--
-- TOC entry 4475 (class 2606 OID 17472)
-- Name: project_user_roles project_user_roles_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.project_user_roles
    ADD CONSTRAINT project_user_roles_pkey PRIMARY KEY (project_id, user_id, role_id);


--
-- TOC entry 4384 (class 2606 OID 16731)
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- TOC entry 4380 (class 2606 OID 16722)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);


--
-- TOC entry 4382 (class 2606 OID 16724)
-- Name: roles roles_role_display_name_key; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.roles
    ADD CONSTRAINT roles_role_display_name_key UNIQUE (role_display_name);


--
-- TOC entry 4388 (class 2606 OID 16775)
-- Name: secrets secrets_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.secrets
    ADD CONSTRAINT secrets_pkey PRIMARY KEY (secret_id);


--
-- TOC entry 4390 (class 2606 OID 16777)
-- Name: secrets secrets_secret_key_name_key; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.secrets
    ADD CONSTRAINT secrets_secret_key_name_key UNIQUE (secret_key_name);


--
-- TOC entry 4386 (class 2606 OID 16748)
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- TOC entry 4520 (class 2606 OID 17848)
-- Name: cdc_configurations cdc_configurations_dataset_id_key; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.cdc_configurations
    ADD CONSTRAINT cdc_configurations_dataset_id_key UNIQUE (dataset_id);


--
-- TOC entry 4522 (class 2606 OID 17846)
-- Name: cdc_configurations cdc_configurations_pkey; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.cdc_configurations
    ADD CONSTRAINT cdc_configurations_pkey PRIMARY KEY (cdc_id);


--
-- TOC entry 4467 (class 2606 OID 17432)
-- Name: global_variable_registry global_variable_registry_pkey; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.global_variable_registry
    ADD CONSTRAINT global_variable_registry_pkey PRIMARY KEY (var_id);


--
-- TOC entry 4469 (class 2606 OID 17434)
-- Name: global_variable_registry global_variable_registry_project_id_var_key_name_key; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.global_variable_registry
    ADD CONSTRAINT global_variable_registry_project_id_var_key_name_key UNIQUE (project_id, var_key_name);


--
-- TOC entry 4524 (class 2606 OID 17867)
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (setting_id);


--
-- TOC entry 4526 (class 2606 OID 17869)
-- Name: platform_settings platform_settings_setting_key_name_key; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.platform_settings
    ADD CONSTRAINT platform_settings_setting_key_name_key UNIQUE (setting_key_name);


--
-- TOC entry 4576 (class 2606 OID 24643)
-- Name: technology_types technology_types_pkey; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.technology_types
    ADD CONSTRAINT technology_types_pkey PRIMARY KEY (tech_id);


--
-- TOC entry 4578 (class 2606 OID 24645)
-- Name: technology_types technology_types_tech_code_key; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.technology_types
    ADD CONSTRAINT technology_types_tech_code_key UNIQUE (tech_code);


--
-- TOC entry 4465 (class 2606 OID 17420)
-- Name: transform_library transform_library_pkey; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.transform_library
    ADD CONSTRAINT transform_library_pkey PRIMARY KEY (lib_id);


--
-- TOC entry 4461 (class 2606 OID 17401)
-- Name: type_mapping_registry type_mapping_registry_pkey; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.type_mapping_registry
    ADD CONSTRAINT type_mapping_registry_pkey PRIMARY KEY (mapping_id);


--
-- TOC entry 4463 (class 2606 OID 17403)
-- Name: type_mapping_registry type_mapping_registry_src_tech_code_target_tech_code_src_ty_key; Type: CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.type_mapping_registry
    ADD CONSTRAINT type_mapping_registry_src_tech_code_target_tech_code_src_ty_key UNIQUE (src_tech_code, target_tech_code, src_type_name);


--
-- TOC entry 4561 (class 2606 OID 18718)
-- Name: generated_artifacts generated_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_artifacts
    ADD CONSTRAINT generated_artifacts_pkey PRIMARY KEY (id);


--
-- TOC entry 4574 (class 2606 OID 18770)
-- Name: node_templates node_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.node_templates
    ADD CONSTRAINT node_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 4569 (class 2606 OID 18740)
-- Name: pipeline_executions pipeline_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT pipeline_executions_pkey PRIMARY KEY (id);


--
-- TOC entry 4559 (class 2606 OID 18691)
-- Name: pipeline_versions pipeline_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_versions
    ADD CONSTRAINT pipeline_versions_pkey PRIMARY KEY (id);


--
-- TOC entry 4555 (class 2606 OID 18673)
-- Name: pipelines pipelines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipelines
    ADD CONSTRAINT pipelines_pkey PRIMARY KEY (id);


--
-- TOC entry 4547 (class 2606 OID 18653)
-- Name: schema_migrations schema_migrations_filename_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_filename_key UNIQUE (filename);


--
-- TOC entry 4549 (class 2606 OID 18651)
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4498 (class 1259 OID 17690)
-- Name: idx_catalog_lineage_pipeline; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX idx_catalog_lineage_pipeline ON catalog.data_lineage USING btree (pipeline_id);


--
-- TOC entry 4499 (class 1259 OID 17688)
-- Name: idx_catalog_lineage_src; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX idx_catalog_lineage_src ON catalog.data_lineage USING btree (src_dataset_id);


--
-- TOC entry 4500 (class 1259 OID 17689)
-- Name: idx_catalog_lineage_tgt; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX idx_catalog_lineage_tgt ON catalog.data_lineage USING btree (tgt_dataset_id);


--
-- TOC entry 4397 (class 1259 OID 16831)
-- Name: idx_etl_folders_ltree; Type: INDEX; Schema: etl; Owner: postgres
--

CREATE INDEX idx_etl_folders_ltree ON etl.folders USING gist (hierarchical_path_ltree);


--
-- TOC entry 4533 (class 1259 OID 17948)
-- Name: idx_exec_run_lineage_run; Type: INDEX; Schema: execution; Owner: postgres
--

CREATE INDEX idx_exec_run_lineage_run ON execution.run_lineage USING btree (pipeline_run_id);


--
-- TOC entry 4534 (class 1259 OID 17949)
-- Name: idx_exec_run_lineage_src; Type: INDEX; Schema: execution; Owner: postgres
--

CREATE INDEX idx_exec_run_lineage_src ON execution.run_lineage USING btree (src_dataset_id);


--
-- TOC entry 4535 (class 1259 OID 17950)
-- Name: idx_exec_run_lineage_tgt; Type: INDEX; Schema: execution; Owner: postgres
--

CREATE INDEX idx_exec_run_lineage_tgt ON execution.run_lineage USING btree (tgt_dataset_id);


--
-- TOC entry 4562 (class 1259 OID 18725)
-- Name: idx_artifacts_generated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_artifacts_generated_at ON public.generated_artifacts USING btree (generated_at DESC);


--
-- TOC entry 4563 (class 1259 OID 18724)
-- Name: idx_artifacts_pipeline_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_artifacts_pipeline_id ON public.generated_artifacts USING btree (pipeline_id);


--
-- TOC entry 4564 (class 1259 OID 18726)
-- Name: idx_artifacts_technology; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_artifacts_technology ON public.generated_artifacts USING btree (technology);


--
-- TOC entry 4565 (class 1259 OID 18751)
-- Name: idx_executions_pipeline_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_executions_pipeline_id ON public.pipeline_executions USING btree (pipeline_id);


--
-- TOC entry 4566 (class 1259 OID 18753)
-- Name: idx_executions_started_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_executions_started_at ON public.pipeline_executions USING btree (started_at DESC);


--
-- TOC entry 4567 (class 1259 OID 18752)
-- Name: idx_executions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_executions_status ON public.pipeline_executions USING btree (status);


--
-- TOC entry 4570 (class 1259 OID 18771)
-- Name: idx_node_templates_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_node_templates_category ON public.node_templates USING btree (category);


--
-- TOC entry 4571 (class 1259 OID 18772)
-- Name: idx_node_templates_sub_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_node_templates_sub_type ON public.node_templates USING btree (sub_type);


--
-- TOC entry 4572 (class 1259 OID 18773)
-- Name: idx_node_templates_tech; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_node_templates_tech ON public.node_templates USING btree (technology);


--
-- TOC entry 4556 (class 1259 OID 18698)
-- Name: idx_pipeline_versions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipeline_versions_created_at ON public.pipeline_versions USING btree (created_at DESC);


--
-- TOC entry 4557 (class 1259 OID 18697)
-- Name: idx_pipeline_versions_pipeline_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipeline_versions_pipeline_id ON public.pipeline_versions USING btree (pipeline_id);


--
-- TOC entry 4550 (class 1259 OID 18676)
-- Name: idx_pipelines_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipelines_active ON public.pipelines USING btree (is_active);


--
-- TOC entry 4551 (class 1259 OID 18675)
-- Name: idx_pipelines_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipelines_name ON public.pipelines USING btree (name);


--
-- TOC entry 4552 (class 1259 OID 18677)
-- Name: idx_pipelines_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipelines_tags ON public.pipelines USING gin (tags);


--
-- TOC entry 4553 (class 1259 OID 18674)
-- Name: idx_pipelines_technology; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipelines_technology ON public.pipelines USING btree (technology);


--
-- TOC entry 4709 (class 2620 OID 18459)
-- Name: connector_health tr_audit_catalog_connector_health; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_audit_catalog_connector_health BEFORE DELETE OR UPDATE ON catalog.connector_health FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4684 (class 2620 OID 18431)
-- Name: connectors tr_audit_catalog_connectors; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_audit_catalog_connectors BEFORE DELETE OR UPDATE ON catalog.connectors FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4686 (class 2620 OID 18432)
-- Name: datasets tr_audit_catalog_datasets; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_audit_catalog_datasets BEFORE DELETE OR UPDATE ON catalog.datasets FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4711 (class 2620 OID 18460)
-- Name: file_format_options tr_audit_catalog_file_format_options; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_audit_catalog_file_format_options BEFORE DELETE OR UPDATE ON catalog.file_format_options FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4708 (class 2620 OID 18458)
-- Name: orchestrator_pipeline_map tr_audit_catalog_orchestrator_pipeline_map; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_audit_catalog_orchestrator_pipeline_map BEFORE DELETE OR UPDATE ON catalog.orchestrator_pipeline_map FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4699 (class 2620 OID 18451)
-- Name: orchestrator_versions tr_audit_catalog_orchestrator_versions; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_audit_catalog_orchestrator_versions BEFORE DELETE OR UPDATE ON catalog.orchestrator_versions FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4691 (class 2620 OID 18430)
-- Name: orchestrators tr_audit_catalog_orchestrators; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_audit_catalog_orchestrators BEFORE DELETE OR UPDATE ON catalog.orchestrators FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4700 (class 2620 OID 18453)
-- Name: pipeline_parameters tr_audit_catalog_pipeline_parameters; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_audit_catalog_pipeline_parameters BEFORE DELETE OR UPDATE ON catalog.pipeline_parameters FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4690 (class 2620 OID 18429)
-- Name: pipeline_versions tr_audit_catalog_pipeline_versions; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_audit_catalog_pipeline_versions BEFORE DELETE OR UPDATE ON catalog.pipeline_versions FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4688 (class 2620 OID 18428)
-- Name: pipelines tr_audit_catalog_pipelines; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_audit_catalog_pipelines BEFORE DELETE OR UPDATE ON catalog.pipelines FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4710 (class 2620 OID 18461)
-- Name: connector_health tr_ts_catalog_connector_health; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_ts_catalog_connector_health BEFORE UPDATE ON catalog.connector_health FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4685 (class 2620 OID 18439)
-- Name: connectors tr_ts_catalog_connectors; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_ts_catalog_connectors BEFORE UPDATE ON catalog.connectors FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4687 (class 2620 OID 18440)
-- Name: datasets tr_ts_catalog_datasets; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_ts_catalog_datasets BEFORE UPDATE ON catalog.datasets FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4712 (class 2620 OID 18462)
-- Name: file_format_options tr_ts_catalog_file_format_options; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_ts_catalog_file_format_options BEFORE UPDATE ON catalog.file_format_options FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4692 (class 2620 OID 18442)
-- Name: orchestrators tr_ts_catalog_orchestrators; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_ts_catalog_orchestrators BEFORE UPDATE ON catalog.orchestrators FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4689 (class 2620 OID 18441)
-- Name: pipelines tr_ts_catalog_pipelines; Type: TRIGGER; Schema: catalog; Owner: postgres
--

CREATE TRIGGER tr_ts_catalog_pipelines BEFORE UPDATE ON catalog.pipelines FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4682 (class 2620 OID 18427)
-- Name: folders tr_audit_etl_folders; Type: TRIGGER; Schema: etl; Owner: postgres
--

CREATE TRIGGER tr_audit_etl_folders BEFORE DELETE OR UPDATE ON etl.folders FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4680 (class 2620 OID 18426)
-- Name: projects tr_audit_etl_projects; Type: TRIGGER; Schema: etl; Owner: postgres
--

CREATE TRIGGER tr_audit_etl_projects BEFORE DELETE OR UPDATE ON etl.projects FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4676 (class 2620 OID 18425)
-- Name: users tr_audit_etl_users; Type: TRIGGER; Schema: etl; Owner: postgres
--

CREATE TRIGGER tr_audit_etl_users BEFORE DELETE OR UPDATE ON etl.users FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4683 (class 2620 OID 18438)
-- Name: folders tr_ts_etl_folders; Type: TRIGGER; Schema: etl; Owner: postgres
--

CREATE TRIGGER tr_ts_etl_folders BEFORE UPDATE ON etl.folders FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4681 (class 2620 OID 18437)
-- Name: projects tr_ts_etl_projects; Type: TRIGGER; Schema: etl; Owner: postgres
--

CREATE TRIGGER tr_ts_etl_projects BEFORE UPDATE ON etl.projects FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4696 (class 2620 OID 18450)
-- Name: user_work_drafts tr_ts_etl_user_work_drafts; Type: TRIGGER; Schema: etl; Owner: postgres
--

CREATE TRIGGER tr_ts_etl_user_work_drafts BEFORE UPDATE ON etl.user_work_drafts FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4677 (class 2620 OID 18436)
-- Name: users tr_ts_etl_users; Type: TRIGGER; Schema: etl; Owner: postgres
--

CREATE TRIGGER tr_ts_etl_users BEFORE UPDATE ON etl.users FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4701 (class 2620 OID 18454)
-- Name: schedules tr_audit_execution_schedules; Type: TRIGGER; Schema: execution; Owner: postgres
--

CREATE TRIGGER tr_audit_execution_schedules BEFORE DELETE OR UPDATE ON execution.schedules FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4702 (class 2620 OID 18446)
-- Name: schedules tr_ts_execution_schedules; Type: TRIGGER; Schema: execution; Owner: postgres
--

CREATE TRIGGER tr_ts_execution_schedules BEFORE UPDATE ON execution.schedules FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4697 (class 2620 OID 18452)
-- Name: data_classifications tr_audit_gov_data_classifications; Type: TRIGGER; Schema: gov; Owner: postgres
--

CREATE TRIGGER tr_audit_gov_data_classifications BEFORE DELETE OR UPDATE ON gov.data_classifications FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4694 (class 2620 OID 18434)
-- Name: glossary_terms tr_audit_gov_glossary_terms; Type: TRIGGER; Schema: gov; Owner: postgres
--

CREATE TRIGGER tr_audit_gov_glossary_terms BEFORE DELETE OR UPDATE ON gov.glossary_terms FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4703 (class 2620 OID 18455)
-- Name: notification_rules tr_audit_gov_notification_rules; Type: TRIGGER; Schema: gov; Owner: postgres
--

CREATE TRIGGER tr_audit_gov_notification_rules BEFORE DELETE OR UPDATE ON gov.notification_rules FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4678 (class 2620 OID 18433)
-- Name: roles tr_audit_gov_roles; Type: TRIGGER; Schema: gov; Owner: postgres
--

CREATE TRIGGER tr_audit_gov_roles BEFORE DELETE OR UPDATE ON gov.roles FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4698 (class 2620 OID 18447)
-- Name: data_classifications tr_ts_gov_data_class; Type: TRIGGER; Schema: gov; Owner: postgres
--

CREATE TRIGGER tr_ts_gov_data_class BEFORE UPDATE ON gov.data_classifications FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4693 (class 2620 OID 18444)
-- Name: dq_rules tr_ts_gov_dq_rules; Type: TRIGGER; Schema: gov; Owner: postgres
--

CREATE TRIGGER tr_ts_gov_dq_rules BEFORE UPDATE ON gov.dq_rules FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4695 (class 2620 OID 18445)
-- Name: glossary_terms tr_ts_gov_glossary_terms; Type: TRIGGER; Schema: gov; Owner: postgres
--

CREATE TRIGGER tr_ts_gov_glossary_terms BEFORE UPDATE ON gov.glossary_terms FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4679 (class 2620 OID 18443)
-- Name: secrets tr_ts_gov_secrets; Type: TRIGGER; Schema: gov; Owner: postgres
--

CREATE TRIGGER tr_ts_gov_secrets BEFORE UPDATE ON gov.secrets FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4704 (class 2620 OID 18457)
-- Name: cdc_configurations tr_audit_meta_cdc_configurations; Type: TRIGGER; Schema: meta; Owner: postgres
--

CREATE TRIGGER tr_audit_meta_cdc_configurations BEFORE DELETE OR UPDATE ON meta.cdc_configurations FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4706 (class 2620 OID 18456)
-- Name: platform_settings tr_audit_meta_platform_settings; Type: TRIGGER; Schema: meta; Owner: postgres
--

CREATE TRIGGER tr_audit_meta_platform_settings BEFORE DELETE OR UPDATE ON meta.platform_settings FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();


--
-- TOC entry 4705 (class 2620 OID 18448)
-- Name: cdc_configurations tr_ts_meta_cdc_config; Type: TRIGGER; Schema: meta; Owner: postgres
--

CREATE TRIGGER tr_ts_meta_cdc_config BEFORE UPDATE ON meta.cdc_configurations FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4707 (class 2620 OID 18449)
-- Name: platform_settings tr_ts_meta_platform_set; Type: TRIGGER; Schema: meta; Owner: postgres
--

CREATE TRIGGER tr_ts_meta_platform_set BEFORE UPDATE ON meta.platform_settings FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();


--
-- TOC entry 4714 (class 2620 OID 18776)
-- Name: node_templates trg_node_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_node_templates_updated_at BEFORE UPDATE ON public.node_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4713 (class 2620 OID 18775)
-- Name: pipelines trg_pipelines_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_pipelines_updated_at BEFORE UPDATE ON public.pipelines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4660 (class 2606 OID 17799)
-- Name: asset_tags asset_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.asset_tags
    ADD CONSTRAINT asset_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES catalog.tags(tag_id) ON DELETE CASCADE;


--
-- TOC entry 4661 (class 2606 OID 17804)
-- Name: asset_tags asset_tags_tagged_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.asset_tags
    ADD CONSTRAINT asset_tags_tagged_by_user_id_fkey FOREIGN KEY (tagged_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4610 (class 2606 OID 17090)
-- Name: branches branches_base_version_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.branches
    ADD CONSTRAINT branches_base_version_id_fkey FOREIGN KEY (base_version_id) REFERENCES catalog.pipeline_versions(version_id) ON DELETE SET NULL;


--
-- TOC entry 4611 (class 2606 OID 17095)
-- Name: branches branches_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.branches
    ADD CONSTRAINT branches_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4612 (class 2606 OID 17085)
-- Name: branches branches_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.branches
    ADD CONSTRAINT branches_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE;


--
-- TOC entry 4656 (class 2606 OID 17734)
-- Name: connection_test_results connection_test_results_connector_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connection_test_results
    ADD CONSTRAINT connection_test_results_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES catalog.connectors(connector_id) ON DELETE CASCADE;


--
-- TOC entry 4657 (class 2606 OID 17739)
-- Name: connection_test_results connection_test_results_tested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connection_test_results
    ADD CONSTRAINT connection_test_results_tested_by_user_id_fkey FOREIGN KEY (tested_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4671 (class 2606 OID 17969)
-- Name: connector_health connector_health_connector_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connector_health
    ADD CONSTRAINT connector_health_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES catalog.connectors(connector_id) ON DELETE CASCADE;


--
-- TOC entry 4588 (class 2606 OID 16856)
-- Name: connectors connectors_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connectors
    ADD CONSTRAINT connectors_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4589 (class 2606 OID 24646)
-- Name: connectors connectors_technology_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connectors
    ADD CONSTRAINT connectors_technology_id_fkey FOREIGN KEY (technology_id) REFERENCES meta.technology_types(tech_id) ON DELETE SET NULL;


--
-- TOC entry 4590 (class 2606 OID 16861)
-- Name: connectors connectors_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.connectors
    ADD CONSTRAINT connectors_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4649 (class 2606 OID 17668)
-- Name: data_lineage data_lineage_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.data_lineage
    ADD CONSTRAINT data_lineage_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE;


--
-- TOC entry 4650 (class 2606 OID 17678)
-- Name: data_lineage data_lineage_src_dataset_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.data_lineage
    ADD CONSTRAINT data_lineage_src_dataset_id_fkey FOREIGN KEY (src_dataset_id) REFERENCES catalog.datasets(dataset_id) ON DELETE SET NULL;


--
-- TOC entry 4651 (class 2606 OID 17683)
-- Name: data_lineage data_lineage_tgt_dataset_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.data_lineage
    ADD CONSTRAINT data_lineage_tgt_dataset_id_fkey FOREIGN KEY (tgt_dataset_id) REFERENCES catalog.datasets(dataset_id) ON DELETE SET NULL;


--
-- TOC entry 4652 (class 2606 OID 17673)
-- Name: data_lineage data_lineage_version_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.data_lineage
    ADD CONSTRAINT data_lineage_version_id_fkey FOREIGN KEY (version_id) REFERENCES catalog.pipeline_versions(version_id) ON DELETE CASCADE;


--
-- TOC entry 4594 (class 2606 OID 16917)
-- Name: dataset_columns dataset_columns_dataset_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.dataset_columns
    ADD CONSTRAINT dataset_columns_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES catalog.datasets(dataset_id) ON DELETE CASCADE;


--
-- TOC entry 4595 (class 2606 OID 16922)
-- Name: dataset_columns dataset_columns_fk_ref_dataset_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.dataset_columns
    ADD CONSTRAINT dataset_columns_fk_ref_dataset_id_fkey FOREIGN KEY (fk_ref_dataset_id) REFERENCES catalog.datasets(dataset_id) ON DELETE SET NULL;


--
-- TOC entry 4591 (class 2606 OID 16883)
-- Name: datasets datasets_connector_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.datasets
    ADD CONSTRAINT datasets_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES catalog.connectors(connector_id) ON DELETE CASCADE;


--
-- TOC entry 4592 (class 2606 OID 16888)
-- Name: datasets datasets_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.datasets
    ADD CONSTRAINT datasets_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4593 (class 2606 OID 16893)
-- Name: datasets datasets_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.datasets
    ADD CONSTRAINT datasets_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4672 (class 2606 OID 18003)
-- Name: file_format_options file_format_options_connector_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.file_format_options
    ADD CONSTRAINT file_format_options_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES catalog.connectors(connector_id) ON DELETE CASCADE;


--
-- TOC entry 4604 (class 2606 OID 17578)
-- Name: orchestrators fk_orchestrators_active_version; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrators
    ADD CONSTRAINT fk_orchestrators_active_version FOREIGN KEY (active_orch_version_id) REFERENCES catalog.orchestrator_versions(orch_version_id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4596 (class 2606 OID 17007)
-- Name: pipelines fk_pipelines_active_version; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipelines
    ADD CONSTRAINT fk_pipelines_active_version FOREIGN KEY (active_version_id) REFERENCES catalog.pipeline_versions(version_id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4609 (class 2606 OID 17065)
-- Name: node_templates node_templates_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.node_templates
    ADD CONSTRAINT node_templates_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4666 (class 2606 OID 17911)
-- Name: orchestrator_pipeline_map orchestrator_pipeline_map_orch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrator_pipeline_map
    ADD CONSTRAINT orchestrator_pipeline_map_orch_id_fkey FOREIGN KEY (orch_id) REFERENCES catalog.orchestrators(orch_id) ON DELETE CASCADE;


--
-- TOC entry 4667 (class 2606 OID 17916)
-- Name: orchestrator_pipeline_map orchestrator_pipeline_map_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrator_pipeline_map
    ADD CONSTRAINT orchestrator_pipeline_map_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE;


--
-- TOC entry 4643 (class 2606 OID 17568)
-- Name: orchestrator_versions orchestrator_versions_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrator_versions
    ADD CONSTRAINT orchestrator_versions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4644 (class 2606 OID 17563)
-- Name: orchestrator_versions orchestrator_versions_orch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrator_versions
    ADD CONSTRAINT orchestrator_versions_orch_id_fkey FOREIGN KEY (orch_id) REFERENCES catalog.orchestrators(orch_id) ON DELETE CASCADE;


--
-- TOC entry 4605 (class 2606 OID 17040)
-- Name: orchestrators orchestrators_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrators
    ADD CONSTRAINT orchestrators_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4606 (class 2606 OID 17035)
-- Name: orchestrators orchestrators_folder_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrators
    ADD CONSTRAINT orchestrators_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES etl.folders(folder_id) ON DELETE SET NULL;


--
-- TOC entry 4607 (class 2606 OID 17030)
-- Name: orchestrators orchestrators_project_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrators
    ADD CONSTRAINT orchestrators_project_id_fkey FOREIGN KEY (project_id) REFERENCES etl.projects(project_id) ON DELETE CASCADE;


--
-- TOC entry 4608 (class 2606 OID 17573)
-- Name: orchestrators orchestrators_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orchestrators
    ADD CONSTRAINT orchestrators_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4603 (class 2606 OID 17002)
-- Name: pipeline_contents pipeline_contents_version_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_contents
    ADD CONSTRAINT pipeline_contents_version_id_fkey FOREIGN KEY (version_id) REFERENCES catalog.pipeline_versions(version_id) ON DELETE CASCADE;


--
-- TOC entry 4653 (class 2606 OID 17716)
-- Name: pipeline_dataset_map pipeline_dataset_map_dataset_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_dataset_map
    ADD CONSTRAINT pipeline_dataset_map_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES catalog.datasets(dataset_id) ON DELETE CASCADE;


--
-- TOC entry 4654 (class 2606 OID 17706)
-- Name: pipeline_dataset_map pipeline_dataset_map_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_dataset_map
    ADD CONSTRAINT pipeline_dataset_map_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE;


--
-- TOC entry 4655 (class 2606 OID 17711)
-- Name: pipeline_dataset_map pipeline_dataset_map_version_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_dataset_map
    ADD CONSTRAINT pipeline_dataset_map_version_id_fkey FOREIGN KEY (version_id) REFERENCES catalog.pipeline_versions(version_id) ON DELETE CASCADE;


--
-- TOC entry 4645 (class 2606 OID 17602)
-- Name: pipeline_parameters pipeline_parameters_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_parameters
    ADD CONSTRAINT pipeline_parameters_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE;


--
-- TOC entry 4658 (class 2606 OID 17759)
-- Name: pipeline_validation_results pipeline_validation_results_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_validation_results
    ADD CONSTRAINT pipeline_validation_results_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE;


--
-- TOC entry 4659 (class 2606 OID 17764)
-- Name: pipeline_validation_results pipeline_validation_results_validated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_validation_results
    ADD CONSTRAINT pipeline_validation_results_validated_by_user_id_fkey FOREIGN KEY (validated_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4601 (class 2606 OID 16984)
-- Name: pipeline_versions pipeline_versions_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_versions
    ADD CONSTRAINT pipeline_versions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4602 (class 2606 OID 16979)
-- Name: pipeline_versions pipeline_versions_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipeline_versions
    ADD CONSTRAINT pipeline_versions_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE;


--
-- TOC entry 4597 (class 2606 OID 16954)
-- Name: pipelines pipelines_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipelines
    ADD CONSTRAINT pipelines_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4598 (class 2606 OID 16949)
-- Name: pipelines pipelines_folder_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipelines
    ADD CONSTRAINT pipelines_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES etl.folders(folder_id) ON DELETE SET NULL;


--
-- TOC entry 4599 (class 2606 OID 16944)
-- Name: pipelines pipelines_project_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipelines
    ADD CONSTRAINT pipelines_project_id_fkey FOREIGN KEY (project_id) REFERENCES etl.projects(project_id) ON DELETE CASCADE;


--
-- TOC entry 4600 (class 2606 OID 16959)
-- Name: pipelines pipelines_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.pipelines
    ADD CONSTRAINT pipelines_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4586 (class 2606 OID 16826)
-- Name: folders folders_parent_folder_id_fkey; Type: FK CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.folders
    ADD CONSTRAINT folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES etl.folders(folder_id) ON DELETE CASCADE;


--
-- TOC entry 4587 (class 2606 OID 16821)
-- Name: folders folders_project_id_fkey; Type: FK CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.folders
    ADD CONSTRAINT folders_project_id_fkey FOREIGN KEY (project_id) REFERENCES etl.projects(project_id) ON DELETE CASCADE;


--
-- TOC entry 4584 (class 2606 OID 16794)
-- Name: projects projects_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.projects
    ADD CONSTRAINT projects_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4585 (class 2606 OID 16799)
-- Name: projects projects_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.projects
    ADD CONSTRAINT projects_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4579 (class 2606 OID 16689)
-- Name: user_attributes user_attributes_user_id_fkey; Type: FK CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.user_attributes
    ADD CONSTRAINT user_attributes_user_id_fkey FOREIGN KEY (user_id) REFERENCES etl.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4633 (class 2606 OID 17458)
-- Name: user_work_drafts user_work_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: etl; Owner: postgres
--

ALTER TABLE ONLY etl.user_work_drafts
    ADD CONSTRAINT user_work_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES etl.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4625 (class 2606 OID 17296)
-- Name: generated_artifacts generated_artifacts_generated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.generated_artifacts
    ADD CONSTRAINT generated_artifacts_generated_by_user_id_fkey FOREIGN KEY (generated_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4626 (class 2606 OID 17286)
-- Name: generated_artifacts generated_artifacts_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.generated_artifacts
    ADD CONSTRAINT generated_artifacts_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE;


--
-- TOC entry 4627 (class 2606 OID 17291)
-- Name: generated_artifacts generated_artifacts_pipeline_version_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.generated_artifacts
    ADD CONSTRAINT generated_artifacts_pipeline_version_id_fkey FOREIGN KEY (pipeline_version_id) REFERENCES catalog.pipeline_versions(version_id) ON DELETE CASCADE;


--
-- TOC entry 4620 (class 2606 OID 17198)
-- Name: orchestrator_pipeline_run_map orchestrator_pipeline_run_map_orch_run_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.orchestrator_pipeline_run_map
    ADD CONSTRAINT orchestrator_pipeline_run_map_orch_run_id_fkey FOREIGN KEY (orch_run_id) REFERENCES execution.orchestrator_runs(orch_run_id) ON DELETE CASCADE;


--
-- TOC entry 4621 (class 2606 OID 17203)
-- Name: orchestrator_pipeline_run_map orchestrator_pipeline_run_map_pipeline_run_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.orchestrator_pipeline_run_map
    ADD CONSTRAINT orchestrator_pipeline_run_map_pipeline_run_id_fkey FOREIGN KEY (pipeline_run_id) REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE;


--
-- TOC entry 4617 (class 2606 OID 17177)
-- Name: orchestrator_runs orchestrator_runs_env_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.orchestrator_runs
    ADD CONSTRAINT orchestrator_runs_env_id_fkey FOREIGN KEY (env_id) REFERENCES execution.environments(env_id);


--
-- TOC entry 4618 (class 2606 OID 17172)
-- Name: orchestrator_runs orchestrator_runs_orch_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.orchestrator_runs
    ADD CONSTRAINT orchestrator_runs_orch_id_fkey FOREIGN KEY (orch_id) REFERENCES catalog.orchestrators(orch_id);


--
-- TOC entry 4619 (class 2606 OID 17182)
-- Name: orchestrator_runs orchestrator_runs_triggered_by_user_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.orchestrator_runs
    ADD CONSTRAINT orchestrator_runs_triggered_by_user_id_fkey FOREIGN KEY (triggered_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4622 (class 2606 OID 17222)
-- Name: pipeline_node_runs pipeline_node_runs_pipeline_run_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_node_runs
    ADD CONSTRAINT pipeline_node_runs_pipeline_run_id_fkey FOREIGN KEY (pipeline_run_id) REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE;


--
-- TOC entry 4623 (class 2606 OID 17242)
-- Name: pipeline_run_logs pipeline_run_logs_pipeline_run_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_run_logs
    ADD CONSTRAINT pipeline_run_logs_pipeline_run_id_fkey FOREIGN KEY (pipeline_run_id) REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE;


--
-- TOC entry 4624 (class 2606 OID 17262)
-- Name: pipeline_run_metrics pipeline_run_metrics_pipeline_run_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_run_metrics
    ADD CONSTRAINT pipeline_run_metrics_pipeline_run_id_fkey FOREIGN KEY (pipeline_run_id) REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE;


--
-- TOC entry 4613 (class 2606 OID 17146)
-- Name: pipeline_runs pipeline_runs_env_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_runs
    ADD CONSTRAINT pipeline_runs_env_id_fkey FOREIGN KEY (env_id) REFERENCES execution.environments(env_id);


--
-- TOC entry 4614 (class 2606 OID 17136)
-- Name: pipeline_runs pipeline_runs_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_runs
    ADD CONSTRAINT pipeline_runs_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES catalog.pipelines(pipeline_id);


--
-- TOC entry 4615 (class 2606 OID 17151)
-- Name: pipeline_runs pipeline_runs_triggered_by_user_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_runs
    ADD CONSTRAINT pipeline_runs_triggered_by_user_id_fkey FOREIGN KEY (triggered_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4616 (class 2606 OID 17141)
-- Name: pipeline_runs pipeline_runs_version_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.pipeline_runs
    ADD CONSTRAINT pipeline_runs_version_id_fkey FOREIGN KEY (version_id) REFERENCES catalog.pipeline_versions(version_id);


--
-- TOC entry 4665 (class 2606 OID 17890)
-- Name: run_artifacts run_artifacts_pipeline_run_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.run_artifacts
    ADD CONSTRAINT run_artifacts_pipeline_run_id_fkey FOREIGN KEY (pipeline_run_id) REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE;


--
-- TOC entry 4668 (class 2606 OID 17933)
-- Name: run_lineage run_lineage_pipeline_run_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.run_lineage
    ADD CONSTRAINT run_lineage_pipeline_run_id_fkey FOREIGN KEY (pipeline_run_id) REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE;


--
-- TOC entry 4669 (class 2606 OID 17938)
-- Name: run_lineage run_lineage_src_dataset_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.run_lineage
    ADD CONSTRAINT run_lineage_src_dataset_id_fkey FOREIGN KEY (src_dataset_id) REFERENCES catalog.datasets(dataset_id) ON DELETE SET NULL;


--
-- TOC entry 4670 (class 2606 OID 17943)
-- Name: run_lineage run_lineage_tgt_dataset_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.run_lineage
    ADD CONSTRAINT run_lineage_tgt_dataset_id_fkey FOREIGN KEY (tgt_dataset_id) REFERENCES catalog.datasets(dataset_id) ON DELETE SET NULL;


--
-- TOC entry 4646 (class 2606 OID 17620)
-- Name: run_parameters run_parameters_pipeline_run_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.run_parameters
    ADD CONSTRAINT run_parameters_pipeline_run_id_fkey FOREIGN KEY (pipeline_run_id) REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE;


--
-- TOC entry 4647 (class 2606 OID 17650)
-- Name: schedules schedules_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.schedules
    ADD CONSTRAINT schedules_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4648 (class 2606 OID 17645)
-- Name: schedules schedules_env_id_fkey; Type: FK CONSTRAINT; Schema: execution; Owner: postgres
--

ALTER TABLE ONLY execution.schedules
    ADD CONSTRAINT schedules_env_id_fkey FOREIGN KEY (env_id) REFERENCES execution.environments(env_id) ON DELETE SET NULL;


--
-- TOC entry 4638 (class 2606 OID 17504)
-- Name: connector_access connector_access_connector_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.connector_access
    ADD CONSTRAINT connector_access_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES catalog.connectors(connector_id) ON DELETE CASCADE;


--
-- TOC entry 4639 (class 2606 OID 17519)
-- Name: connector_access connector_access_granted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.connector_access
    ADD CONSTRAINT connector_access_granted_by_user_id_fkey FOREIGN KEY (granted_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4640 (class 2606 OID 17514)
-- Name: connector_access connector_access_role_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.connector_access
    ADD CONSTRAINT connector_access_role_id_fkey FOREIGN KEY (role_id) REFERENCES gov.roles(role_id) ON DELETE CASCADE;


--
-- TOC entry 4641 (class 2606 OID 17509)
-- Name: connector_access connector_access_user_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.connector_access
    ADD CONSTRAINT connector_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES etl.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4642 (class 2606 OID 17542)
-- Name: data_classifications data_classifications_classified_by_user_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.data_classifications
    ADD CONSTRAINT data_classifications_classified_by_user_id_fkey FOREIGN KEY (classified_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4631 (class 2606 OID 17382)
-- Name: data_contracts data_contracts_dataset_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.data_contracts
    ADD CONSTRAINT data_contracts_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES catalog.datasets(dataset_id) ON DELETE CASCADE;


--
-- TOC entry 4628 (class 2606 OID 17335)
-- Name: dq_results dq_results_pipeline_run_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.dq_results
    ADD CONSTRAINT dq_results_pipeline_run_id_fkey FOREIGN KEY (pipeline_run_id) REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE;


--
-- TOC entry 4629 (class 2606 OID 17340)
-- Name: dq_results dq_results_rule_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.dq_results
    ADD CONSTRAINT dq_results_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES gov.dq_rules(rule_id);


--
-- TOC entry 4630 (class 2606 OID 17364)
-- Name: glossary_terms glossary_terms_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.glossary_terms
    ADD CONSTRAINT glossary_terms_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4662 (class 2606 OID 17827)
-- Name: notification_rules notification_rules_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.notification_rules
    ADD CONSTRAINT notification_rules_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4634 (class 2606 OID 17488)
-- Name: project_user_roles project_user_roles_granted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.project_user_roles
    ADD CONSTRAINT project_user_roles_granted_by_user_id_fkey FOREIGN KEY (granted_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4635 (class 2606 OID 17473)
-- Name: project_user_roles project_user_roles_project_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.project_user_roles
    ADD CONSTRAINT project_user_roles_project_id_fkey FOREIGN KEY (project_id) REFERENCES etl.projects(project_id) ON DELETE CASCADE;


--
-- TOC entry 4636 (class 2606 OID 17483)
-- Name: project_user_roles project_user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.project_user_roles
    ADD CONSTRAINT project_user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES gov.roles(role_id) ON DELETE CASCADE;


--
-- TOC entry 4637 (class 2606 OID 17478)
-- Name: project_user_roles project_user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.project_user_roles
    ADD CONSTRAINT project_user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES etl.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4580 (class 2606 OID 16737)
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES gov.permissions(permission_id) ON DELETE CASCADE;


--
-- TOC entry 4581 (class 2606 OID 16732)
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES gov.roles(role_id) ON DELETE CASCADE;


--
-- TOC entry 4582 (class 2606 OID 16754)
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES gov.roles(role_id) ON DELETE CASCADE;


--
-- TOC entry 4583 (class 2606 OID 16749)
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: gov; Owner: postgres
--

ALTER TABLE ONLY gov.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES etl.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4663 (class 2606 OID 17849)
-- Name: cdc_configurations cdc_configurations_dataset_id_fkey; Type: FK CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.cdc_configurations
    ADD CONSTRAINT cdc_configurations_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES catalog.datasets(dataset_id) ON DELETE CASCADE;


--
-- TOC entry 4632 (class 2606 OID 17435)
-- Name: global_variable_registry global_variable_registry_project_id_fkey; Type: FK CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.global_variable_registry
    ADD CONSTRAINT global_variable_registry_project_id_fkey FOREIGN KEY (project_id) REFERENCES etl.projects(project_id) ON DELETE CASCADE;


--
-- TOC entry 4664 (class 2606 OID 17870)
-- Name: platform_settings platform_settings_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: meta; Owner: postgres
--

ALTER TABLE ONLY meta.platform_settings
    ADD CONSTRAINT platform_settings_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES etl.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4674 (class 2606 OID 18746)
-- Name: pipeline_executions pipeline_executions_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT pipeline_executions_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.generated_artifacts(id);


--
-- TOC entry 4675 (class 2606 OID 18741)
-- Name: pipeline_executions pipeline_executions_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT pipeline_executions_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id);


--
-- TOC entry 4673 (class 2606 OID 18692)
-- Name: pipeline_versions pipeline_versions_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_versions
    ADD CONSTRAINT pipeline_versions_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE;


-- Completed on 2026-03-19 08:03:41 IST

--
-- PostgreSQL database dump complete
--

\unrestrict 81p27Zt0dMhQZEa6MCUvv47RPGTCSrucrseqmAscMlhhrV88bNUJviY4rfhdAHv

