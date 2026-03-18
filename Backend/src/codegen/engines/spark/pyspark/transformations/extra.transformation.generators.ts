import { INodeGenerator, GeneratedNodeCode, GenerationContext } from '../../../../core/interfaces/engine.interfaces';
import { PipelineNode, SampleConfig, LookupConfig, CustomUdfConfig } from '../../../../core/types/pipeline.types';
import { CodeBuilder, toVarName, pyStringLiteral, toPySparkType } from '../../../../utils/codegen.utils';
import { PYSPARK_IMPORTS } from '../../../../core/constants/codegen.constants';

function getInputVar(node: PipelineNode, context: GenerationContext, index = 0): string {
  const inputId = node.inputs[index];
  return context.resolvedNodes.get(inputId)?.varName ?? `MISSING_INPUT_${index}`;
}

// ─── Sample ───────────────────────────────────────────────────────────────────

export class PySparkSampleGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'sample';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'sample';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as SampleConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const warnings: any[] = [];

    if (cfg.fraction <= 0 || cfg.fraction > 1) {
      warnings.push({ nodeId: node.id, code: 'SAMPLE_INVALID_FRACTION', message: `Sample fraction ${cfg.fraction} must be between 0 and 1.`, severity: 'error' as const });
    }

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Sample ${cfg.fraction * 100}%)`);

    const withReplacement = cfg.withReplacement ? 'True' : 'False';
    if (cfg.seed !== undefined) {
      b.line(`${varName} = ${inputVar}.sample(withReplacement=${withReplacement}, fraction=${cfg.fraction}, seed=${cfg.seed})`);
    } else {
      b.line(`${varName} = ${inputVar}.sample(withReplacement=${withReplacement}, fraction=${cfg.fraction})`);
    }

    if (cfg.fraction < 1) {
      warnings.push({ nodeId: node.id, code: 'SAMPLE_NON_DETERMINISTIC', message: `Sample without seed is non-deterministic. Set seed for reproducibility.`, severity: 'info' as const });
    }

    return { varName, code: b.build(), imports: [], warnings };
  }
}

// ─── Lookup (Broadcast Join pattern) ─────────────────────────────────────────

export class PySparkLookupGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'lookup';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'lookup';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as LookupConfig;
    const inputVar = getInputVar(node, context);
    const lookupVar = context.resolvedNodes.get(cfg.lookupDatasetNodeId)?.varName;
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const warnings: any[] = [];

    if (!lookupVar) {
      warnings.push({ nodeId: node.id, code: 'LOOKUP_MISSING_DATASET', message: `Lookup dataset node "${cfg.lookupDatasetNodeId}" not resolved. Ensure it is upstream.`, severity: 'error' as const });
      return { varName, code: `${varName} = None  # ERROR: lookup dataset not resolved`, imports: [], warnings };
    }

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Lookup / Broadcast Join)`);

    // Select only the columns needed from the lookup to minimize broadcast size
    const lookupKeyCols = Object.values(cfg.joinColumns);
    const allLookupCols = [...new Set([...lookupKeyCols, ...cfg.returnColumns])];
    const lookupColArgs = allLookupCols.map(c => pyStringLiteral(c)).join(', ');

    if (cfg.cacheEnabled) {
      b.line(`_lookup_slim_${varName} = F.broadcast(${lookupVar}.select(${lookupColArgs}).cache())`);
    } else {
      b.line(`_lookup_slim_${varName} = F.broadcast(${lookupVar}.select(${lookupColArgs}))`);
    }

    // Build join conditions
    const conditions = Object.entries(cfg.joinColumns)
      .map(([inputCol, lookupCol]) => `${inputVar}[${pyStringLiteral(inputCol)}] == _lookup_slim_${varName}[${pyStringLiteral(lookupCol)}]`)
      .join(' & ');

    b.line(`${varName} = (`);
    b.indent(b2 => {
      b2.line(`${inputVar}`);
      b2.indent(b3 => {
        b3.line(`.join(_lookup_slim_${varName}, on=${conditions}, how="left")`);
        // Drop the lookup key columns (they're duplicates)
        const dropCols = Object.values(cfg.joinColumns).map(c => pyStringLiteral(c)).join(', ');
        if (cfg.joinColumns && Object.keys(cfg.joinColumns).length > 0) {
          b3.line(`.drop(${dropCols})`);
        }
      });
    });
    b.line(')');

    // Fill defaults for unmatched rows
    if (cfg.defaultValues && Object.keys(cfg.defaultValues).length > 0) {
      const fillDict = Object.entries(cfg.defaultValues)
        .map(([k, v]) => `${pyStringLiteral(k)}: ${typeof v === 'string' ? pyStringLiteral(v) : v}`)
        .join(', ');
      b.line(`${varName} = ${varName}.fillna({${fillDict}})`);
    }

    return { varName, code: b.build(), imports: [PYSPARK_IMPORTS.FUNCTIONS], warnings };
  }
}

// ─── Custom UDF ───────────────────────────────────────────────────────────────

export class PySparkCustomUdfGenerator implements INodeGenerator {
  readonly nodeType = 'transformation' as const;
  readonly subType = 'custom_udf';

  canHandle(node: PipelineNode): boolean {
    return node.type === 'transformation' && node.transformationType === 'custom_udf';
  }

  async generate(node: PipelineNode, context: GenerationContext): Promise<GeneratedNodeCode> {
    const cfg = node.config as CustomUdfConfig;
    const inputVar = getInputVar(node, context);
    const varName = toVarName(node.name);
    const b = new CodeBuilder();
    const imports: string[] = [PYSPARK_IMPORTS.FUNCTIONS, PYSPARK_IMPORTS.TYPES];
    const warnings: any[] = [];

    if (context.options.includeComments) b.line(`# Transform: ${node.name} (Custom UDF: ${cfg.functionName})`);

    const returnTypeExpr = toPySparkType(cfg.returnType);
    const safeUdfName = cfg.functionName.replace(/[^a-zA-Z0-9_]/g, '_');

    if (cfg.language === 'python') {
      // Emit the UDF definition inline
      b.line(`# UDF definition`);
      b.line(`def _udf_impl_${safeUdfName}(*args):`);
      // Indent the user-provided code
      cfg.code.split('\n').forEach(line => {
        b.line(`    ${line}`);
      });
      b.blank();
      b.line(`${safeUdfName}_udf = F.udf(_udf_impl_${safeUdfName}, ${returnTypeExpr})`);
      b.blank();

      // Register in context so scaffold can emit it at top-level if needed
      context.udfRegistry.set(safeUdfName, {
        name: safeUdfName,
        registrationCode: `${safeUdfName}_udf = F.udf(_udf_impl_${safeUdfName}, ${returnTypeExpr})`,
        returnType: returnTypeExpr,
      });

      // Apply to columns
      if (cfg.columns.length === 0) {
        warnings.push({ nodeId: node.id, code: 'UDF_NO_COLUMNS', message: `UDF "${cfg.functionName}" has no column applications.`, severity: 'warn' as const });
        b.line(`${varName} = ${inputVar}  # UDF defined but not applied to any columns`);
      } else {
        b.line(`${varName} = (`);
        b.indent(b2 => {
          b2.line(`${inputVar}`);
          b2.indent(b3 => {
            cfg.columns.forEach(col => {
              const inputArgs = col.inputColumns.map(c => `F.col(${pyStringLiteral(c)})`).join(', ');
              b3.line(`.withColumn(${pyStringLiteral(col.outputColumn)}, ${safeUdfName}_udf(${inputArgs}))`);
            });
          });
        });
        b.line(')');
      }
    } else if (cfg.language === 'sql') {
      // Register as SQL function
      b.line(`spark.udf.register(${pyStringLiteral(cfg.functionName)}, lambda *args: eval(${pyStringLiteral(cfg.code)}), ${returnTypeExpr})`);
      b.line(`${varName} = ${inputVar}`);
      warnings.push({ nodeId: node.id, code: 'UDF_SQL_REGISTERED', message: `SQL UDF "${cfg.functionName}" registered. Use it in custom_sql nodes with spark.sql().`, severity: 'info' as const });
    } else {
      // Scala UDF — not executable in PySpark directly, emit a warning
      b.line(`# Scala UDF "${cfg.functionName}" cannot be executed directly in PySpark.`);
      b.line(`# Consider: (1) compile to JAR and register, or (2) convert to Python.`);
      b.line(`${varName} = ${inputVar}`);
      warnings.push({ nodeId: node.id, code: 'UDF_SCALA_IN_PYSPARK', message: `Scala UDF "${cfg.functionName}" requires compilation and JAR registration in PySpark.`, severity: 'warn' as const });
    }

    return { varName, code: b.build(), imports, warnings };
  }
}
