import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import { PipelineNode, JdbcSourceConfig } from '../../../../core/types/pipeline.types';
import { CodeBuilder, toVarName, pyStringLiteral } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS } from '../../../../core/constants/codegen.constants';

// ─── PySpark JDBC Source Generator ────────────────────────────────────────────

export class PySparkJdbcSourceGenerator implements INodeGenerator {
  readonly nodeType = 'source' as const;
  readonly subType = 'jdbc';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'source' && node.sourceType === 'jdbc';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as JdbcSourceConfig;
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const warnings: any[] = [];

    // Resolve credentials
    const { userExpr, passExpr } = this.resolveCredentials(cfg, context);

    if (context.options.includeComments) {
      b.line(`# Source: ${node.name} (JDBC)`);
      if (node.description) b.line(`# ${node.description}`);
    }

    b.line(`${varName} = (`);

    // Build options dict
    const opts: Record<string, string> = {
      url: cfg.url,
      driver: cfg.driver ?? this.inferDriver(cfg.url),
    };

    if (cfg.table && !cfg.query) {
      opts['dbtable'] = cfg.table;
    }

    if (cfg.query) {
      // Wrap in subquery for Spark JDBC
      opts['dbtable'] = `(${cfg.query.replace(/\s+/g, ' ').trim()}) AS _q_${varName}`;
      if (!cfg.numPartitions) {
        warnings.push({
          nodeId: node.id,
          code: 'JDBC_QUERY_SINGLE_PARTITION',
          message: `JDBC query on node "${node.name}" runs in a single partition. Set numPartitions + partitionColumn for parallelism.`,
          severity: 'warn' as const,
        });
      }
    }

    if (cfg.numPartitions) {
      if (!cfg.partitionColumn || cfg.lowerBound === undefined || cfg.upperBound === undefined) {
        warnings.push({
          nodeId: node.id,
          code: 'JDBC_INCOMPLETE_PARTITION',
          message: `numPartitions set on "${node.name}" but partitionColumn/lowerBound/upperBound missing.`,
          severity: 'warn' as const,
        });
      }
    }

    // Parallelism options
    const parallelOpts = this.buildParallelOptions(cfg);
    Object.assign(opts, parallelOpts);

    if (cfg.fetchSize) opts['fetchsize'] = String(cfg.fetchSize);
    if (cfg.pushDownPredicate === false) opts['pushDownPredicate'] = 'false';

    // Custom options override
    if (cfg.customOptions) {
      Object.assign(opts, cfg.customOptions);
    }

    b.indent(b2 => {
      b2.line('spark.read');
      b2.indent(b3 => {
        b3.line('.format("jdbc")');
        Object.entries(opts).forEach(([k, v]) => {
          b3.line(`.option(${pyStringLiteral(k)}, ${pyStringLiteral(v)})`);
        });
        b3.line(`.option("user", ${userExpr})`);
        b3.line(`.option("password", ${passExpr})`);
        b3.line('.load()');
      });
    });

    b.line(')');

    if (context.options.includeLogging) {
      b.blank();
      b.line(`logger.info(f"Loaded JDBC source '${node.name}': {${varName}.count()} rows")`);
    }

    return {
      varName,
      code: b.build(),
      imports: [PYSPARK_IMPORTS.FUNCTIONS],
      warnings,
    };
  }

  private resolveCredentials(
    cfg: JdbcSourceConfig,
    context: GenerationContext
  ): { userExpr: string; passExpr: string } {
    const backend = context.options.secretsBackend ?? 'env';

    if (cfg.passwordSecret) {
      switch (backend) {
        case 'aws_secretsmanager':
          return {
            userExpr: `_get_secret(${pyStringLiteral(cfg.passwordSecret)})["username"]`,
            passExpr: `_get_secret(${pyStringLiteral(cfg.passwordSecret)})["password"]`,
          };
        case 'azure_keyvault':
          return {
            userExpr: `_get_secret(${pyStringLiteral(cfg.passwordSecret + '-user')})`,
            passExpr: `_get_secret(${pyStringLiteral(cfg.passwordSecret)})`,
          };
        default:
          return {
            userExpr: `os.environ[${pyStringLiteral(cfg.passwordSecret + '_USER')}]`,
            passExpr: `os.environ[${pyStringLiteral(cfg.passwordSecret)}]`,
          };
      }
    }

    return {
      userExpr: cfg.user ? pyStringLiteral(cfg.user) : `os.environ.get("DB_USER", "")`,
      passExpr: cfg.password ? pyStringLiteral(cfg.password) : `os.environ.get("DB_PASSWORD", "")`,
    };
  }

  private buildParallelOptions(cfg: JdbcSourceConfig): Record<string, string> {
    const opts: Record<string, string> = {};
    if (cfg.numPartitions) {
      opts['numPartitions'] = String(cfg.numPartitions);
      if (cfg.partitionColumn) opts['partitionColumn'] = cfg.partitionColumn;
      if (cfg.lowerBound !== undefined) opts['lowerBound'] = String(cfg.lowerBound);
      if (cfg.upperBound !== undefined) opts['upperBound'] = String(cfg.upperBound);
    }
    return opts;
  }

  private inferDriver(url: string): string {
    const lower = url.toLowerCase();
    if (lower.includes('postgresql')) return 'org.postgresql.Driver';
    if (lower.includes('mysql')) return 'com.mysql.cj.jdbc.Driver';
    if (lower.includes('sqlserver') || lower.includes('mssql')) return 'com.microsoft.sqlserver.jdbc.SQLServerDriver';
    if (lower.includes('oracle')) return 'oracle.jdbc.OracleDriver';
    if (lower.includes('redshift')) return 'com.amazon.redshift.jdbc42.Driver';
    if (lower.includes('snowflake')) return 'net.snowflake.client.jdbc.SnowflakeDriver';
    return 'UNKNOWN_DRIVER';
  }
}
