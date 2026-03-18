/**
 * Code Generation Layer
 *
 * Compiles TransformStep and TransformSequence IR into engine-specific SQL code.
 * Handles all 3 engines: Spark SQL, PostgreSQL, Redshift.
 */
import { getTransform } from '../registry/TransformRegistry';
/**
 * Base code generator interface
 */
export class BaseCodeGenerator {
    constructor() {
        Object.defineProperty(this, "warnings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    resetWarnings() {
        this.warnings = [];
    }
    addWarning(msg) {
        this.warnings.push(msg);
    }
}
/**
 * Spark SQL Code Generator
 */
export class SparkSQLGenerator extends BaseCodeGenerator {
    compile(step, inputExpr) {
        this.resetWarnings();
        const primitive = getTransform(step.type);
        if (!primitive) {
            return {
                sql: '',
                warnings: [`Unknown transform type: ${step.type}`],
                isValid: false,
            };
        }
        if (!primitive.codeGenTemplate.spark) {
            this.addWarning(`${primitive.label} is not natively supported in Spark SQL`);
            return {
                sql: inputExpr,
                warnings: this.warnings,
                isValid: false,
            };
        }
        try {
            const sql = primitive.codeGenTemplate.spark(step.params, inputExpr);
            return {
                sql,
                warnings: this.warnings,
                isValid: true,
            };
        }
        catch (err) {
            this.addWarning(`Code generation failed: ${err.message}`);
            return {
                sql: inputExpr,
                warnings: this.warnings,
                isValid: false,
            };
        }
    }
    compileSequence(sequence) {
        this.resetWarnings();
        if (sequence.targetEngine !== 'spark' && sequence.targetEngine !== undefined) {
            this.addWarning(`Sequence targets ${sequence.targetEngine}, not Spark`);
        }
        const enabledSteps = sequence.steps.filter(s => s.enabled);
        if (enabledSteps.length === 0) {
            return {
                sql: sequence.columnName,
                warnings: this.warnings,
                isValid: true,
            };
        }
        let currentExpr = sequence.columnName;
        for (let i = 0; i < enabledSteps.length; i++) {
            const step = enabledSteps[i];
            const result = this.compile(step, currentExpr);
            if (!result.isValid && step.onError === 'FAIL') {
                return {
                    sql: '',
                    warnings: [`Step ${i + 1} failed: ${result.warnings.join('; ')}`],
                    isValid: false,
                };
            }
            this.warnings.push(...result.warnings);
            currentExpr = result.sql;
            // Wrap in COALESCE for NULL handling
            if (step.onError === 'RETURN_NULL') {
                currentExpr = `COALESCE(${currentExpr}, NULL)`;
            }
            else if (step.onError === 'USE_DEFAULT' && step.defaultValue !== undefined) {
                currentExpr = `COALESCE(${currentExpr}, ${this.escapeString(String(step.defaultValue))})`;
            }
        }
        return {
            sql: currentExpr,
            warnings: this.warnings,
            isValid: true,
        };
    }
    escapeIdentifier(name) {
        return `\`${name.replace(/`/g, '``')}\``;
    }
    escapeString(value) {
        return `'${value.replace(/'/g, "''")}'`;
    }
}
/**
 * PostgreSQL Code Generator
 */
export class PostgreSQLGenerator extends BaseCodeGenerator {
    compile(step, inputExpr) {
        this.resetWarnings();
        const primitive = getTransform(step.type);
        if (!primitive) {
            return {
                sql: '',
                warnings: [`Unknown transform type: ${step.type}`],
                isValid: false,
            };
        }
        if (!primitive.codeGenTemplate.postgresql) {
            this.addWarning(`${primitive.label} is not natively supported in PostgreSQL`);
            return {
                sql: inputExpr,
                warnings: this.warnings,
                isValid: false,
            };
        }
        try {
            const sql = primitive.codeGenTemplate.postgresql(step.params, inputExpr);
            return {
                sql,
                warnings: this.warnings,
                isValid: true,
            };
        }
        catch (err) {
            this.addWarning(`Code generation failed: ${err.message}`);
            return {
                sql: inputExpr,
                warnings: this.warnings,
                isValid: false,
            };
        }
    }
    compileSequence(sequence) {
        this.resetWarnings();
        const enabledSteps = sequence.steps.filter(s => s.enabled);
        if (enabledSteps.length === 0) {
            return {
                sql: this.escapeIdentifier(sequence.columnName),
                warnings: this.warnings,
                isValid: true,
            };
        }
        let currentExpr = this.escapeIdentifier(sequence.columnName);
        for (let i = 0; i < enabledSteps.length; i++) {
            const step = enabledSteps[i];
            const result = this.compile(step, currentExpr);
            if (!result.isValid && step.onError === 'FAIL') {
                return {
                    sql: '',
                    warnings: [`Step ${i + 1} failed: ${result.warnings.join('; ')}`],
                    isValid: false,
                };
            }
            this.warnings.push(...result.warnings);
            currentExpr = result.sql;
            // Wrap in COALESCE for NULL handling
            if (step.onError === 'RETURN_NULL') {
                currentExpr = `COALESCE(${currentExpr}, NULL)`;
            }
            else if (step.onError === 'USE_DEFAULT' && step.defaultValue !== undefined) {
                currentExpr = `COALESCE(${currentExpr}, ${this.escapeString(String(step.defaultValue))})`;
            }
        }
        return {
            sql: currentExpr,
            warnings: this.warnings,
            isValid: true,
        };
    }
    escapeIdentifier(name) {
        return `"${name.replace(/"/g, '""')}"`;
    }
    escapeString(value) {
        return `'${value.replace(/'/g, "''")}'`;
    }
}
/**
 * Amazon Redshift Code Generator
 */
export class RedshiftCodeGenerator extends BaseCodeGenerator {
    compile(step, inputExpr) {
        this.resetWarnings();
        const primitive = getTransform(step.type);
        if (!primitive) {
            return {
                sql: '',
                warnings: [`Unknown transform type: ${step.type}`],
                isValid: false,
            };
        }
        if (!primitive.codeGenTemplate.redshift) {
            this.addWarning(`${primitive.label} is not natively supported in Redshift`);
            return {
                sql: inputExpr,
                warnings: this.warnings,
                isValid: false,
            };
        }
        try {
            const sql = primitive.codeGenTemplate.redshift(step.params, inputExpr);
            return {
                sql,
                warnings: this.warnings,
                isValid: true,
            };
        }
        catch (err) {
            this.addWarning(`Code generation failed: ${err.message}`);
            return {
                sql: inputExpr,
                warnings: this.warnings,
                isValid: false,
            };
        }
    }
    compileSequence(sequence) {
        this.resetWarnings();
        const enabledSteps = sequence.steps.filter(s => s.enabled);
        if (enabledSteps.length === 0) {
            return {
                sql: this.escapeIdentifier(sequence.columnName),
                warnings: this.warnings,
                isValid: true,
            };
        }
        let currentExpr = this.escapeIdentifier(sequence.columnName);
        for (let i = 0; i < enabledSteps.length; i++) {
            const step = enabledSteps[i];
            const result = this.compile(step, currentExpr);
            if (!result.isValid && step.onError === 'FAIL') {
                return {
                    sql: '',
                    warnings: [`Step ${i + 1} failed: ${result.warnings.join('; ')}`],
                    isValid: false,
                };
            }
            this.warnings.push(...result.warnings);
            currentExpr = result.sql;
            // Wrap in COALESCE for NULL handling
            if (step.onError === 'RETURN_NULL') {
                currentExpr = `COALESCE(${currentExpr}, NULL)`;
            }
            else if (step.onError === 'USE_DEFAULT' && step.defaultValue !== undefined) {
                currentExpr = `COALESCE(${currentExpr}, ${this.escapeString(String(step.defaultValue))})`;
            }
        }
        return {
            sql: currentExpr,
            warnings: this.warnings,
            isValid: true,
        };
    }
    escapeIdentifier(name) {
        return `"${name.replace(/"/g, '""')}"`;
    }
    escapeString(value) {
        return `'${value.replace(/'/g, "''")}'`;
    }
}
/**
 * Factory: Get the appropriate generator for an engine
 */
export function getCodeGenerator(engine) {
    switch (engine) {
        case 'spark':
            return new SparkSQLGenerator();
        case 'postgresql':
            return new PostgreSQLGenerator();
        case 'redshift':
            return new RedshiftCodeGenerator();
        default:
            throw new Error(`Unsupported engine: ${engine}`);
    }
}
/**
 * Compile a single step to SQL
 */
export function compileStep(step, engine, inputExpr = 'value') {
    const generator = getCodeGenerator(engine);
    return generator.compile(step, inputExpr);
}
/**
 * Compile an entire sequence to SQL
 */
export function compileSequence(sequence) {
    const generator = getCodeGenerator(sequence.targetEngine);
    return generator.compileSequence(sequence);
}
