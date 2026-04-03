-- ############################################################################
-- # FILE: 01_base_tables.sql
-- # PURPOSE: Step 2 of 12. ALL table definitions ONLY. Zero functions.
-- #          Execute AFTER 00_extensions_schemas.sql.
-- #
-- # ARCHITECTURAL LAWS ENFORCED:
-- #   Law 1:  All objects schema-qualified (etl.*, catalog.*, etc.)
-- #   Law 4:  Physical deletes only — no is_deleted column
-- #   Law 6:  No version column
-- #   Law 8:  Single-tenant — no tenants table, no tenant_id column
-- #   Law 9:  No workspaces table
-- #   Law 10: No reserved-word column names
-- #   Law 12: Folder-to-folder parent_folder_id self-reference
-- #   Law 13: 100% COMMENT coverage on all tables and columns
-- #   Law 14: Pipeline IR payload stored in catalog.pipeline_contents
-- ############################################################################

BEGIN;

-- ============================================================================
-- LAYER 1: IDENTITY & ACCESS MANAGEMENT (etl schema)
-- ============================================================================

CREATE TABLE etl.users (
    user_id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_address       TEXT        NOT NULL UNIQUE,
    -- Law 3: password stored encrypted via pgcrypto
    password_hash_text  TEXT        NOT NULL,
    user_full_name      TEXT        NOT NULL,
    is_account_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    mfa_enabled_flag    BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Law 3: MFA secret encrypted via pgcrypto
    mfa_secret_encrypted TEXT,
    last_login_dtm      TIMESTAMPTZ,
    created_dtm         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  etl.users                      IS 'Central identity store for all platform users on this single-tenant instance.';
COMMENT ON COLUMN etl.users.user_id              IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN etl.users.email_address        IS 'Primary unique login credential and communication address.';
COMMENT ON COLUMN etl.users.password_hash_text   IS 'bcrypt or pgcrypto salted hash of the user password. Never store plaintext.';
COMMENT ON COLUMN etl.users.user_full_name       IS 'Display name shown across the UI (e.g., "Jane Doe").';
COMMENT ON COLUMN etl.users.is_account_active    IS 'Administratively controlled flag; FALSE disables login without deleting the record.';
COMMENT ON COLUMN etl.users.mfa_enabled_flag     IS 'TRUE when the user has enrolled in TOTP-based Multi-Factor Authentication.';
COMMENT ON COLUMN etl.users.mfa_secret_encrypted IS 'pgcrypto-encrypted TOTP seed. Decrypted only during MFA verification.';
COMMENT ON COLUMN etl.users.last_login_dtm       IS 'Timestamp of the most recent successful authentication event.';
COMMENT ON COLUMN etl.users.created_dtm          IS 'Record creation timestamp; immutable after insert.';
COMMENT ON COLUMN etl.users.updated_dtm          IS 'Timestamp of the last field modification; updated by trigger or application.';


CREATE TABLE etl.user_attributes (
    attr_id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID    NOT NULL REFERENCES etl.users(user_id) ON DELETE CASCADE,
    attr_key_name    TEXT    NOT NULL,
    attr_value_text  TEXT    NOT NULL,
    is_sensitive_flag BOOLEAN NOT NULL DEFAULT FALSE,
    created_dtm      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, attr_key_name)
);

COMMENT ON TABLE  etl.user_attributes               IS 'Extensible key-value profile metadata for users (e.g., theme preference, notification settings).';
COMMENT ON COLUMN etl.user_attributes.attr_id        IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN etl.user_attributes.user_id        IS 'FK to etl.users; cascade-deleted when user is removed.';
COMMENT ON COLUMN etl.user_attributes.attr_key_name  IS 'Logical attribute name (e.g., UI_THEME, DEFAULT_PROJECT_ID).';
COMMENT ON COLUMN etl.user_attributes.attr_value_text IS 'String-serialized value for the attribute.';
COMMENT ON COLUMN etl.user_attributes.is_sensitive_flag IS 'When TRUE, the value must be masked in logs and API responses.';
COMMENT ON COLUMN etl.user_attributes.created_dtm    IS 'Timestamp when this attribute was first set.';


-- ============================================================================
-- LAYER 2: GOVERNANCE — RBAC (gov schema)
-- ============================================================================

CREATE TABLE gov.permissions (
    permission_id         UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    perm_code_name        TEXT  NOT NULL UNIQUE,
    perm_display_name     TEXT  NOT NULL,
    perm_desc_text        TEXT
);

COMMENT ON TABLE  gov.permissions                   IS 'Atomic, system-defined access rights (e.g., pipeline.publish, user.delete).';
COMMENT ON COLUMN gov.permissions.permission_id     IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN gov.permissions.perm_code_name    IS 'Machine-readable permission code (e.g., PIPELINE_PUBLISH). Must be unique.';
COMMENT ON COLUMN gov.permissions.perm_display_name IS 'Human-readable label for the permission to display in the Admin UI.';
COMMENT ON COLUMN gov.permissions.perm_desc_text    IS 'Detailed explanation of what this permission grants.';


CREATE TABLE gov.roles (
    role_id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_display_name    TEXT    NOT NULL UNIQUE,
    role_desc_text       TEXT,
    is_system_role_flag  BOOLEAN NOT NULL DEFAULT FALSE,
    created_dtm          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  gov.roles                      IS 'Named bundles of permissions assigned to users (e.g., ADMIN, DEVELOPER, VIEWER).';
COMMENT ON COLUMN gov.roles.role_id              IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN gov.roles.role_display_name    IS 'Unique human-readable label for the role.';
COMMENT ON COLUMN gov.roles.role_desc_text       IS 'Description of the role''s scope and responsibilities.';
COMMENT ON COLUMN gov.roles.is_system_role_flag  IS 'TRUE for built-in roles (SUPER_ADMIN) that cannot be deleted via the UI.';
COMMENT ON COLUMN gov.roles.created_dtm          IS 'Timestamp when this role was defined.';


CREATE TABLE gov.role_permissions (
    role_id       UUID NOT NULL REFERENCES gov.roles(role_id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES gov.permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE  gov.role_permissions              IS 'M2M mapping granting permissions to roles.';
COMMENT ON COLUMN gov.role_permissions.role_id      IS 'FK to gov.roles.';
COMMENT ON COLUMN gov.role_permissions.permission_id IS 'FK to gov.permissions.';


CREATE TABLE gov.user_roles (
    user_id UUID NOT NULL REFERENCES etl.users(user_id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES gov.roles(role_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE  gov.user_roles         IS 'M2M mapping assigning roles to platform users.';
COMMENT ON COLUMN gov.user_roles.user_id IS 'FK to etl.users.';
COMMENT ON COLUMN gov.user_roles.role_id IS 'FK to gov.roles.';


-- ============================================================================
-- LAYER 3: SECRETS (gov schema)
-- ============================================================================

CREATE TABLE gov.secrets (
    secret_id              UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    secret_key_name        TEXT  NOT NULL UNIQUE,
    -- Law 3: value encrypted with pgcrypto pgp_sym_encrypt
    secret_value_encrypted TEXT  NOT NULL,
    vault_provider_type    TEXT  NOT NULL DEFAULT 'INTERNAL',
    created_dtm            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  gov.secrets                        IS 'Encrypted vault for connector credentials and API keys.';
COMMENT ON COLUMN gov.secrets.secret_id              IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN gov.secrets.secret_key_name        IS 'Logical name for referencing this secret (e.g., PROD_SNOWFLAKE_PWD).';
COMMENT ON COLUMN gov.secrets.secret_value_encrypted IS 'pgp_sym_encrypt output. Decrypted at runtime using app.encryption_key session variable.';
COMMENT ON COLUMN gov.secrets.vault_provider_type    IS 'Where the secret originates: INTERNAL, AWS_SECRETS_MANAGER, HASHICORP_VAULT, GCP_SECRET_MANAGER.';
COMMENT ON COLUMN gov.secrets.created_dtm            IS 'Timestamp when the secret was first stored.';
COMMENT ON COLUMN gov.secrets.updated_dtm            IS 'Timestamp of the last rotation or update.';


-- ============================================================================
-- LAYER 4: PROJECT HIERARCHY (etl schema)
-- ============================================================================

CREATE TABLE etl.projects (
    project_id            UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_display_name  TEXT  NOT NULL UNIQUE,
    project_desc_text     TEXT,
    -- No lifecycle_status_code: a project exists or is deleted (physical delete, Law 4)
    -- No owner_user_id: access is governed by gov.user_roles permissions, not single ownership
    created_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id    UUID  REFERENCES etl.users(user_id) ON DELETE SET NULL,
    updated_by_user_id    UUID  REFERENCES etl.users(user_id) ON DELETE SET NULL
);

COMMENT ON TABLE  etl.projects                     IS 'Top-level container for all data engineering artifacts. Access controlled via gov.user_roles.';
COMMENT ON COLUMN etl.projects.project_id          IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN etl.projects.project_display_name IS 'Human-readable unique name for the project across the instance.';
COMMENT ON COLUMN etl.projects.project_desc_text   IS 'Optional free-text description of this project''s purpose and scope.';
COMMENT ON COLUMN etl.projects.created_dtm         IS 'Record creation timestamp; immutable after insert.';
COMMENT ON COLUMN etl.projects.updated_dtm         IS 'Timestamp of the last project metadata modification.';
COMMENT ON COLUMN etl.projects.created_by_user_id  IS 'FK to the user who created this project.';
COMMENT ON COLUMN etl.projects.updated_by_user_id  IS 'FK to the last user who modified this project record.';


-- Law 12: Folder-to-folder parent_folder_id self-reference for unlimited nesting
CREATE TABLE etl.folders (
    folder_id               UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id              UUID  NOT NULL REFERENCES etl.projects(project_id) ON DELETE CASCADE,
    -- Law 12: Self-referential FK enabling parent→child folder nesting
    parent_folder_id        UUID  REFERENCES etl.folders(folder_id) ON DELETE CASCADE,
    folder_display_name     TEXT  NOT NULL,
    -- LTREE enables O(1) subtree queries (e.g., all descendants of a folder)
    hierarchical_path_ltree LTREE NOT NULL,
    folder_type_code        TEXT  NOT NULL,
    created_dtm             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_etl_folders_ltree ON etl.folders USING gist(hierarchical_path_ltree);
COMMENT ON TABLE  etl.folders                         IS 'Hierarchical navigation nodes within a project. Supports unlimited depth via LTREE.';
COMMENT ON COLUMN etl.folders.folder_id               IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN etl.folders.project_id              IS 'FK to the owning project; cascade-deleted when project is removed.';
COMMENT ON COLUMN etl.folders.parent_folder_id        IS 'Self-referential FK to parent folder. NULL for root-level folders.';
COMMENT ON COLUMN etl.folders.folder_display_name     IS 'User-visible name of the folder as shown in the navigation tree.';
COMMENT ON COLUMN etl.folders.hierarchical_path_ltree IS 'Materialized LTREE path (e.g., pipelines.etl.finance). Enables fast subtree and ancestor queries.';
COMMENT ON COLUMN etl.folders.folder_type_code        IS 'Category constraint: PIPELINE_ROOT, ORCH_ROOT, PIPELINE, ORCHESTRATOR, RESOURCE.';
COMMENT ON COLUMN etl.folders.created_dtm             IS 'Record creation timestamp.';
COMMENT ON COLUMN etl.folders.updated_dtm             IS 'Timestamp of the last folder rename or move.';


-- ============================================================================
-- LAYER 5: DATA CATALOG — CONNECTORS & DATASETS (catalog schema)
-- ============================================================================

CREATE TABLE catalog.connectors (
    connector_id                  UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_display_name        TEXT  NOT NULL UNIQUE,
    -- Connector type enum: AWS_S3, AWS_REDSHIFT, AWS_RDS, GCP_GCS, GCP_BIGQUERY, GCP_BIGTABLE,
    -- AZURE_BLOB, AZURE_ADLS_GEN2, AZURE_SYNAPSE, SNOWFLAKE, DATABRICKS, OCI_OBJECT,
    -- OCI_AUTONOMOUS_DB, JDBC_POSTGRESQL, JDBC_MYSQL, JDBC_MARIADB, JDBC_SQLSERVER,
    -- JDBC_ORACLE, JDBC_DB2, JDBC_SAP_HANA, JDBC_TERADATA, JDBC_GREENPLUM, JDBC_SYBASE,
    -- FILE_CSV, FILE_PARQUET, FILE_ORC, FILE_JSON, FILE_XML, FILE_EXCEL, FILE_AVRO,
    -- FILE_FIXED_WIDTH, FILE_DELTA, FILE_ICEBERG, FILE_HUDI, HDFS, LOCAL_FILESYSTEM
    connector_type_code           TEXT  NOT NULL,
    -- Law 3: Non-secret config (host, port, database, warehouse, role, region, etc.) encrypted via pgcrypto
    conn_config_json_encrypted    TEXT  NOT NULL,
    -- Law 3: Secrets (passwords, access keys, SA keys, client secrets) encrypted separately via pgcrypto
    conn_secrets_json_encrypted   TEXT,
    -- Optional JDBC driver class override; defaults are provided per connector type
    conn_jdbc_driver_class        TEXT,
    -- Maven coordinates for the JDBC driver JAR used by Spark (e.g., org.postgresql:postgresql:42.7.3)
    conn_jdbc_driver_maven_coords TEXT,
    -- Connection-specific search paths or path hints for the JDBC driver JAR(s)
    conn_jdbc_driver_paths        TEXT,
    -- Optional override for the connectivity test query (defaults per connector type)
    conn_test_query               TEXT,
    -- Additional Spark session config key-value pairs injected at codegen time
    conn_spark_config_json        JSONB,
    -- SSL/TLS enforcement mode: DISABLE, REQUIRE, VERIFY_CA, VERIFY_FULL
    conn_ssl_mode                 TEXT  NOT NULL DEFAULT 'REQUIRE',
    -- SSH tunnel config if the target is not directly reachable; encrypted
    conn_ssh_tunnel_json_encrypted TEXT,
    -- HTTP/SOCKS proxy config; encrypted
    conn_proxy_json_encrypted     TEXT,
    -- Connection pool configuration
    conn_max_pool_size_num        INTEGER NOT NULL DEFAULT 5,
    conn_idle_timeout_sec         INTEGER NOT NULL DEFAULT 600,
    -- No is_active_flag: a connector either exists or is physically deleted (Law 4)
    created_dtm                   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm                   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id            UUID  REFERENCES etl.users(user_id) ON DELETE SET NULL,
    updated_by_user_id            UUID  REFERENCES etl.users(user_id) ON DELETE SET NULL
);

COMMENT ON TABLE  catalog.connectors                                 IS 'Centralized registry of data source and sink connection definitions. Supports cloud (AWS, GCP, Azure, Snowflake, Databricks, OCI), on-premises JDBC, file formats, and object storage connectors.';
COMMENT ON COLUMN catalog.connectors.connector_id                    IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.connectors.connector_display_name          IS 'Unique user-facing label for this connector (e.g., "Production Snowflake DWH").';
COMMENT ON COLUMN catalog.connectors.connector_type_code             IS 'Connector class enum: AWS_S3, AWS_REDSHIFT, GCP_BIGQUERY, SNOWFLAKE, DATABRICKS, JDBC_POSTGRESQL, FILE_CSV, FILE_PARQUET, etc. Drives which IConnectorPlugin handles this connector.';
COMMENT ON COLUMN catalog.connectors.conn_config_json_encrypted      IS 'pgcrypto pgp_sym_encrypt output (TEXT armoured). Contains non-secret config: host, port, database, warehouse, role, region, auth_method, storage_bucket, etc. Decrypted only at execution or test time.';
COMMENT ON COLUMN catalog.connectors.conn_secrets_json_encrypted     IS 'pgcrypto pgp_sym_encrypt output (TEXT armoured). Contains all secrets: passwords, access keys, SA key JSON, client secrets, private keys, OAuth tokens. NULL when connector uses identity-based auth (Instance Profile, Managed Identity, Workload Identity).';
COMMENT ON COLUMN catalog.connectors.conn_jdbc_driver_class          IS 'Override JDBC driver class name (e.g., org.postgresql.Driver). NULL uses the platform default per connector_type_code.';
COMMENT ON COLUMN catalog.connectors.conn_jdbc_driver_maven_coords   IS 'Maven coordinates for the JDBC driver JAR (e.g., org.postgresql:postgresql:42.7.3). Passed via --packages to spark-submit at execution time. For cluster environments use the appropriate cluster-accessible coords.';
COMMENT ON COLUMN catalog.connectors.conn_jdbc_driver_paths          IS 'Connection-specific comma-separated path hints for JDBC driver resolution. Entries may be directories or explicit jar paths visible to the Spark submission environment.';
COMMENT ON COLUMN catalog.connectors.conn_test_query                 IS 'Override connectivity test query (e.g., SELECT 1). NULL uses the platform default per connector_type_code.';
COMMENT ON COLUMN catalog.connectors.conn_spark_config_json          IS 'Additional Spark session configuration key-value pairs injected at codegen time. Used for connector-specific Spark tuning (e.g., fetchsize, pushdown predicates).';
COMMENT ON COLUMN catalog.connectors.conn_ssl_mode                   IS 'SSL/TLS enforcement: DISABLE (dev only — not recommended), REQUIRE (encrypt but skip cert verify), VERIFY_CA (verify server cert), VERIFY_FULL (verify cert + hostname). Default REQUIRE.';
COMMENT ON COLUMN catalog.connectors.conn_ssh_tunnel_json_encrypted  IS 'pgcrypto-encrypted SSH tunnel config: host, port, username, private_key_pem. NULL when direct connection is available. Used only by the preview service — Spark clusters require network-level access.';
COMMENT ON COLUMN catalog.connectors.conn_proxy_json_encrypted       IS 'pgcrypto-encrypted HTTP/SOCKS proxy configuration: proxy_host, proxy_port, proxy_type, proxy_username, proxy_password. NULL for direct connections.';
COMMENT ON COLUMN catalog.connectors.conn_max_pool_size_num          IS 'Maximum number of concurrent connections in the JDBC pool for this connector. Default 5, configurable per Non-Functional Requirements.';
COMMENT ON COLUMN catalog.connectors.conn_idle_timeout_sec           IS 'JDBC connection pool idle timeout in seconds. Default 600 (10 minutes).';
COMMENT ON COLUMN catalog.connectors.created_dtm                     IS 'Record creation timestamp; immutable after insert.';
COMMENT ON COLUMN catalog.connectors.updated_dtm                     IS 'Timestamp of the last configuration update.';
COMMENT ON COLUMN catalog.connectors.created_by_user_id              IS 'FK to the user who registered this connector.';
COMMENT ON COLUMN catalog.connectors.updated_by_user_id              IS 'FK to the last user who modified this connector record.';


CREATE TABLE catalog.datasets (
    dataset_id         UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_id       UUID  NOT NULL REFERENCES catalog.connectors(connector_id) ON DELETE CASCADE,
    db_name_text       TEXT,
    schema_name_text   TEXT,
    table_name_text    TEXT  NOT NULL,
    dataset_type_code  TEXT  NOT NULL DEFAULT 'TABLE',
    -- No is_vetted_flag: vague manual flag with no workflow backing
    -- No dataset_metadata_json: all schema detail is in catalog.dataset_columns rows
    estimated_row_count_num BIGINT,
    last_introspection_dtm  TIMESTAMPTZ,
    created_dtm             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id      UUID  REFERENCES etl.users(user_id) ON DELETE SET NULL,
    updated_by_user_id      UUID  REFERENCES etl.users(user_id) ON DELETE SET NULL
);

COMMENT ON TABLE  catalog.datasets                        IS 'Physical data assets (tables, views, files) discovered and registered in the metadata catalog.';
COMMENT ON COLUMN catalog.datasets.dataset_id             IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.datasets.connector_id           IS 'FK to the connector through which this dataset is accessed.';
COMMENT ON COLUMN catalog.datasets.db_name_text           IS 'Database or catalog name on the source system. NULL for file-based sources.';
COMMENT ON COLUMN catalog.datasets.schema_name_text       IS 'Schema or namespace on the source system (e.g., PUBLIC, DBO).';
COMMENT ON COLUMN catalog.datasets.table_name_text        IS 'Physical table, view, or file name as it exists in the source system.';
COMMENT ON COLUMN catalog.datasets.dataset_type_code      IS 'Asset classification: TABLE, VIEW, FILE, STREAM, API_ENDPOINT.';
COMMENT ON COLUMN catalog.datasets.estimated_row_count_num IS 'Row count sampled during last introspection scan. Used for UI display and DQ rule thresholds.';
COMMENT ON COLUMN catalog.datasets.last_introspection_dtm IS 'Timestamp of the most recent successful schema introspection from the source system.';
COMMENT ON COLUMN catalog.datasets.created_dtm            IS 'Record creation timestamp.';
COMMENT ON COLUMN catalog.datasets.updated_dtm            IS 'Timestamp of the last metadata update.';
COMMENT ON COLUMN catalog.datasets.created_by_user_id     IS 'FK to the user who registered this dataset.';
COMMENT ON COLUMN catalog.datasets.updated_by_user_id     IS 'FK to the last user who modified this dataset record.';


CREATE TABLE catalog.dataset_columns (
    column_id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id             UUID    NOT NULL REFERENCES catalog.datasets(dataset_id) ON DELETE CASCADE,
    column_name_text       TEXT    NOT NULL,
    data_type_code         TEXT    NOT NULL,
    override_data_type_code TEXT,
    parse_format_text      TEXT,
    is_nullable_flag       BOOLEAN NOT NULL DEFAULT TRUE,
    ordinal_position_num   INTEGER NOT NULL,
    -- Source-system constraint tracking
    constraint_type_code   TEXT,
    -- For FK columns: the referenced (parent) dataset and column
    fk_ref_dataset_id      UUID    REFERENCES catalog.datasets(dataset_id) ON DELETE SET NULL,
    fk_ref_column_name_text TEXT,
    column_desc_text       TEXT,
    created_dtm            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (dataset_id, column_name_text)
);

COMMENT ON TABLE  catalog.dataset_columns                       IS 'Column-level schema registry, including source-system constraint metadata (PK, UK, FK, NOT NULL).';
COMMENT ON COLUMN catalog.dataset_columns.column_id             IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.dataset_columns.dataset_id            IS 'FK to the parent dataset; cascade-deleted when dataset is removed.';
COMMENT ON COLUMN catalog.dataset_columns.column_name_text      IS 'Physical column name exactly as it exists in the source system.';
COMMENT ON COLUMN catalog.dataset_columns.data_type_code        IS 'Source-system native data type string (e.g., VARCHAR(255), NUMBER(38,0), TIMESTAMP_TZ).';
COMMENT ON COLUMN catalog.dataset_columns.override_data_type_code IS 'Optional user-corrected effective data type. When set, ETL code generation should prefer this over the imported source-system type.';
COMMENT ON COLUMN catalog.dataset_columns.parse_format_text     IS 'Optional Spark-compatible format mask for parsing date/timestamp text values at this column level (e.g., dd-MMM-yyyy, yyyy-MM-dd HH:mm:ss).';
COMMENT ON COLUMN catalog.dataset_columns.is_nullable_flag      IS 'FALSE when the source column has a NOT NULL constraint.';
COMMENT ON COLUMN catalog.dataset_columns.ordinal_position_num  IS 'Column order position (1-indexed) as defined in the source schema.';
COMMENT ON COLUMN catalog.dataset_columns.constraint_type_code  IS 'Source-system constraint on this column: PK (Primary Key), UK (Unique Key), FK (Foreign Key), NONE. A column can appear multiple times for composite keys.';
COMMENT ON COLUMN catalog.dataset_columns.fk_ref_dataset_id     IS 'For FK columns only: FK to the referenced (parent) dataset in this catalog.';
COMMENT ON COLUMN catalog.dataset_columns.fk_ref_column_name_text IS 'For FK columns only: name of the referenced column on the parent dataset.';
COMMENT ON COLUMN catalog.dataset_columns.column_desc_text      IS 'Business-facing description or data steward annotation for this column.';
COMMENT ON COLUMN catalog.dataset_columns.created_dtm           IS 'Timestamp when this column record was registered.';


-- ============================================================================
-- LAYER 6: PIPELINE & ORCHESTRATION (catalog schema)
-- ============================================================================

CREATE TABLE catalog.pipelines (
    pipeline_id             UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id              UUID  NOT NULL REFERENCES etl.projects(project_id) ON DELETE CASCADE,
    folder_id               UUID  REFERENCES etl.folders(folder_id) ON DELETE SET NULL,
    pipeline_display_name   TEXT  NOT NULL,
    pipeline_desc_text      TEXT,
    -- No is_template_flag: a pipeline is a pipeline; reuse is handled by copying/branching
    -- No lifecycle_status_code: a pipeline exists (has versions) or is deleted (Law 4)
    -- Circular FK resolved after catalog.pipeline_versions is created
    active_version_id       UUID,
    created_dtm             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id      UUID  REFERENCES etl.users(user_id) ON DELETE SET NULL,
    updated_by_user_id      UUID  REFERENCES etl.users(user_id) ON DELETE SET NULL,
    inherit_project_permissions BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (project_id, pipeline_display_name)
);

COMMENT ON TABLE  catalog.pipelines                       IS 'Logical definition of a Spark ETL data flow. A pipeline exists once created; its state is implied by whether it has a committed version.';
COMMENT ON COLUMN catalog.pipelines.pipeline_id           IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.pipelines.project_id            IS 'FK to the owning project; cascade-deleted when project is removed.';
COMMENT ON COLUMN catalog.pipelines.folder_id             IS 'FK to the navigation folder this pipeline lives in. NULL means project root.';
COMMENT ON COLUMN catalog.pipelines.pipeline_display_name IS 'User-visible unique name for this pipeline within the project.';
COMMENT ON COLUMN catalog.pipelines.pipeline_desc_text    IS 'Optional free-text summary of the pipeline purpose and expected output.';
COMMENT ON COLUMN catalog.pipelines.active_version_id     IS 'FK to the most recently committed version. NULL until first commit.';
COMMENT ON COLUMN catalog.pipelines.created_dtm           IS 'Record creation timestamp.';
COMMENT ON COLUMN catalog.pipelines.updated_dtm           IS 'Timestamp of the last metadata update (not version commit).';
COMMENT ON COLUMN catalog.pipelines.created_by_user_id    IS 'FK to the user who originally created this pipeline.';
COMMENT ON COLUMN catalog.pipelines.updated_by_user_id    IS 'FK to the last user who modified the pipeline metadata.';
COMMENT ON COLUMN catalog.pipelines.inherit_project_permissions IS 'When TRUE (default), all project-level role grants automatically apply to this pipeline. When FALSE, only explicit per-pipeline grants apply — the pipeline has its own isolated access list.';


CREATE TABLE catalog.pipeline_versions (
    version_id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id        UUID    NOT NULL REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE,
    version_num_seq    INTEGER NOT NULL,
    commit_msg_text    TEXT,
    release_tag_label  TEXT,
    created_dtm        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id UUID    REFERENCES etl.users(user_id) ON DELETE SET NULL,
    UNIQUE (pipeline_id, version_num_seq)
);

COMMENT ON TABLE  catalog.pipeline_versions                  IS 'Immutable snapshots of a pipeline at a specific point in time.';
COMMENT ON COLUMN catalog.pipeline_versions.version_id       IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.pipeline_versions.pipeline_id      IS 'FK to the parent pipeline; cascade-deleted when pipeline is removed.';
COMMENT ON COLUMN catalog.pipeline_versions.version_num_seq  IS 'Monotonically increasing version number (1, 2, 3...).';
COMMENT ON COLUMN catalog.pipeline_versions.commit_msg_text  IS 'Developer-provided message describing what changed in this version.';
COMMENT ON COLUMN catalog.pipeline_versions.release_tag_label IS 'Optional semantic version label (e.g., v1.0.0, STABLE, RC-2).';
COMMENT ON COLUMN catalog.pipeline_versions.created_dtm      IS 'Timestamp when this version was published.';
COMMENT ON COLUMN catalog.pipeline_versions.created_by_user_id IS 'FK to the user who committed this version.';


-- Law 14: Pipeline body storage — mandatory, non-negotiable
CREATE TABLE catalog.pipeline_contents (
    content_id           UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id           UUID  NOT NULL REFERENCES catalog.pipeline_versions(version_id) ON DELETE CASCADE,
    -- The actual, complete pipeline logic in Internal Representation format
    ir_payload_json      JSONB NOT NULL,
    -- Frontend metadata: node positions, canvas zoom, colors, etc.
    ui_layout_json       JSONB,
    -- MD5 checksum of ir_payload_json for integrity verification
    content_checksum_text TEXT,
    created_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  catalog.pipeline_contents                   IS 'Law 14: Mandatory storage for pipeline body. Every version must have exactly one content record.';
COMMENT ON COLUMN catalog.pipeline_contents.content_id        IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.pipeline_contents.version_id        IS 'FK to the parent pipeline version; 1:1 relationship.';
COMMENT ON COLUMN catalog.pipeline_contents.ir_payload_json   IS 'THE PIPELINE BODY: complete Internal Representation (IR) JSON defining all nodes, edges, transformations, and parameters.';
COMMENT ON COLUMN catalog.pipeline_contents.ui_layout_json    IS 'Frontend-only rendering metadata: node XY positions, zoom level, collapsed state, color overrides.';
COMMENT ON COLUMN catalog.pipeline_contents.content_checksum_text IS 'MD5 hash of ir_payload_json used to detect corruption or unauthorised modification.';
COMMENT ON COLUMN catalog.pipeline_contents.created_dtm       IS 'Timestamp when this content snapshot was persisted.';


-- Resolve the circular FK now that pipeline_versions exists
ALTER TABLE catalog.pipelines
    ADD CONSTRAINT fk_pipelines_active_version
    FOREIGN KEY (active_version_id) REFERENCES catalog.pipeline_versions(version_id) DEFERRABLE INITIALLY DEFERRED;


CREATE TABLE catalog.orchestrators (
    orch_id                 UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id              UUID  NOT NULL REFERENCES etl.projects(project_id) ON DELETE CASCADE,
    folder_id               UUID  REFERENCES etl.folders(folder_id) ON DELETE SET NULL,
    orch_display_name       TEXT  NOT NULL,
    orch_desc_text          TEXT,
    -- The orchestrator DAG: pipeline references, dependencies, scheduling config
    dag_definition_json     JSONB NOT NULL,
    created_dtm             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id      UUID  REFERENCES etl.users(user_id) ON DELETE SET NULL,
    inherit_project_permissions BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (project_id, orch_display_name)
);

COMMENT ON TABLE  catalog.orchestrators                     IS 'High-level DAG orchestration definitions that coordinate multiple pipeline executions.';
COMMENT ON COLUMN catalog.orchestrators.orch_id             IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.orchestrators.project_id          IS 'FK to the owning project; cascade-deleted when project is removed.';
COMMENT ON COLUMN catalog.orchestrators.folder_id           IS 'FK to the navigation folder.';
COMMENT ON COLUMN catalog.orchestrators.orch_display_name   IS 'Unique label for this orchestrator within the project.';
COMMENT ON COLUMN catalog.orchestrators.orch_desc_text      IS 'Optional description of the orchestrated workflow.';
COMMENT ON COLUMN catalog.orchestrators.dag_definition_json IS 'JSONB DAG structure: pipeline_ids, dependency edges, retry policies, and scheduling parameters.';
COMMENT ON COLUMN catalog.orchestrators.created_dtm         IS 'Record creation timestamp.';
COMMENT ON COLUMN catalog.orchestrators.updated_dtm         IS 'Timestamp of the last DAG or metadata update.';
COMMENT ON COLUMN catalog.orchestrators.created_by_user_id  IS 'FK to the user who created this orchestrator.';
COMMENT ON COLUMN catalog.orchestrators.inherit_project_permissions IS 'When TRUE (default), all project-level role grants automatically apply to this orchestrator. When FALSE, only explicit per-orchestrator grants apply.';


-- ============================================================================
-- LAYER 7: BRANCHING (catalog schema)
-- ============================================================================

CREATE TABLE catalog.branches (
    branch_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id        UUID NOT NULL REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE,
    branch_display_name TEXT NOT NULL,
    base_version_id    UUID REFERENCES catalog.pipeline_versions(version_id) ON DELETE SET NULL,
    created_dtm        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id UUID REFERENCES etl.users(user_id) ON DELETE SET NULL,
    UNIQUE (pipeline_id, branch_display_name)
);

COMMENT ON TABLE  catalog.branches                      IS 'Isolated development streams forked from a base pipeline version.';
COMMENT ON COLUMN catalog.branches.branch_id            IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.branches.pipeline_id          IS 'FK to the parent pipeline.';
COMMENT ON COLUMN catalog.branches.branch_display_name  IS 'Unique label for this branch within the pipeline (e.g., feature/add-dedup).';
COMMENT ON COLUMN catalog.branches.base_version_id      IS 'FK to the version from which this branch was forked.';
COMMENT ON COLUMN catalog.branches.created_dtm          IS 'Timestamp when the branch was created.';
COMMENT ON COLUMN catalog.branches.created_by_user_id   IS 'FK to the user who created this branch.';


-- ============================================================================
-- LAYER 8: EXECUTION ENVIRONMENTS (execution schema)
-- ============================================================================

CREATE TABLE execution.environments (
    env_id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    env_display_name      TEXT    NOT NULL UNIQUE,
    is_prod_env_flag      BOOLEAN NOT NULL DEFAULT FALSE,
    cluster_config_json   JSONB   NOT NULL,
    network_zone_code     TEXT,
    created_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  execution.environments                    IS 'Deployment targets with Spark cluster and network configurations.';
COMMENT ON COLUMN execution.environments.env_id             IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN execution.environments.env_display_name   IS 'Unique label for the environment (e.g., DEV, QA, STAGING, PROD).';
COMMENT ON COLUMN execution.environments.is_prod_env_flag   IS 'TRUE for production environments requiring approval gates and stricter governance.';
COMMENT ON COLUMN execution.environments.cluster_config_json IS 'JSONB: Spark master URL, executor memory, driver cores, dynamic allocation settings.';
COMMENT ON COLUMN execution.environments.network_zone_code  IS 'Network isolation zone identifier (e.g., PRIVATE, DMZ, PUBLIC).';
COMMENT ON COLUMN execution.environments.created_dtm        IS 'Record creation timestamp.';
COMMENT ON COLUMN execution.environments.updated_dtm        IS 'Timestamp of the last cluster configuration change.';


-- ============================================================================
-- LAYER 9: EXECUTION PLANE (execution schema)
-- pipeline_runs: one record per pipeline execution
-- orchestrator_runs: one record per orchestrator execution
-- orchestrator_pipeline_run_map: which pipeline_runs belong to an orchestrator_run
-- pipeline_node_runs: per-DAG-node telemetry within a pipeline_run
-- pipeline_run_logs: chronological log lines for a pipeline_run
-- pipeline_run_metrics: numeric telemetry for a pipeline_run
-- ============================================================================

CREATE TABLE execution.pipeline_runs (
    pipeline_run_id         UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id             UUID     NOT NULL REFERENCES catalog.pipelines(pipeline_id),
    version_id              UUID     NOT NULL REFERENCES catalog.pipeline_versions(version_id),
    env_id                  UUID     REFERENCES execution.environments(env_id),
    run_status_code         TEXT     NOT NULL DEFAULT 'PENDING',
    trigger_type_code       TEXT     NOT NULL DEFAULT 'MANUAL',
    external_engine_job_id  TEXT,
    triggered_by_user_id    UUID     REFERENCES etl.users(user_id) ON DELETE SET NULL,
    start_dtm               TIMESTAMPTZ,
    end_dtm                 TIMESTAMPTZ,
    run_duration_ms         INTEGER,
    rows_processed_num      BIGINT,
    bytes_read_num          BIGINT,
    bytes_written_num       BIGINT,
    error_message_text      TEXT,
    retry_count_num         INTEGER  NOT NULL DEFAULT 0,
    sla_status_code         TEXT     NOT NULL DEFAULT 'N_A',
    spark_ui_url_text       TEXT,
    created_dtm             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  execution.pipeline_runs                          IS 'One record per pipeline execution regardless of what triggered it.';
COMMENT ON COLUMN execution.pipeline_runs.pipeline_run_id          IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN execution.pipeline_runs.pipeline_id              IS 'FK to the pipeline that was executed.';
COMMENT ON COLUMN execution.pipeline_runs.version_id               IS 'FK to the exact version that was deployed during this run.';
COMMENT ON COLUMN execution.pipeline_runs.env_id                   IS 'FK to the environment (DEV/QA/PROD) where the run executed.';
COMMENT ON COLUMN execution.pipeline_runs.run_status_code          IS 'Execution lifecycle: PENDING, RUNNING, SUCCESS, FAILED, KILLED.';
COMMENT ON COLUMN execution.pipeline_runs.trigger_type_code        IS 'How this run was initiated: MANUAL, ORCHESTRATOR, SCHEDULE, EVENT, API.';
COMMENT ON COLUMN execution.pipeline_runs.external_engine_job_id   IS 'Spark Application ID for cross-referencing cluster-level logs.';
COMMENT ON COLUMN execution.pipeline_runs.triggered_by_user_id     IS 'FK to the user for MANUAL triggers; NULL for automated triggers.';
COMMENT ON COLUMN execution.pipeline_runs.start_dtm                IS 'Timestamp when the Spark job began executing on the cluster.';
COMMENT ON COLUMN execution.pipeline_runs.end_dtm                  IS 'Timestamp when the run reached a terminal state.';
COMMENT ON COLUMN execution.pipeline_runs.run_duration_ms          IS 'Elapsed milliseconds from start_dtm to end_dtm; populated on terminal state transition.';
COMMENT ON COLUMN execution.pipeline_runs.rows_processed_num       IS 'Total rows processed across all nodes in the run; populated by the execution engine.';
COMMENT ON COLUMN execution.pipeline_runs.bytes_read_num           IS 'Total bytes read from all source datasets in the run.';
COMMENT ON COLUMN execution.pipeline_runs.bytes_written_num        IS 'Total bytes written to all target datasets in the run.';
COMMENT ON COLUMN execution.pipeline_runs.error_message_text       IS 'Human-readable error summary when run_status_code is FAILED or KILLED.';
COMMENT ON COLUMN execution.pipeline_runs.retry_count_num          IS 'Number of retries attempted for this logical run; zero-based.';
COMMENT ON COLUMN execution.pipeline_runs.sla_status_code          IS 'SLA compliance result: N_A, MET, BREACHED. Populated at run completion.';
COMMENT ON COLUMN execution.pipeline_runs.spark_ui_url_text        IS 'URL to the Spark History Server entry for this run; populated when Spark job is submitted.';
COMMENT ON COLUMN execution.pipeline_runs.created_dtm              IS 'Timestamp when the run record was created in PENDING state.';


CREATE TABLE execution.orchestrator_runs (
    orch_run_id             UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
    orch_id                 UUID     NOT NULL REFERENCES catalog.orchestrators(orch_id),
    env_id                  UUID     REFERENCES execution.environments(env_id),
    run_status_code         TEXT     NOT NULL DEFAULT 'PENDING',
    trigger_type_code       TEXT     NOT NULL DEFAULT 'MANUAL',
    triggered_by_user_id    UUID     REFERENCES etl.users(user_id) ON DELETE SET NULL,
    start_dtm               TIMESTAMPTZ,
    end_dtm                 TIMESTAMPTZ,
    run_duration_ms         INTEGER,
    error_message_text      TEXT,
    retry_count_num         INTEGER  NOT NULL DEFAULT 0,
    created_dtm             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  execution.orchestrator_runs                          IS 'One record per orchestrator DAG execution; parent of all its pipeline runs.';
COMMENT ON COLUMN execution.orchestrator_runs.orch_run_id              IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN execution.orchestrator_runs.orch_id                  IS 'FK to the orchestrator DAG that was executed.';
COMMENT ON COLUMN execution.orchestrator_runs.env_id                   IS 'FK to the environment where the orchestrator ran.';
COMMENT ON COLUMN execution.orchestrator_runs.run_status_code          IS 'Aggregate DAG execution state: PENDING, RUNNING, SUCCESS, PARTIAL_FAIL, FAILED, KILLED.';
COMMENT ON COLUMN execution.orchestrator_runs.trigger_type_code        IS 'How this orchestrator was triggered: MANUAL, SCHEDULE, EVENT, API.';
COMMENT ON COLUMN execution.orchestrator_runs.triggered_by_user_id     IS 'FK to the user for MANUAL triggers; NULL for automated triggers.';
COMMENT ON COLUMN execution.orchestrator_runs.start_dtm                IS 'Timestamp when the first pipeline node began executing.';
COMMENT ON COLUMN execution.orchestrator_runs.end_dtm                  IS 'Timestamp when the last pipeline node reached a terminal state.';
COMMENT ON COLUMN execution.orchestrator_runs.run_duration_ms          IS 'Elapsed milliseconds from start_dtm to end_dtm; populated on terminal state transition.';
COMMENT ON COLUMN execution.orchestrator_runs.error_message_text       IS 'Aggregated error summary when the orchestrator run fails or is partially failed.';
COMMENT ON COLUMN execution.orchestrator_runs.retry_count_num          IS 'Number of retries for this orchestrator run; zero-based.';
COMMENT ON COLUMN execution.orchestrator_runs.created_dtm              IS 'Timestamp when the orchestrator run record was created.';


CREATE TABLE execution.orchestrator_pipeline_run_map (
    orch_run_id         UUID NOT NULL REFERENCES execution.orchestrator_runs(orch_run_id) ON DELETE CASCADE,
    pipeline_run_id     UUID NOT NULL REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE,
    dag_node_id_text    TEXT NOT NULL,
    execution_order_num INTEGER NOT NULL,
    PRIMARY KEY (orch_run_id, pipeline_run_id)
);

COMMENT ON TABLE  execution.orchestrator_pipeline_run_map                IS 'Maps each pipeline_run to its parent orchestrator_run and position in the DAG.';
COMMENT ON COLUMN execution.orchestrator_pipeline_run_map.orch_run_id    IS 'FK to the parent orchestrator run.';
COMMENT ON COLUMN execution.orchestrator_pipeline_run_map.pipeline_run_id IS 'FK to the child pipeline run.';
COMMENT ON COLUMN execution.orchestrator_pipeline_run_map.dag_node_id_text IS 'Node ID in the orchestrator DAG definition that corresponds to this pipeline.';
COMMENT ON COLUMN execution.orchestrator_pipeline_run_map.execution_order_num IS 'Topological order in which this pipeline was scheduled within the DAG.';


CREATE TABLE execution.pipeline_node_runs (
    node_run_id          UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id      UUID  NOT NULL REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE,
    node_id_in_ir_text   TEXT  NOT NULL,
    node_display_name    TEXT,
    node_status_code     TEXT  NOT NULL,
    start_dtm            TIMESTAMPTZ,
    end_dtm              TIMESTAMPTZ,
    rows_in_num          BIGINT,
    rows_out_num         BIGINT,
    error_message_text   TEXT,
    node_metrics_json    JSONB,
    UNIQUE (pipeline_run_id, node_id_in_ir_text)
);

COMMENT ON TABLE  execution.pipeline_node_runs                          IS 'Granular per-node telemetry for every DAG node within a pipeline run.';
COMMENT ON COLUMN execution.pipeline_node_runs.node_run_id              IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN execution.pipeline_node_runs.pipeline_run_id          IS 'FK to the parent pipeline run; cascade-deleted when run is purged.';
COMMENT ON COLUMN execution.pipeline_node_runs.node_id_in_ir_text       IS 'Node identifier from the pipeline IR; correlates to pipeline_contents.ir_payload_json.';
COMMENT ON COLUMN execution.pipeline_node_runs.node_display_name        IS 'Human-readable node label for UI display (copied from IR at execution time).';
COMMENT ON COLUMN execution.pipeline_node_runs.node_status_code         IS 'Node execution state: PENDING, RUNNING, SUCCESS, FAILED, SKIPPED.';
COMMENT ON COLUMN execution.pipeline_node_runs.start_dtm                IS 'Timestamp when this node began processing.';
COMMENT ON COLUMN execution.pipeline_node_runs.end_dtm                  IS 'Timestamp when this node reached a terminal state.';
COMMENT ON COLUMN execution.pipeline_node_runs.rows_in_num              IS 'Input row count for this node; populated at node completion.';
COMMENT ON COLUMN execution.pipeline_node_runs.rows_out_num             IS 'Output row count produced by this node; populated at node completion.';
COMMENT ON COLUMN execution.pipeline_node_runs.error_message_text       IS 'Error message when node_status_code is FAILED.';
COMMENT ON COLUMN execution.pipeline_node_runs.node_metrics_json        IS 'Extended JSONB telemetry: spill_mb, shuffle_bytes, and other engine-specific metrics.';


CREATE TABLE execution.pipeline_run_logs (
    log_id              BIGSERIAL   PRIMARY KEY,
    pipeline_run_id     UUID        NOT NULL REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE,
    log_level_code      TEXT        NOT NULL,
    log_source_code     TEXT,
    log_message_text    TEXT        NOT NULL,
    created_dtm         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  execution.pipeline_run_logs                    IS 'Chronological log stream from Spark driver and executors for a pipeline run.';
COMMENT ON COLUMN execution.pipeline_run_logs.log_id             IS 'Sequential surrogate key; BIGSERIAL preserves insertion order.';
COMMENT ON COLUMN execution.pipeline_run_logs.pipeline_run_id    IS 'FK to the parent pipeline run.';
COMMENT ON COLUMN execution.pipeline_run_logs.log_level_code     IS 'Log severity: DEBUG, INFO, WARN, ERROR, FATAL.';
COMMENT ON COLUMN execution.pipeline_run_logs.log_source_code    IS 'Origin of the log line: DRIVER, EXECUTOR_n, SYSTEM_FINALIZER.';
COMMENT ON COLUMN execution.pipeline_run_logs.log_message_text   IS 'Raw log message text from the Spark runtime.';
COMMENT ON COLUMN execution.pipeline_run_logs.created_dtm        IS 'Timestamp when this log line was received and stored.';


CREATE TABLE execution.pipeline_run_metrics (
    metric_id            BIGSERIAL   PRIMARY KEY,
    pipeline_run_id      UUID        NOT NULL REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE,
    metric_name_text     TEXT        NOT NULL,
    metric_value_num     NUMERIC     NOT NULL,
    recorded_dtm         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  execution.pipeline_run_metrics                    IS 'Numeric telemetry time-series for a pipeline run.';
COMMENT ON COLUMN execution.pipeline_run_metrics.metric_id          IS 'Sequential surrogate key; BIGSERIAL for ordering.';
COMMENT ON COLUMN execution.pipeline_run_metrics.pipeline_run_id    IS 'FK to the parent pipeline run.';
COMMENT ON COLUMN execution.pipeline_run_metrics.metric_name_text   IS 'Metric identifier (e.g., input_rows, output_rows, bytes_written, executor_memory_mb).';
COMMENT ON COLUMN execution.pipeline_run_metrics.metric_value_num   IS 'Numeric measurement at the time of recording.';
COMMENT ON COLUMN execution.pipeline_run_metrics.recorded_dtm       IS 'Timestamp when this metric data point was captured.';


-- ============================================================================
-- LAYER 10: DATA QUALITY (gov schema)
-- ============================================================================

CREATE TABLE gov.dq_rules (
    rule_id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_type_code  TEXT    NOT NULL,
    target_id         UUID    NOT NULL,
    rule_type_code    TEXT    NOT NULL,
    rule_config_json  JSONB   NOT NULL,
    severity_code     TEXT    NOT NULL DEFAULT 'ERROR',
    is_active_flag    BOOLEAN NOT NULL DEFAULT TRUE,
    created_dtm       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  gov.dq_rules                   IS 'Declarative data quality validation rules applicable to datasets, columns, or pipeline sinks.';
COMMENT ON COLUMN gov.dq_rules.rule_id           IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN gov.dq_rules.target_type_code  IS 'Entity this rule applies to: DATASET, COLUMN, PIPELINE_SINK.';
COMMENT ON COLUMN gov.dq_rules.target_id         IS 'UUID of the target entity (dataset_id, column_id, etc.).';
COMMENT ON COLUMN gov.dq_rules.rule_type_code    IS 'Rule category: NULL_CHECK, ROW_COUNT_THRESHOLD, SCHEMA_DRIFT, REGEX, UNIQUENESS.';
COMMENT ON COLUMN gov.dq_rules.rule_config_json  IS 'JSONB parameters for the rule (e.g., {"threshold": 1000, "operator": "GT"}).';
COMMENT ON COLUMN gov.dq_rules.severity_code     IS 'Failure impact: INFO (log only), WARNING (alert), ERROR (fail job).';
COMMENT ON COLUMN gov.dq_rules.is_active_flag    IS 'FALSE to suspend a rule without deleting its history.';
COMMENT ON COLUMN gov.dq_rules.created_dtm       IS 'Record creation timestamp.';
COMMENT ON COLUMN gov.dq_rules.updated_dtm       IS 'Timestamp of the last rule configuration change.';


CREATE TABLE gov.dq_results (
    result_id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id      UUID    NOT NULL REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE,
    rule_id              UUID    REFERENCES gov.dq_rules(rule_id),
    passed_flag          BOOLEAN NOT NULL,
    actual_value_text    TEXT,
    error_message_text   TEXT,
    created_dtm          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  gov.dq_results                       IS 'Runtime evaluation results for DQ rules executed within a pipeline run.';
COMMENT ON COLUMN gov.dq_results.result_id             IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN gov.dq_results.pipeline_run_id       IS 'FK to the pipeline run during which this DQ check was evaluated.';
COMMENT ON COLUMN gov.dq_results.rule_id               IS 'FK to the DQ rule that was evaluated. NULL for ad-hoc assertions.';
COMMENT ON COLUMN gov.dq_results.passed_flag           IS 'TRUE if data satisfied the rule; FALSE triggers severity-based action (log/alert/fail).';
COMMENT ON COLUMN gov.dq_results.actual_value_text     IS 'The observed metric value at evaluation time (e.g., "982" rows vs threshold "1000").';
COMMENT ON COLUMN gov.dq_results.error_message_text    IS 'Human-readable failure description when passed_flag is FALSE.';
COMMENT ON COLUMN gov.dq_results.created_dtm           IS 'Timestamp when this DQ result was recorded.';


-- ============================================================================
-- LAYER 11: BUSINESS GLOSSARY (gov schema)
-- ============================================================================

CREATE TABLE gov.glossary_terms (
    term_id           UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    term_display_name TEXT  NOT NULL UNIQUE,
    term_def_text     TEXT  NOT NULL,
    owner_user_id     UUID  REFERENCES etl.users(user_id) ON DELETE SET NULL,
    approval_status_code TEXT NOT NULL DEFAULT 'DRAFT',
    created_dtm       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  gov.glossary_terms                     IS 'Enterprise business vocabulary for standardizing data definitions.';
COMMENT ON COLUMN gov.glossary_terms.term_id             IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN gov.glossary_terms.term_display_name   IS 'Unique business term (e.g., "Customer Lifetime Value").';
COMMENT ON COLUMN gov.glossary_terms.term_def_text       IS 'Full formal definition of the term as agreed by the data governance board.';
COMMENT ON COLUMN gov.glossary_terms.owner_user_id       IS 'FK to the data steward responsible for this term.';
COMMENT ON COLUMN gov.glossary_terms.approval_status_code IS 'Lifecycle: DRAFT, IN_REVIEW, APPROVED, DEPRECATED.';
COMMENT ON COLUMN gov.glossary_terms.created_dtm         IS 'Record creation timestamp.';
COMMENT ON COLUMN gov.glossary_terms.updated_dtm         IS 'Timestamp of the last definition update.';


CREATE TABLE gov.data_contracts (
    contract_id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id             UUID    NOT NULL REFERENCES catalog.datasets(dataset_id) ON DELETE CASCADE,
    sla_availability_pct   NUMERIC CHECK (sla_availability_pct BETWEEN 0 AND 100),
    sla_freshness_sec      INTEGER,
    contact_email_addr     TEXT,
    created_dtm            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  gov.data_contracts                    IS 'Formal SLA agreements defining availability and freshness expectations for datasets.';
COMMENT ON COLUMN gov.data_contracts.contract_id        IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN gov.data_contracts.dataset_id         IS 'FK to the dataset this contract governs.';
COMMENT ON COLUMN gov.data_contracts.sla_availability_pct IS 'Required uptime percentage (e.g., 99.9).';
COMMENT ON COLUMN gov.data_contracts.sla_freshness_sec  IS 'Maximum allowed data age in seconds before the SLA is considered breached.';
COMMENT ON COLUMN gov.data_contracts.contact_email_addr IS 'On-call contact email for SLA breach notifications.';
COMMENT ON COLUMN gov.data_contracts.created_dtm        IS 'Timestamp when this contract was established.';


-- ============================================================================
-- LAYER 12: META REGISTRIES (meta schema)
-- ============================================================================

CREATE TABLE meta.type_mapping_registry (
    mapping_id        UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    src_tech_code     TEXT    NOT NULL,
    target_tech_code  TEXT    NOT NULL,
    src_type_name     TEXT    NOT NULL,
    target_type_name  TEXT    NOT NULL,
    is_lossless_flag  BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (src_tech_code, target_tech_code, src_type_name)
);

COMMENT ON TABLE  meta.type_mapping_registry               IS 'Cross-technology data type translation registry used by the pipeline compiler.';
COMMENT ON COLUMN meta.type_mapping_registry.mapping_id    IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN meta.type_mapping_registry.src_tech_code IS 'Source technology (e.g., SNOWFLAKE, ORACLE, POSTGRES).';
COMMENT ON COLUMN meta.type_mapping_registry.target_tech_code IS 'Target technology (e.g., SPARK_SQL, DATABRICKS_DELTA).';
COMMENT ON COLUMN meta.type_mapping_registry.src_type_name IS 'Source-native type string (e.g., NUMBER(38,0)).';
COMMENT ON COLUMN meta.type_mapping_registry.target_type_name IS 'Equivalent target type string (e.g., DECIMAL(38,0)).';
COMMENT ON COLUMN meta.type_mapping_registry.is_lossless_flag IS 'FALSE indicates potential precision or range loss in the conversion.';


CREATE TABLE meta.transform_library (
    lib_id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    lib_display_name   TEXT    NOT NULL,
    lib_type_code      TEXT    NOT NULL,
    storage_uri_text   TEXT    NOT NULL,
    version_label_text TEXT    NOT NULL,
    is_active_flag     BOOLEAN NOT NULL DEFAULT TRUE,
    created_dtm        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  meta.transform_library                  IS 'Registry of reusable code assets: JARs, Python wheels, and SQL UDFs.';
COMMENT ON COLUMN meta.transform_library.lib_id           IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN meta.transform_library.lib_display_name IS 'Human-readable name for the library (e.g., "Finance UDFs v2").';
COMMENT ON COLUMN meta.transform_library.lib_type_code    IS 'Asset type: JAR, WHL, PY_SCRIPT, SQL_SNIPPET.';
COMMENT ON COLUMN meta.transform_library.storage_uri_text IS 'Object storage path where the binary is stored (e.g., s3://libs/finance-udfs-2.0.jar).';
COMMENT ON COLUMN meta.transform_library.version_label_text IS 'Semantic version label (e.g., 2.0.1).';
COMMENT ON COLUMN meta.transform_library.is_active_flag   IS 'FALSE to deprecate without removing pipeline references.';
COMMENT ON COLUMN meta.transform_library.created_dtm      IS 'Timestamp when this library version was registered.';


CREATE TABLE meta.global_variable_registry (
    var_id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id       UUID    REFERENCES etl.projects(project_id) ON DELETE CASCADE,
    var_key_name     TEXT    NOT NULL,
    var_value_text   TEXT,
    is_secret_flag   BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (project_id, var_key_name)
);

COMMENT ON TABLE  meta.global_variable_registry             IS 'Project-scoped runtime variables and parameters for pipeline configuration.';
COMMENT ON COLUMN meta.global_variable_registry.var_id      IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN meta.global_variable_registry.project_id  IS 'FK to the project. NULL for instance-wide variables.';
COMMENT ON COLUMN meta.global_variable_registry.var_key_name IS 'Variable identifier (e.g., SPARK_MAX_PARTITIONS, DEFAULT_DATE_FORMAT).';
COMMENT ON COLUMN meta.global_variable_registry.var_value_text IS 'Serialized variable value.';
COMMENT ON COLUMN meta.global_variable_registry.is_secret_flag IS 'TRUE if the value should be resolved via gov.secrets at runtime.';


-- ============================================================================
-- LAYER 13: UNSAVED CHANGES / DRAFTS (Law 15)
-- ============================================================================

CREATE TABLE etl.user_work_drafts (
    draft_id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id               UUID    NOT NULL REFERENCES etl.users(user_id) ON DELETE CASCADE,
    entity_type_code      TEXT    NOT NULL,
    entity_id             UUID,
    draft_payload_json    JSONB   NOT NULL,
    created_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, entity_type_code, entity_id)
);

COMMENT ON TABLE  etl.user_work_drafts                    IS 'Law 15: Persistence layer for unsaved UI state. Enables session recovery after browser close.';
COMMENT ON COLUMN etl.user_work_drafts.draft_id           IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN etl.user_work_drafts.user_id            IS 'FK to the user whose session this draft belongs to.';
COMMENT ON COLUMN etl.user_work_drafts.entity_type_code   IS 'Asset type being edited: PIPELINE, ORCHESTRATOR, CONNECTOR.';
COMMENT ON COLUMN etl.user_work_drafts.entity_id          IS 'FK to the entity being edited. NULL when the user is creating a brand-new unsaved asset.';
COMMENT ON COLUMN etl.user_work_drafts.draft_payload_json IS 'Complete serialized UI state snapshot (equivalent to what would be stored in pipeline_contents on save).';
COMMENT ON COLUMN etl.user_work_drafts.created_dtm        IS 'Timestamp when the first autosave of this session occurred.';
COMMENT ON COLUMN etl.user_work_drafts.updated_dtm        IS 'Timestamp of the most recent autosave. Useful for "last edited at" display.';



-- ============================================================================
-- LAYER 14: PROJECT-SCOPED RBAC (gov schema)
-- Fine-grained per-project role assignments, separate from instance-wide user_roles
-- ============================================================================

CREATE TABLE gov.project_user_roles (
    project_id         UUID NOT NULL REFERENCES etl.projects(project_id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES etl.users(user_id) ON DELETE CASCADE,
    role_id            UUID NOT NULL REFERENCES gov.roles(role_id) ON DELETE CASCADE,
    granted_dtm        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by_user_id UUID REFERENCES etl.users(user_id) ON DELETE SET NULL,
    PRIMARY KEY (project_id, user_id, role_id)
);

COMMENT ON TABLE  gov.project_user_roles                      IS 'Project-scoped role assignments. A user may be ADMIN in Project A but only VIEWER in Project B. Extends the global gov.user_roles with project context.';
COMMENT ON COLUMN gov.project_user_roles.project_id           IS 'FK to the project this role assignment is scoped to.';
COMMENT ON COLUMN gov.project_user_roles.user_id              IS 'FK to the user receiving the project-scoped role.';
COMMENT ON COLUMN gov.project_user_roles.role_id              IS 'FK to the role granted within this project.';
COMMENT ON COLUMN gov.project_user_roles.granted_dtm          IS 'Timestamp when the project role was granted.';
COMMENT ON COLUMN gov.project_user_roles.granted_by_user_id   IS 'FK to the administrator who granted this project role.';


-- ============================================================================
-- LAYER 15: CONNECTOR-LEVEL ACCESS CONTROL (gov schema)
-- Controls which users or roles can use which connectors
-- ============================================================================

CREATE TABLE gov.connector_access (
    access_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_id       UUID NOT NULL REFERENCES catalog.connectors(connector_id) ON DELETE CASCADE,
    -- At least one of user_id or role_id must be set (check constraint enforces this)
    user_id            UUID REFERENCES etl.users(user_id) ON DELETE CASCADE,
    role_id            UUID REFERENCES gov.roles(role_id) ON DELETE CASCADE,
    granted_dtm        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by_user_id UUID REFERENCES etl.users(user_id) ON DELETE SET NULL,
    CONSTRAINT ck_connector_access_subject CHECK (user_id IS NOT NULL OR role_id IS NOT NULL)
);

COMMENT ON TABLE  gov.connector_access                      IS 'Per-connector access grants controlling which users or roles may use a given connector. Prevents unrestricted access to production credentials.';
COMMENT ON COLUMN gov.connector_access.access_id            IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN gov.connector_access.connector_id         IS 'FK to the connector being access-controlled.';
COMMENT ON COLUMN gov.connector_access.user_id              IS 'FK to a specific user granted access. Mutually optional with role_id but at least one is required.';
COMMENT ON COLUMN gov.connector_access.role_id              IS 'FK to a role whose members are granted access. Mutually optional with user_id but at least one is required.';
COMMENT ON COLUMN gov.connector_access.granted_dtm          IS 'Timestamp when access was granted.';
COMMENT ON COLUMN gov.connector_access.granted_by_user_id   IS 'FK to the administrator who granted the access.';


-- ============================================================================
-- LAYER 16: DATA CLASSIFICATION (gov schema)
-- Sensitivity labels on datasets and columns for compliance (GDPR, CCPA, HIPAA)
-- ============================================================================

CREATE TABLE gov.data_classifications (
    classification_id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_type_code          TEXT    NOT NULL,  -- DATASET or COLUMN
    target_id                 UUID    NOT NULL,
    sensitivity_code          TEXT    NOT NULL,  -- PII, PHI, FINANCIAL, CONFIDENTIAL, INTERNAL, PUBLIC
    classification_notes_text TEXT,
    classified_by_user_id     UUID    REFERENCES etl.users(user_id) ON DELETE SET NULL,
    created_dtm               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (target_type_code, target_id)
);

COMMENT ON TABLE  gov.data_classifications                          IS 'Compliance sensitivity labels on datasets and columns. Drives masking, access restrictions, and audit requirements.';
COMMENT ON COLUMN gov.data_classifications.classification_id        IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN gov.data_classifications.target_type_code         IS 'Entity being classified: DATASET or COLUMN.';
COMMENT ON COLUMN gov.data_classifications.target_id                IS 'UUID of the classified entity (dataset_id or column_id).';
COMMENT ON COLUMN gov.data_classifications.sensitivity_code         IS 'Regulatory/business sensitivity tier: PII, PHI, FINANCIAL, CONFIDENTIAL, INTERNAL, PUBLIC.';
COMMENT ON COLUMN gov.data_classifications.classification_notes_text IS 'Optional justification or notes from the data steward.';
COMMENT ON COLUMN gov.data_classifications.classified_by_user_id    IS 'FK to the data steward who applied this classification.';
COMMENT ON COLUMN gov.data_classifications.created_dtm              IS 'Timestamp when the classification was first applied.';
COMMENT ON COLUMN gov.data_classifications.updated_dtm              IS 'Timestamp when the classification was last changed.';


-- ============================================================================
-- LAYER 17: ORCHESTRATOR VERSIONING (catalog schema)
-- Orchestrators need the same immutable version history as pipelines
-- ============================================================================

CREATE TABLE catalog.orchestrator_versions (
    orch_version_id     UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    orch_id             UUID    NOT NULL REFERENCES catalog.orchestrators(orch_id) ON DELETE CASCADE,
    version_num_seq     INTEGER NOT NULL,
    dag_snapshot_json   JSONB   NOT NULL,
    commit_msg_text     TEXT,
    release_tag_label   TEXT,
    created_dtm         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id  UUID    REFERENCES etl.users(user_id) ON DELETE SET NULL,
    UNIQUE (orch_id, version_num_seq)
);

COMMENT ON TABLE  catalog.orchestrator_versions                 IS 'Immutable version snapshots for orchestrator DAG definitions, mirroring the pipeline versioning model.';
COMMENT ON COLUMN catalog.orchestrator_versions.orch_version_id IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.orchestrator_versions.orch_id         IS 'FK to the parent orchestrator; cascade-deleted when orchestrator is removed.';
COMMENT ON COLUMN catalog.orchestrator_versions.version_num_seq IS 'Monotonically increasing version number (1, 2, 3...) within the orchestrator.';
COMMENT ON COLUMN catalog.orchestrator_versions.dag_snapshot_json IS 'Complete frozen snapshot of the DAG definition at the time of this commit.';
COMMENT ON COLUMN catalog.orchestrator_versions.commit_msg_text IS 'Developer message describing changes in this version.';
COMMENT ON COLUMN catalog.orchestrator_versions.release_tag_label IS 'Optional semantic version label (e.g., v2.0.0, STABLE).';
COMMENT ON COLUMN catalog.orchestrator_versions.created_dtm     IS 'Timestamp when this version was committed.';
COMMENT ON COLUMN catalog.orchestrator_versions.created_by_user_id IS 'FK to the user who committed this orchestrator version.';

-- Add active_orch_version_id to orchestrators to mirror pipeline pattern
ALTER TABLE catalog.orchestrators
    ADD COLUMN active_orch_version_id UUID,
    ADD COLUMN updated_by_user_id     UUID REFERENCES etl.users(user_id) ON DELETE SET NULL;

ALTER TABLE catalog.orchestrators
    ADD CONSTRAINT fk_orchestrators_active_version
    FOREIGN KEY (active_orch_version_id) REFERENCES catalog.orchestrator_versions(orch_version_id) DEFERRABLE INITIALLY DEFERRED;

COMMENT ON COLUMN catalog.orchestrators.active_orch_version_id IS 'FK to the most recently committed orchestrator version. NULL until first commit.';
COMMENT ON COLUMN catalog.orchestrators.updated_by_user_id     IS 'FK to the last user who modified this orchestrator record.';


-- ============================================================================
-- LAYER 18: PIPELINE PARAMETERS (catalog schema)
-- Declared typed runtime parameters for pipelines, overridable at execution time
-- ============================================================================

CREATE TABLE catalog.pipeline_parameters (
    param_id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id          UUID    NOT NULL REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE,
    param_key_name       TEXT    NOT NULL,
    param_data_type_code TEXT    NOT NULL DEFAULT 'STRING',  -- STRING, INTEGER, BOOLEAN, DATE, TIMESTAMP
    default_value_text   TEXT,
    is_required_flag     BOOLEAN NOT NULL DEFAULT FALSE,
    param_desc_text      TEXT,
    created_dtm          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pipeline_id, param_key_name)
);

COMMENT ON TABLE  catalog.pipeline_parameters                   IS 'Declared, typed runtime parameters for a pipeline that can be overridden at execution time without modifying the pipeline body.';
COMMENT ON COLUMN catalog.pipeline_parameters.param_id          IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.pipeline_parameters.pipeline_id       IS 'FK to the pipeline that declares this parameter.';
COMMENT ON COLUMN catalog.pipeline_parameters.param_key_name    IS 'Unique parameter identifier within the pipeline (e.g., RUN_DATE, MAX_ROWS, SOURCE_SCHEMA).';
COMMENT ON COLUMN catalog.pipeline_parameters.param_data_type_code IS 'Expected value type: STRING, INTEGER, BOOLEAN, DATE, TIMESTAMP.';
COMMENT ON COLUMN catalog.pipeline_parameters.default_value_text IS 'Serialized default value used when no override is supplied at run time.';
COMMENT ON COLUMN catalog.pipeline_parameters.is_required_flag  IS 'TRUE means the parameter must be explicitly supplied at run time; job fails if missing.';
COMMENT ON COLUMN catalog.pipeline_parameters.param_desc_text   IS 'Description of the parameter purpose for the run-form UI and documentation.';
COMMENT ON COLUMN catalog.pipeline_parameters.created_dtm       IS 'Timestamp when the parameter was declared.';


-- ============================================================================
-- LAYER 19: RUN PARAMETERS (execution schema)
-- Actual parameter values supplied during a specific pipeline run (for reproducibility)
-- ============================================================================

CREATE TABLE execution.run_parameters (
    run_param_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id    UUID NOT NULL REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE,
    param_key_name     TEXT NOT NULL,
    param_value_text   TEXT,
    UNIQUE (pipeline_run_id, param_key_name)
);

COMMENT ON TABLE  execution.run_parameters                    IS 'The exact parameter values used during a specific pipeline run. Enables full reproducibility and debugging of historic executions.';
COMMENT ON COLUMN execution.run_parameters.run_param_id      IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN execution.run_parameters.pipeline_run_id   IS 'FK to the pipeline run that consumed these parameters.';
COMMENT ON COLUMN execution.run_parameters.param_key_name    IS 'Parameter key matching catalog.pipeline_parameters.param_key_name.';
COMMENT ON COLUMN execution.run_parameters.param_value_text   IS 'Serialized value used for this run. NULL if the default was applied.';


-- ============================================================================
-- LAYER 20: EXECUTION SCHEDULES (execution schema)
-- Cron-based scheduling for pipelines and orchestrators
-- ============================================================================

CREATE TABLE execution.schedules (
    schedule_id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type_code      TEXT    NOT NULL,  -- PIPELINE or ORCHESTRATOR
    entity_id             UUID    NOT NULL,
    cron_expression_text  TEXT    NOT NULL,
    timezone_name_text    TEXT    NOT NULL DEFAULT 'UTC',
    env_id                UUID    REFERENCES execution.environments(env_id) ON DELETE SET NULL,
    is_schedule_active    BOOLEAN NOT NULL DEFAULT TRUE,
    next_run_dtm          TIMESTAMPTZ,
    last_run_dtm          TIMESTAMPTZ,
    created_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id    UUID    REFERENCES etl.users(user_id) ON DELETE SET NULL
);

COMMENT ON TABLE  execution.schedules                        IS 'Cron-based trigger schedules for pipelines and orchestrators. Referenced by trigger_type_code = SCHEDULE in pipeline_runs and orchestrator_runs.';
COMMENT ON COLUMN execution.schedules.schedule_id            IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN execution.schedules.entity_type_code       IS 'Entity being scheduled: PIPELINE or ORCHESTRATOR.';
COMMENT ON COLUMN execution.schedules.entity_id              IS 'UUID of the scheduled entity (pipeline_id or orch_id).';
COMMENT ON COLUMN execution.schedules.cron_expression_text   IS 'Standard 5-field cron expression (e.g., 0 2 * * * = 2 AM daily). Validated by the scheduler engine.';
COMMENT ON COLUMN execution.schedules.timezone_name_text     IS 'IANA timezone name for cron evaluation (e.g., America/New_York, UTC).';
COMMENT ON COLUMN execution.schedules.env_id                 IS 'Target deployment environment for scheduled runs.';
COMMENT ON COLUMN execution.schedules.is_schedule_active     IS 'FALSE to pause a schedule without deleting it.';
COMMENT ON COLUMN execution.schedules.next_run_dtm           IS 'Computed next fire time. Updated by the scheduler after each execution.';
COMMENT ON COLUMN execution.schedules.last_run_dtm           IS 'Timestamp of the most recent triggered execution.';
COMMENT ON COLUMN execution.schedules.created_dtm            IS 'Timestamp when this schedule was defined.';
COMMENT ON COLUMN execution.schedules.updated_dtm            IS 'Timestamp of the last schedule configuration change.';
COMMENT ON COLUMN execution.schedules.created_by_user_id     IS 'FK to the user who created this schedule.';


-- ============================================================================
-- LAYER 21: DATA LINEAGE (catalog schema)
-- Column-level lineage graph linking source columns to target columns through pipelines
-- ============================================================================

CREATE TABLE catalog.data_lineage (
    lineage_id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id               UUID NOT NULL REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE,
    version_id                UUID NOT NULL REFERENCES catalog.pipeline_versions(version_id) ON DELETE CASCADE,
    src_dataset_id            UUID REFERENCES catalog.datasets(dataset_id) ON DELETE SET NULL,
    src_column_name_text      TEXT,
    tgt_dataset_id            UUID REFERENCES catalog.datasets(dataset_id) ON DELETE SET NULL,
    tgt_column_name_text      TEXT,
    transformation_desc_text  TEXT,
    created_dtm               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_catalog_lineage_src ON catalog.data_lineage(src_dataset_id);
CREATE INDEX idx_catalog_lineage_tgt ON catalog.data_lineage(tgt_dataset_id);
CREATE INDEX idx_catalog_lineage_pipeline ON catalog.data_lineage(pipeline_id);

COMMENT ON TABLE  catalog.data_lineage                          IS 'Column-level data lineage graph. Each row declares one column flowing from a source dataset to a target dataset via a pipeline version. Enables impact analysis, GDPR compliance, and data discovery.';
COMMENT ON COLUMN catalog.data_lineage.lineage_id               IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.data_lineage.pipeline_id              IS 'FK to the pipeline that creates this lineage edge.';
COMMENT ON COLUMN catalog.data_lineage.version_id               IS 'FK to the exact pipeline version that defines this lineage edge.';
COMMENT ON COLUMN catalog.data_lineage.src_dataset_id           IS 'FK to the source dataset the data flows from. NULL for computed-only columns.';
COMMENT ON COLUMN catalog.data_lineage.src_column_name_text     IS 'Source column name in the source dataset. NULL for constants or expressions.';
COMMENT ON COLUMN catalog.data_lineage.tgt_dataset_id           IS 'FK to the target dataset the data flows into.';
COMMENT ON COLUMN catalog.data_lineage.tgt_column_name_text     IS 'Target column name in the target dataset.';
COMMENT ON COLUMN catalog.data_lineage.transformation_desc_text IS 'Human-readable description of any transformation applied (e.g., CAST, UPPER, CONCAT).';
COMMENT ON COLUMN catalog.data_lineage.created_dtm              IS 'Timestamp when this lineage record was generated (typically on version commit).';


-- ============================================================================
-- LAYER 22: PIPELINE-DATASET DEPENDENCY MAP (catalog schema)
-- Explicit READ/WRITE relationships for impact analysis without IR parsing
-- ============================================================================

CREATE TABLE catalog.pipeline_dataset_map (
    map_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id       UUID NOT NULL REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE,
    version_id        UUID NOT NULL REFERENCES catalog.pipeline_versions(version_id) ON DELETE CASCADE,
    dataset_id        UUID NOT NULL REFERENCES catalog.datasets(dataset_id) ON DELETE CASCADE,
    access_mode_code  TEXT NOT NULL,  -- READ, WRITE, READ_WRITE
    node_id_text      TEXT,
    UNIQUE (pipeline_id, version_id, dataset_id, access_mode_code)
);

COMMENT ON TABLE  catalog.pipeline_dataset_map                  IS 'Explicit dataset dependency map for a pipeline version. Populated on commit to enable O(1) impact analysis queries without parsing the IR JSON.';
COMMENT ON COLUMN catalog.pipeline_dataset_map.map_id           IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.pipeline_dataset_map.pipeline_id      IS 'FK to the pipeline.';
COMMENT ON COLUMN catalog.pipeline_dataset_map.version_id       IS 'FK to the pipeline version this dependency applies to.';
COMMENT ON COLUMN catalog.pipeline_dataset_map.dataset_id       IS 'FK to the dataset being read from or written to.';
COMMENT ON COLUMN catalog.pipeline_dataset_map.access_mode_code IS 'Direction of data flow: READ (source node), WRITE (sink node), READ_WRITE (used as both).';
COMMENT ON COLUMN catalog.pipeline_dataset_map.node_id_text     IS 'IR node identifier for traceability back to the pipeline canvas.';


-- ============================================================================
-- LAYER 23: CONNECTION TEST RESULTS (catalog schema)
-- Persisted history of connector validation / test runs
-- ============================================================================

CREATE TABLE catalog.connection_test_results (
    test_result_id       UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_id         UUID    NOT NULL REFERENCES catalog.connectors(connector_id) ON DELETE CASCADE,
    test_passed_flag     BOOLEAN NOT NULL,
    error_message_text   TEXT,
    response_time_ms     INTEGER,
    tested_by_user_id    UUID    REFERENCES etl.users(user_id) ON DELETE SET NULL,
    tested_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  catalog.connection_test_results                   IS 'Chronological history of connection test outcomes. Enables DevOps teams to see when a connector last failed and diagnose outages.';
COMMENT ON COLUMN catalog.connection_test_results.test_result_id    IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.connection_test_results.connector_id      IS 'FK to the connector under test.';
COMMENT ON COLUMN catalog.connection_test_results.test_passed_flag  IS 'TRUE if the connection attempt succeeded.';
COMMENT ON COLUMN catalog.connection_test_results.error_message_text IS 'Error detail from the driver or connection layer when test_passed_flag is FALSE.';
COMMENT ON COLUMN catalog.connection_test_results.response_time_ms  IS 'Round-trip latency in milliseconds for the successful connection attempt.';
COMMENT ON COLUMN catalog.connection_test_results.tested_by_user_id IS 'FK to the user who triggered the connection test.';
COMMENT ON COLUMN catalog.connection_test_results.tested_dtm        IS 'Timestamp when the test was executed.';


-- ============================================================================
-- LAYER 24: PIPELINE VALIDATION RESULTS (catalog schema)
-- Persisted history of pre-commit structural validation runs
-- ============================================================================

CREATE TABLE catalog.pipeline_validation_results (
    validation_id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id            UUID    NOT NULL REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE,
    validation_passed_flag BOOLEAN NOT NULL,
    error_count_num        INTEGER NOT NULL DEFAULT 0,
    validation_errors_json JSONB,
    validated_by_user_id   UUID    REFERENCES etl.users(user_id) ON DELETE SET NULL,
    validated_dtm          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  catalog.pipeline_validation_results                    IS 'History of pipeline validation gate outcomes. Enables auditors to verify that no invalid pipeline was ever committed.';
COMMENT ON COLUMN catalog.pipeline_validation_results.validation_id      IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.pipeline_validation_results.pipeline_id        IS 'FK to the pipeline that was validated.';
COMMENT ON COLUMN catalog.pipeline_validation_results.validation_passed_flag IS 'TRUE if the pipeline passed all structural validation rules.';
COMMENT ON COLUMN catalog.pipeline_validation_results.error_count_num    IS 'Number of distinct validation errors found.';
COMMENT ON COLUMN catalog.pipeline_validation_results.validation_errors_json IS 'Full [{field, error}] array from fn_validate_pipeline_ir and fn_validate_column_mapping.';
COMMENT ON COLUMN catalog.pipeline_validation_results.validated_by_user_id IS 'FK to the user who triggered the validation run.';
COMMENT ON COLUMN catalog.pipeline_validation_results.validated_dtm      IS 'Timestamp of the validation execution.';


-- ============================================================================
-- LAYER 25: TAGS & ASSET TAGGING (catalog schema)
-- Freeform tagging for discoverability and classification
-- ============================================================================

CREATE TABLE catalog.tags (
    tag_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_display_name TEXT NOT NULL UNIQUE,
    tag_color_hex    TEXT,
    created_dtm      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  catalog.tags                    IS 'Global tag vocabulary for categorizing and discovering platform assets.';
COMMENT ON COLUMN catalog.tags.tag_id             IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.tags.tag_display_name   IS 'Unique tag label shown in the UI (e.g., PII, finance, experimental).';
COMMENT ON COLUMN catalog.tags.tag_color_hex      IS 'Optional hex color code for UI badge rendering (e.g., #FF5733).';
COMMENT ON COLUMN catalog.tags.created_dtm        IS 'Timestamp when the tag was created.';


CREATE TABLE catalog.asset_tags (
    asset_tag_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id             UUID NOT NULL REFERENCES catalog.tags(tag_id) ON DELETE CASCADE,
    asset_type_code    TEXT NOT NULL,  -- PIPELINE, ORCHESTRATOR, DATASET, CONNECTOR
    asset_id           UUID NOT NULL,
    tagged_by_user_id  UUID REFERENCES etl.users(user_id) ON DELETE SET NULL,
    tagged_dtm         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tag_id, asset_type_code, asset_id)
);

COMMENT ON TABLE  catalog.asset_tags                      IS 'M2M mapping applying tags to any platform asset. Enables cross-entity search and classification.';
COMMENT ON COLUMN catalog.asset_tags.asset_tag_id         IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.asset_tags.tag_id               IS 'FK to the tag being applied.';
COMMENT ON COLUMN catalog.asset_tags.asset_type_code      IS 'Type of the tagged asset: PIPELINE, ORCHESTRATOR, DATASET, CONNECTOR.';
COMMENT ON COLUMN catalog.asset_tags.asset_id             IS 'UUID of the tagged entity.';
COMMENT ON COLUMN catalog.asset_tags.tagged_by_user_id    IS 'FK to the user who applied this tag.';
COMMENT ON COLUMN catalog.asset_tags.tagged_dtm           IS 'Timestamp when the tag was applied to the asset.';


-- ============================================================================
-- LAYER 26: NOTIFICATION RULES (gov schema)
-- Alert definitions for run failures, DQ breaches, and SLA violations
-- ============================================================================

CREATE TABLE gov.notification_rules (
    notification_rule_id  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type_code      TEXT    NOT NULL,  -- PIPELINE, ORCHESTRATOR, DATASET
    entity_id             UUID    NOT NULL,
    event_type_code       TEXT    NOT NULL,  -- RUN_FAILURE, RUN_SUCCESS, DQ_BREACH, SLA_VIOLATION, RUN_START
    channel_type_code     TEXT    NOT NULL,  -- EMAIL, SLACK, WEBHOOK, PAGERDUTY
    channel_target_text   TEXT    NOT NULL,
    is_rule_active_flag   BOOLEAN NOT NULL DEFAULT TRUE,
    created_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id    UUID    REFERENCES etl.users(user_id) ON DELETE SET NULL
);

COMMENT ON TABLE  gov.notification_rules                          IS 'Alert routing rules for platform events. Each row specifies what event on which entity should fire an alert to which channel.';
COMMENT ON COLUMN gov.notification_rules.notification_rule_id     IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN gov.notification_rules.entity_type_code         IS 'The type of entity being watched: PIPELINE, ORCHESTRATOR, or DATASET.';
COMMENT ON COLUMN gov.notification_rules.entity_id                IS 'UUID of the watched entity (pipeline_id, orch_id, or dataset_id).';
COMMENT ON COLUMN gov.notification_rules.event_type_code          IS 'Triggering event: RUN_FAILURE, RUN_SUCCESS, DQ_BREACH, SLA_VIOLATION, RUN_START.';
COMMENT ON COLUMN gov.notification_rules.channel_type_code        IS 'Delivery channel: EMAIL, SLACK, WEBHOOK, PAGERDUTY.';
COMMENT ON COLUMN gov.notification_rules.channel_target_text      IS 'Channel destination: email address, Slack webhook URL, or generic webhook URL.';
COMMENT ON COLUMN gov.notification_rules.is_rule_active_flag      IS 'FALSE to mute notifications without deleting the rule.';
COMMENT ON COLUMN gov.notification_rules.created_dtm              IS 'Timestamp when this notification rule was created.';
COMMENT ON COLUMN gov.notification_rules.created_by_user_id       IS 'FK to the user who created this alert rule.';


-- ============================================================================
-- LAYER 27: CDC CONFIGURATIONS (meta schema)
-- Change Data Capture mode per dataset (FULL_REFRESH vs INCREMENTAL vs LOG_BASED)
-- ============================================================================

CREATE TABLE meta.cdc_configurations (
    cdc_id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id            UUID    NOT NULL UNIQUE REFERENCES catalog.datasets(dataset_id) ON DELETE CASCADE,
    cdc_mode_code         TEXT    NOT NULL,  -- FULL_REFRESH, INCREMENTAL_WATERMARK, LOG_BASED, CDC_MERGE
    watermark_column_name TEXT,              -- applicable to INCREMENTAL_WATERMARK mode only
    cdc_config_json       JSONB,             -- mode-specific extended config
    created_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  meta.cdc_configurations                       IS 'Change Data Capture configuration per dataset. Drives how the pipeline engine fetches incremental changes vs full reloads.';
COMMENT ON COLUMN meta.cdc_configurations.cdc_id               IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN meta.cdc_configurations.dataset_id           IS 'FK to the dataset this CDC config governs. One config per dataset.';
COMMENT ON COLUMN meta.cdc_configurations.cdc_mode_code        IS 'Extraction strategy: FULL_REFRESH, INCREMENTAL_WATERMARK (timestamp/sequence), LOG_BASED (Debezium/DMS), CDC_MERGE (upsert).';
COMMENT ON COLUMN meta.cdc_configurations.watermark_column_name IS 'Column used as the high-watermark for INCREMENTAL_WATERMARK mode (e.g., UPDATED_AT, SEQ_NUM).';
COMMENT ON COLUMN meta.cdc_configurations.cdc_config_json      IS 'Mode-specific extended settings JSONB (e.g., initial_load_date, batch_size, log_position).';
COMMENT ON COLUMN meta.cdc_configurations.created_dtm          IS 'Timestamp when this CDC configuration was defined.';
COMMENT ON COLUMN meta.cdc_configurations.updated_dtm          IS 'Timestamp of the last configuration change.';


-- ============================================================================
-- LAYER 28: PLATFORM SETTINGS (meta schema)
-- Instance-wide admin-configurable key-value settings
-- ============================================================================

CREATE TABLE meta.platform_settings (
    setting_id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key_name      TEXT    NOT NULL UNIQUE,
    setting_value_text    TEXT,
    setting_desc_text     TEXT,
    is_sensitive_flag     BOOLEAN NOT NULL DEFAULT FALSE,
    updated_dtm           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id    UUID    REFERENCES etl.users(user_id) ON DELETE SET NULL
);

COMMENT ON TABLE  meta.platform_settings                          IS 'Instance-wide admin-controlled settings (max concurrent runs, session timeout, SMTP config, default timezone, etc.).';
COMMENT ON COLUMN meta.platform_settings.setting_id              IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN meta.platform_settings.setting_key_name        IS 'Unique machine-readable key (e.g., MAX_CONCURRENT_RUNS, DEFAULT_TIMEZONE, SMTP_HOST).';
COMMENT ON COLUMN meta.platform_settings.setting_value_text      IS 'Serialized setting value. Sensitive settings stored encrypted elsewhere in gov.secrets.';
COMMENT ON COLUMN meta.platform_settings.setting_desc_text       IS 'Description of what this setting controls and its expected value format.';
COMMENT ON COLUMN meta.platform_settings.is_sensitive_flag       IS 'TRUE means the value must be masked in API responses and logs.';
COMMENT ON COLUMN meta.platform_settings.updated_dtm             IS 'Timestamp of the last value change.';
COMMENT ON COLUMN meta.platform_settings.updated_by_user_id      IS 'FK to the administrator who last changed this setting.';


-- ============================================================================
-- LAYER 29: RUN ARTIFACTS (execution schema)
-- Files and outputs produced by a pipeline run (generated code, output paths, reports)
-- ============================================================================

CREATE TABLE execution.run_artifacts (
    artifact_id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id     UUID    NOT NULL REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE,
    artifact_type_code  TEXT    NOT NULL,  -- GENERATED_CODE, OUTPUT_FILE, PROFILING_REPORT, ERROR_REPORT, LINEAGE_SNAPSHOT
    artifact_name_text  TEXT    NOT NULL,
    storage_uri_text    TEXT    NOT NULL,
    artifact_size_bytes BIGINT,
    created_dtm         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  execution.run_artifacts                         IS 'Files and outputs produced by a pipeline run. Used for debugging, compliance, and reproducibility.';
COMMENT ON COLUMN execution.run_artifacts.artifact_id            IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN execution.run_artifacts.pipeline_run_id        IS 'FK to the pipeline run that produced this artifact.';
COMMENT ON COLUMN execution.run_artifacts.artifact_type_code     IS 'Category: GENERATED_CODE (PySpark/Scala file), OUTPUT_FILE (result data), PROFILING_REPORT, ERROR_REPORT, LINEAGE_SNAPSHOT.';
COMMENT ON COLUMN execution.run_artifacts.artifact_name_text     IS 'Human-readable file name for display in the run detail UI.';
COMMENT ON COLUMN execution.run_artifacts.storage_uri_text       IS 'Object storage path where the artifact is persisted (e.g., s3://etl-artifacts/runs/...).';
COMMENT ON COLUMN execution.run_artifacts.artifact_size_bytes    IS 'File size in bytes, useful for storage monitoring.';
COMMENT ON COLUMN execution.run_artifacts.created_dtm            IS 'Timestamp when the artifact was stored.';


-- ============================================================================
-- LAYER 30: ORCHESTRATOR-PIPELINE CATALOG MAP (catalog schema)
-- Explicit M2M between orchestrators and the pipelines they reference at design time.
-- Separate from execution.orchestrator_pipeline_run_map which is per-run.
-- Answers: "Which orchestrators run this pipeline?" and
--          "Which pipelines does this orchestrator coordinate?"
-- ============================================================================

CREATE TABLE catalog.orchestrator_pipeline_map (
    orch_pipeline_map_id  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    orch_id               UUID    NOT NULL REFERENCES catalog.orchestrators(orch_id) ON DELETE CASCADE,
    pipeline_id           UUID    NOT NULL REFERENCES catalog.pipelines(pipeline_id) ON DELETE CASCADE,
    dag_node_ref_text     TEXT    NOT NULL,
    dependency_order_num  INTEGER NOT NULL DEFAULT 0,
    UNIQUE (orch_id, pipeline_id, dag_node_ref_text)
);

COMMENT ON TABLE  catalog.orchestrator_pipeline_map                      IS 'Design-time M2M mapping between orchestrators and the pipelines they coordinate. Rebuilt on every orchestrator DAG save. Enables reverse-lookup: which orchestrators include a given pipeline. Distinct from execution.orchestrator_pipeline_run_map which records actual run instances.';
COMMENT ON COLUMN catalog.orchestrator_pipeline_map.orch_pipeline_map_id IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.orchestrator_pipeline_map.orch_id              IS 'FK to the orchestrator that references this pipeline.';
COMMENT ON COLUMN catalog.orchestrator_pipeline_map.pipeline_id          IS 'FK to the pipeline referenced by the orchestrator DAG.';
COMMENT ON COLUMN catalog.orchestrator_pipeline_map.dag_node_ref_text    IS 'The node identifier within the DAG definition that references this pipeline. Matches dag_definition_json node id.';
COMMENT ON COLUMN catalog.orchestrator_pipeline_map.dependency_order_num IS 'Topological order of this pipeline within the orchestrator DAG (0 = no ordering constraint).';


-- ============================================================================
-- LAYER 31: RUN LINEAGE (execution schema)
-- Per-run actual column-level lineage captured at execution time.
-- Distinct from catalog.data_lineage which is design-time (per pipeline version).
-- Answers: "Which datasets were actually read/written in this specific run?"
--          "Which run does this lineage record belong to?"
-- ============================================================================

CREATE TABLE execution.run_lineage (
    run_lineage_id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id          UUID    NOT NULL REFERENCES execution.pipeline_runs(pipeline_run_id) ON DELETE CASCADE,
    src_dataset_id           UUID    REFERENCES catalog.datasets(dataset_id) ON DELETE SET NULL,
    src_column_name_text     TEXT,
    tgt_dataset_id           UUID    REFERENCES catalog.datasets(dataset_id) ON DELETE SET NULL,
    tgt_column_name_text     TEXT,
    rows_read_num            BIGINT,
    rows_written_num         BIGINT,
    transformation_desc_text TEXT,
    created_dtm              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exec_run_lineage_run    ON execution.run_lineage(pipeline_run_id);
CREATE INDEX idx_exec_run_lineage_src   ON execution.run_lineage(src_dataset_id);
CREATE INDEX idx_exec_run_lineage_tgt   ON execution.run_lineage(tgt_dataset_id);

COMMENT ON TABLE  execution.run_lineage                          IS 'Runtime column-level lineage captured during actual pipeline execution. Complements catalog.data_lineage (design-time). Each row records one column-to-column flow for a specific run, including actual row counts observed at runtime.';
COMMENT ON COLUMN execution.run_lineage.run_lineage_id           IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN execution.run_lineage.pipeline_run_id          IS 'FK to the pipeline run during which this lineage was observed.';
COMMENT ON COLUMN execution.run_lineage.src_dataset_id           IS 'FK to the source dataset data was read from. NULL for computed-only columns.';
COMMENT ON COLUMN execution.run_lineage.src_column_name_text     IS 'Source column name as observed at runtime.';
COMMENT ON COLUMN execution.run_lineage.tgt_dataset_id           IS 'FK to the target dataset data was written to.';
COMMENT ON COLUMN execution.run_lineage.tgt_column_name_text     IS 'Target column name as observed at runtime.';
COMMENT ON COLUMN execution.run_lineage.rows_read_num            IS 'Actual number of rows read from the source in this run. NULL if not tracked at column level.';
COMMENT ON COLUMN execution.run_lineage.rows_written_num         IS 'Actual number of rows written to the target in this run.';
COMMENT ON COLUMN execution.run_lineage.transformation_desc_text IS 'Transformation applied (e.g., CAST, UPPER, CONCAT). Mirrors the design-time description with any runtime-resolved overrides.';
COMMENT ON COLUMN execution.run_lineage.created_dtm              IS 'Timestamp when this runtime lineage record was captured.';


-- ============================================================================
-- LAYER 32: CONNECTOR HEALTH MONITORING (catalog schema)
-- Ongoing health check status per connector for proactive alerting
-- ============================================================================

CREATE TABLE catalog.connector_health (
    health_id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_id           UUID    NOT NULL REFERENCES catalog.connectors(connector_id) ON DELETE CASCADE,
    health_status_code     TEXT    NOT NULL DEFAULT 'UNKNOWN',  -- HEALTHY, DEGRADED, UNREACHABLE, UNKNOWN
    check_latency_ms       INTEGER,
    check_error_text       TEXT,
    consecutive_fail_num   INTEGER NOT NULL DEFAULT 0,
    last_check_dtm         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    next_check_dtm         TIMESTAMPTZ,
    UNIQUE (connector_id)
);

COMMENT ON TABLE  catalog.connector_health                           IS 'Current health status for each connector. Updated by periodic health checks (default every 15 min for scheduled connectors). A connector is DEGRADED after 3 consecutive failures.';
COMMENT ON COLUMN catalog.connector_health.health_id                 IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.connector_health.connector_id              IS 'FK to the connector being monitored. UNIQUE — one health record per connector.';
COMMENT ON COLUMN catalog.connector_health.health_status_code        IS 'Current status: HEALTHY (test passes), DEGRADED (3+ consecutive failures), UNREACHABLE (network-level failure), UNKNOWN (never tested).';
COMMENT ON COLUMN catalog.connector_health.check_latency_ms          IS 'Round-trip latency in milliseconds for the most recent successful check. NULL if last check failed.';
COMMENT ON COLUMN catalog.connector_health.check_error_text          IS 'Error detail from the most recent failed check. NULL when HEALTHY.';
COMMENT ON COLUMN catalog.connector_health.consecutive_fail_num      IS 'Number of consecutive failed health checks. Reset to 0 on success. Threshold for DEGRADED is 3.';
COMMENT ON COLUMN catalog.connector_health.last_check_dtm            IS 'Timestamp of the most recent health check execution.';
COMMENT ON COLUMN catalog.connector_health.next_check_dtm            IS 'Computed next check time. Driven by the health check scheduler.';


-- ============================================================================
-- LAYER 33: FILE FORMAT OPTIONS (catalog schema)
-- Configurable file format parsing options for CSV, JSON, XML, Excel, etc.
-- Keeps format config queryable (not buried in a JSON blob per Law 10 spirit)
-- ============================================================================

CREATE TABLE catalog.file_format_options (
    format_option_id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_id             UUID    NOT NULL REFERENCES catalog.connectors(connector_id) ON DELETE CASCADE,
    -- File format: CSV, PARQUET, ORC, JSON, XML, EXCEL, AVRO, FIXED_WIDTH, DELTA, ICEBERG, HUDI
    file_format_code         TEXT    NOT NULL,
    -- CSV-specific options
    field_separator_char     TEXT    DEFAULT ',',
    decimal_separator_char   TEXT    DEFAULT '.',
    date_format_text         TEXT    DEFAULT 'yyyy-MM-dd',
    timestamp_format_text    TEXT    DEFAULT 'yyyy-MM-dd HH:mm:ss',
    encoding_standard_code   TEXT    DEFAULT 'UTF-8',
    has_header_flag          BOOLEAN DEFAULT TRUE,
    quote_char_text          TEXT    DEFAULT '"',
    escape_char_text         TEXT    DEFAULT '\\',
    null_value_text          TEXT,
    line_separator_text      TEXT,
    multiline_flag           BOOLEAN DEFAULT FALSE,
    -- Excel-specific options
    sheet_name_text          TEXT,
    sheet_index_num          INTEGER DEFAULT 0,
    -- XML-specific options
    root_tag_text            TEXT,
    row_tag_text             TEXT,
    -- JSON-specific options
    corrupt_record_mode      TEXT    DEFAULT 'PERMISSIVE',  -- PERMISSIVE, DROPMALFORMED, FAILFAST
    -- Fixed-width options
    column_widths_text       TEXT,
    -- Common options
    skip_rows_num            INTEGER DEFAULT 0,
    compression_code         TEXT,  -- NONE, GZIP, SNAPPY, LZ4, ZSTD, BZIP2, DEFLATE
    created_dtm              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_dtm              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (connector_id)
);

COMMENT ON TABLE  catalog.file_format_options                          IS 'File format parsing and writing options for file-based connectors. One row per file connector. Supports CSV (with configurable separators, encoding, quoting), Parquet, ORC, JSON, XML, Excel, Avro, Fixed-Width, Delta Lake, Iceberg, and Hudi.';
COMMENT ON COLUMN catalog.file_format_options.format_option_id         IS 'Surrogate primary key; UUID v4.';
COMMENT ON COLUMN catalog.file_format_options.connector_id             IS 'FK to the parent connector. UNIQUE — one format config per connector.';
COMMENT ON COLUMN catalog.file_format_options.file_format_code         IS 'Format identifier: CSV, PARQUET, ORC, JSON, XML, EXCEL, AVRO, FIXED_WIDTH, DELTA, ICEBERG, HUDI.';
COMMENT ON COLUMN catalog.file_format_options.field_separator_char     IS 'CSV field delimiter character. Common values: comma (,), semicolon (;), tab (\t), pipe (|). Default comma.';
COMMENT ON COLUMN catalog.file_format_options.decimal_separator_char   IS 'Decimal point character for numeric fields. Period (.) for US/UK, comma (,) for EU locales. Default period.';
COMMENT ON COLUMN catalog.file_format_options.date_format_text         IS 'Java SimpleDateFormat pattern for date parsing (e.g., yyyy-MM-dd, dd/MM/yyyy, MM-dd-yyyy). Default yyyy-MM-dd.';
COMMENT ON COLUMN catalog.file_format_options.timestamp_format_text    IS 'Java SimpleDateFormat pattern for timestamp parsing. Default yyyy-MM-dd HH:mm:ss.';
COMMENT ON COLUMN catalog.file_format_options.encoding_standard_code   IS 'Character encoding: UTF-8, UTF-16, ISO-8859-1, WINDOWS-1252, US-ASCII, etc. Default UTF-8.';
COMMENT ON COLUMN catalog.file_format_options.has_header_flag          IS 'TRUE if the first row of CSV/Excel contains column names. Default TRUE.';
COMMENT ON COLUMN catalog.file_format_options.quote_char_text          IS 'Character used to quote string fields in CSV. Default double-quote ("). Set NULL to disable quoting.';
COMMENT ON COLUMN catalog.file_format_options.escape_char_text         IS 'Escape character for special characters within quoted fields. Default backslash (\\).';
COMMENT ON COLUMN catalog.file_format_options.null_value_text          IS 'String representation of NULL values (e.g., NULL, N/A, empty string). NULL means empty fields are treated as empty strings.';
COMMENT ON COLUMN catalog.file_format_options.line_separator_text      IS 'Line terminator override: \n (Unix), \r\n (Windows), \r (old Mac). NULL uses system default.';
COMMENT ON COLUMN catalog.file_format_options.multiline_flag           IS 'TRUE to enable multi-line record parsing (JSON, CSV with embedded newlines). Default FALSE.';
COMMENT ON COLUMN catalog.file_format_options.sheet_name_text          IS 'Excel worksheet name to read. NULL reads the first sheet.';
COMMENT ON COLUMN catalog.file_format_options.sheet_index_num          IS 'Excel worksheet index (0-based). Used when sheet_name_text is NULL. Default 0.';
COMMENT ON COLUMN catalog.file_format_options.root_tag_text            IS 'XML root element tag name. Required for XML format parsing.';
COMMENT ON COLUMN catalog.file_format_options.row_tag_text             IS 'XML row element tag name. Each occurrence becomes one row in the resulting DataFrame.';
COMMENT ON COLUMN catalog.file_format_options.corrupt_record_mode      IS 'JSON/CSV malformed record handling: PERMISSIVE (store in _corrupt_record column), DROPMALFORMED (skip), FAILFAST (throw). Default PERMISSIVE.';
COMMENT ON COLUMN catalog.file_format_options.column_widths_text       IS 'Fixed-width format: comma-separated list of column widths in characters (e.g., 10,20,15,8).';
COMMENT ON COLUMN catalog.file_format_options.skip_rows_num            IS 'Number of rows to skip at the beginning of the file (after header if has_header_flag is TRUE). Default 0.';
COMMENT ON COLUMN catalog.file_format_options.compression_code         IS 'File compression codec: NONE, GZIP, SNAPPY, LZ4, ZSTD, BZIP2, DEFLATE. NULL auto-detects from file extension.';
COMMENT ON COLUMN catalog.file_format_options.created_dtm              IS 'Timestamp when this format configuration was created.';
COMMENT ON COLUMN catalog.file_format_options.updated_dtm              IS 'Timestamp of the last format configuration change.';


COMMIT;
