# SKILL.md — Code Generation Service (Codegen)
**Service Domain:** `codegen`  
**Last Updated:** 2026-03-17  
**Logger Name:** `LoggerFactory.get('codegen')`  
**Error Domain:** `CGEN-*` → `Backend/src/shared/errors/catalog/cgen.errors.ts`

> **Read before making any change to this service.**  
> Every change, user decision, or architectural rule must be appended to the  
> **"Living Decisions"** section at the bottom of this file.

---

## Purpose

Transforms a pipeline IR (Intermediate Representation) definition into executable
Spark code (PySpark or Scala Spark). Supports multiple targets, pluggable engines,
and produces complete, deployable code artifacts with supporting files.

---

## File Map

```
Backend/src/codegen/
├── codegen.service.ts                        — Entry point: generate(), validate(), listTechnologies()
├── core/
│   ├── types/pipeline.types.ts               — PipelineDefinition, NodeDefinition, EdgeDefinition, etc.
│   ├── interfaces/engine.interfaces.ts       — ICodegenEngine, GenerationOptions, GeneratedArtifact
│   └── constants/codegen.constants.ts        — Shared constants
├── engines/
│   └── spark/
│       ├── pyspark/
│       │   ├── pyspark.engine.ts             — PySpark engine entry
│       │   ├── pipeline/pipeline.scaffold.ts — Main script scaffold
│       │   ├── sources/                      — JDBC, File, Kafka, Delta/Hive/Iceberg generators
│       │   ├── sinks/all.sink.generators.ts  — All sink generators
│       │   └── transformations/              — basic, advanced, extra, scd, special generators
│       └── scala/
│           ├── scala-spark.engine.ts         — Scala engine entry
│           ├── scala.utils.ts                — Scala-specific utilities
│           ├── pipeline/pipeline.scaffold.ts — Scala script scaffold
│           ├── sources/all.source.generators.ts
│           ├── sinks/all.sink.generators.ts
│           └── transformations/              — all.transformation.generators.ts, scd-and-multi.generators.ts
├── registry/
│   ├── engine.registry.ts                    — Maps technology string → ICodegenEngine
│   └── node-generator.registry.ts           — Maps node type → generator function
├── utils/
│   ├── codegen.utils.ts                      — Shared utility functions
│   └── topo-sort.ts                          — Topological sort for DAG execution ordering
├── validators/
│   └── pipeline.validator.ts                 — IR validation before generation
└── __tests__/
    └── pyspark.integration.test.ts
```

---

## API Surface

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/codegen/generate` | Full code generation — returns `GeneratedArtifact` |
| `POST` | `/api/codegen/validate` | Validate IR only (no code produced) |
| `GET` | `/api/codegen/technologies` | List supported technologies |
| `POST` | `/api/codegen/preview` | Generate + return only entry-point script content |

Also invoked indirectly by:
- `POST /api/pipelines/:id/validate` → `codegenService.validate()`
- `POST /api/pipelines/:id/generate` → `codegenService.generate()`

---

## Core Types (`pipeline.types.ts`)

```typescript
PipelineDefinition {
  id: string
  name: string
  version: string
  description?: string
  environment: {
    technology: 'pyspark' | 'scala'   // determines engine selection
    sparkVersion?: string
    deploymentMode?: 'cluster' | 'client' | 'local'
    masterUrl?: string
  }
  sources: SourceNode[]
  transformations: TransformationNode[]
  sinks: SinkNode[]
  tags?: Record<string, string>
}
```

---

## Engine Registry

| Technology String | Engine File |
|---|---|
| `pyspark` | `engines/spark/pyspark/pyspark.engine.ts` |
| `scala` | `engines/spark/scala/scala-spark.engine.ts` |

**To add a new engine:**
1. Create engine file implementing `ICodegenEngine`
2. Register in `engine.registry.ts`
3. Add technology to `codegen.constants.ts`
4. Update this SKILL.md

---

## GeneratedArtifact Shape

```typescript
GeneratedArtifact {
  pipelineId: string
  technology: string
  generatedAt: string
  files: GeneratedFile[]   // multiple: main script, config, requirements, etc.
  metadata: {
    warnings: string[]
    nodeCount: number
    estimatedComplexity: string
  }
}

GeneratedFile {
  fileName: string
  language: 'python' | 'scala' | 'yaml' | 'text'
  content: string
  isEntryPoint: boolean    // the main executable script
}
```

---

## Transformation Categories

| Category | File | Examples |
|---|---|---|
| Basic | `basic.transformation.generators.ts` | filter, select, rename, cast, derive |
| Advanced | `advanced.transformation.generators.ts` | join, union, aggregate, window |
| Extra | `extra.transformation.generators.ts` | pivot, explode, flatten |
| SCD | `scd.transformation.generators.ts` | SCD Type 1, Type 2 |
| Special | `special.transformation.generators.ts` | dedup, data quality checks, custom SQL |

---

## Validation Rules (`pipeline.validator.ts`)

1. Pipeline must have at least one source node and one sink node.
2. All node IDs must be unique.
3. All edge source/target node IDs must reference existing nodes.
4. DAG must be acyclic (topological sort must succeed without cycles).
5. Required node configuration fields must be present.
6. Technology must be a registered engine.

Validation errors are returned as `{ valid: false, errors: string[] }` — never thrown
as exceptions (caller decides whether to block or warn).

---

## Generation Options

```typescript
GenerationOptions {
  includeComments?: boolean    // default: true
  includeLogging?: boolean     // default: true
  optimizationLevel?: 'none' | 'basic' | 'aggressive'
  targetEnvironment?: 'local' | 'cluster' | 'databricks' | 'emr' | 'dataproc'
}
```

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| `pipeline.types.ts.bak` exists alongside `pipeline.types.ts` — stale backup file | LOW | Delete `pipeline.types.ts.bak` |
| No logger (`LoggerFactory.get('codegen')`) in `codegen.service.ts` — no logging | HIGH | Add logger at module scope |
| Error handling in `codegen.service.ts` does not use `cgen.errors.ts` catalog | HIGH | Wrap errors in `AppError` with `CGEN-*` codes |
| Only PySpark and Scala Spark supported — no SparkSQL engine | MEDIUM | Future: SparkSQL / dbt engines |
| Generated artifacts not automatically persisted in `catalog.*` schema — only stored in legacy `pipelines` table | HIGH | Artifact persistence must target proper artifact table in catalog schema |
| No streaming pipeline support (Spark Structured Streaming) | MEDIUM | Planned feature |
| `node-generator.registry.ts` — mapping completeness unknown | MEDIUM | Audit all node types in `pipeline.types.ts` have a registered generator |

---

## Living Decisions

> Append every user decision, architectural ruling, or critical instruction here.

- `2026-03-17` — SKILL.md created. PySpark and Scala engines are implemented with
  full source/sink/transformation coverage. Integration test in `__tests__/`.
- `2026-03-17` — **Design Rule:** The codegen service is STATELESS. It takes a
  `PipelineDefinition` in, returns a `GeneratedArtifact` out. It does NOT read from
  or write to the database. The calling service (pipelines service) owns persistence.
- `2026-03-17` — **Validation Rule:** `codegenService.validate()` must be called before
  `codegenService.generate()`. The generate method may assume a valid IR.
- `2026-03-17` — **Topological Sort:** Execution order of nodes is determined by
  `utils/topo-sort.ts`. Any edge addition that creates a cycle must be caught by the
  validator before reaching the engine.
- `2026-03-17` — **Artifact File:** `pipeline.types.ts.bak` is a leftover backup.
  Do not read from or reference it. It should be deleted.
