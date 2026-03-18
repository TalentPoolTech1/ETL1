-- ############################################################################
-- # FILE: 04_seed_technologies.sql
-- # PURPOSE: Populates the technology types registry with initial data.
-- ############################################################################

BEGIN;

INSERT INTO meta.technology_types (tech_code, display_name, category, icon_name, tech_desc_text)
VALUES
    -- RDBMS
    ('POSTGRESQL',    'PostgreSQL',    'RDBMS', 'Database', 'Open-source relational database management system.'),
    ('MYSQL',         'MySQL',         'RDBMS', 'Database', 'Open-source relational database management system often used for web apps.'),
    ('SQLSERVER',     'SQL Server',    'RDBMS', 'Database', 'Microsoft SQL Server enterprise relational database.'),
    ('ORACLE',        'Oracle',        'RDBMS', 'Database', 'Enterprise-grade Oracle Database.'),
    ('MARIADB',       'MariaDB',       'RDBMS', 'Database', 'Open-source RDBMS, fork of MySQL.'),
    ('DB2',           'IBM Db2',       'RDBMS', 'Database', 'IBM enterprise relational database.'),
    ('SAP_HANA',      'SAP HANA',      'RDBMS', 'Database', 'In-memory, column-oriented database from SAP.'),
    
    -- Cloud Storage
    ('AWS_S3',        'Amazon S3',     'CLOUD_STORAGE', 'Cloud', 'Scalable object storage from AWS.'),
    ('GCP_GCS',       'Google GCS',    'CLOUD_STORAGE', 'Cloud', 'Object storage for Google Cloud Platform.'),
    ('AZURE_BLOB',    'Azure Blob',    'CLOUD_STORAGE', 'Cloud', 'Object storage for Microsoft Azure.'),
    ('OCI_OBJECT',    'OCI Object',    'CLOUD_STORAGE', 'Cloud', 'Object storage for Oracle Cloud Infrastructure.'),
    
    -- Analytics / Data Warehousing
    ('SNOWFLAKE',     'Snowflake',     'ANALYTICS', 'Zap', 'Cloud data platform for high-performance analytics.'),
    ('DATABRICKS',    'Databricks',    'ANALYTICS', 'Zap', 'Unified data analytics platform built on Spark.'),
    ('AWS_REDSHIFT',  'Redshift',      'ANALYTICS', 'Zap', 'Managed data warehouse service in AWS.'),
    ('GCP_BIGQUERY',  'BigQuery',      'ANALYTICS', 'Zap', 'Serverless, highly scalable enterprise data warehouse.'),
    ('AZURE_SYNAPSE', 'Synapse',       'ANALYTICS', 'Zap', 'Enterprise analytics service on Microsoft Azure.'),
    
    -- File Formats
    ('CSV',           'CSV File',      'FILES', 'FileText', 'Comma-separated values file format.'),
    ('PARQUET',       'Parquet File',  'FILES', 'FileText', 'Columnar storage format for Hadoop and Spark.'),
    ('JSON',          'JSON File',     'FILES', 'FileText', 'JavaScript Object Notation light-weight data interchange format.'),
    ('EXCEL',         'Excel File',    'FILES', 'FileText', 'Binary spreadsheet file format (.xlsx, .xls).'),
    ('DELTA',         'Delta Lake',    'FILES', 'Layers',   'Open-source storage layer that brings ACID transactions to Spark.')
ON CONFLICT (tech_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    category     = EXCLUDED.category,
    icon_name    = EXCLUDED.icon_name,
    tech_desc_text = EXCLUDED.tech_desc_text,
    updated_dtm  = CURRENT_TIMESTAMP;

COMMIT;
