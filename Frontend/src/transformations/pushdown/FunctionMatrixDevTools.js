/**
 * Function Matrix Development & Debugging Utilities
 *
 * Tools for developers to:
 * - View current matrix state
 * - Toggle functions/categories on/off
 * - Generate reports
 * - Validate matrix integrity
 * - Export configuration
 */
import FunctionMatrixService from './FunctionMatrixService';
import { SupportLevel } from './FunctionMatrixTypes';
/**
 * Development utilities for function matrix
 */
export class FunctionMatrixDevTools {
    constructor(service) {
        Object.defineProperty(this, "service", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.service = service || FunctionMatrixService.getInstance();
    }
    /**
     * Print current state to console
     */
    printCurrentState() {
        console.log('\n========== FUNCTION MATRIX STATE ==========');
        const stats = this.service.getStatistics();
        console.log(`Total Functions: ${stats.totalFunctions}`);
        console.log(`Enabled Functions: ${stats.enabledFunctions}`);
        console.log(`Total Categories: ${stats.totalCategories}`);
        console.log('\nFunctions by Category:');
        for (const [cat, count] of Object.entries(stats.functionsByCategory)) {
            console.log(`  ${cat}: ${count}`);
        }
        console.log('\nSupport by Technology:');
        for (const [tech, count] of Object.entries(stats.supportByTech)) {
            console.log(`  ${tech}: ${count}`);
        }
        console.log(`\nFeature Flags:`, this.service.getFeatureFlags());
        console.log('===========================================\n');
    }
    /**
     * List all functions in a category
     */
    listCategory(category) {
        const functions = this.service.getFunctionsByCategory(category);
        console.log(`\n========== CATEGORY: ${category} (${functions.length}) ==========`);
        functions.forEach(fn => {
            console.log(`  ${fn.id}: ${fn.label} [${fn.status || 'stable'}]`);
        });
        console.log('===========================================\n');
    }
    /**
     * List all functions for a technology
     */
    listTechnology(tech) {
        const functions = this.service.getFunctionsByTechnology(tech);
        console.log(`\n========== TECHNOLOGY: ${tech} (${functions.length}) ==========`);
        functions.forEach(fn => {
            const cap = fn.capabilities[tech];
            console.log(`  ${fn.id}: ${fn.label} [${cap?.support}]`);
        });
        console.log('===========================================\n');
    }
    /**
     * Show details of a specific function
     */
    showFunction(functionId) {
        const fn = this.service.getFunction(functionId);
        if (!fn) {
            console.log(`Function not found: ${functionId}`);
            return;
        }
        console.log(`\n========== FUNCTION: ${fn.id} ==========`);
        console.log(`Label: ${fn.label}`);
        console.log(`Category: ${fn.category}`);
        console.log(`Status: ${fn.status || 'stable'}`);
        console.log(`Description: ${fn.description}`);
        console.log(`Priority: ${fn.priority || 'medium'}`);
        console.log(`Enabled: ${fn.enabled}`);
        console.log('\nTechnology Support:');
        for (const tech of this.service.getAllPlusPySpark()) {
            const cap = fn.capabilities[tech];
            if (cap) {
                console.log(`  ${tech}:`);
                console.log(`    Support: ${cap.support}`);
                console.log(`    Syntax: ${cap.syntax}`);
                if (cap.notes)
                    console.log(`    Notes: ${cap.notes}`);
                if (cap.example)
                    console.log(`    Example: ${cap.example}`);
            }
        }
        console.log('===========================================\n');
    }
    /**
     * Toggle a category on/off
     */
    toggleCategory(category) {
        const flags = this.service.getFeatureFlags();
        const currentState = flags.byCategory[category] ?? true;
        if (currentState) {
            this.service.disableCategory(category);
            console.log(`Disabled category: ${category}`);
            return false;
        }
        else {
            this.service.enableCategory(category);
            console.log(`Enabled category: ${category}`);
            return true;
        }
    }
    /**
     * Toggle a function on/off
     */
    toggleFunction(functionId) {
        const flags = this.service.getFeatureFlags();
        const currentState = flags.byFunction[functionId];
        if (currentState === undefined || currentState) {
            this.service.disableFunction(functionId);
            console.log(`Disabled function: ${functionId}`);
            return false;
        }
        else {
            this.service.enableFunction(functionId);
            console.log(`Enabled function: ${functionId}`);
            return true;
        }
    }
    /**
     * Enable all functions
     */
    enableAll() {
        for (const cat of this.service.getAllCategories()) {
            this.service.enableCategory(cat);
        }
        console.log('Enabled all categories');
    }
    /**
     * Disable all functions
     */
    disableAll() {
        for (const cat of this.service.getAllCategories()) {
            this.service.disableCategory(cat);
        }
        console.log('Disabled all categories');
    }
    /**
     * Get a function's syntax for a specific technology
     */
    getSyntax(functionId, tech) {
        const fn = this.service.getFunction(functionId);
        if (!fn)
            return null;
        return fn.capabilities[tech]?.syntax ?? null;
    }
    /**
     * Generate a comprehensive validation report
     */
    validateMatrix() {
        const errors = [];
        const warnings = [];
        const stats = this.service.getStatistics();
        if (stats.totalFunctions === 0) {
            errors.push('No functions loaded');
            return { isValid: false, errors, warnings, stats: stats };
        }
        if (stats.enabledFunctions === 0) {
            warnings.push('No functions are currently enabled');
        }
        // Check coverage
        for (const tech of this.service.getAllTechnologies()) {
            if (!stats.supportByTech[tech]) {
                warnings.push(`No functions loaded for ${tech}`);
            }
        }
        const coverageByTech = {};
        for (const tech of this.service.getAllPlusPySpark()) {
            const functions = this.service.getFunctionsByTechnology(tech);
            const coverage = { native: 0, alternative: 0, partial: 0, none: 0 };
            functions.forEach(fn => {
                const cap = fn.capabilities[tech];
                if (!cap)
                    return;
                switch (cap.support) {
                    case SupportLevel.NATIVE:
                        coverage.native++;
                        break;
                    case SupportLevel.ALTERNATIVE:
                        coverage.alternative++;
                        break;
                    case SupportLevel.PARTIAL:
                        coverage.partial++;
                        break;
                    default:
                        coverage.none++;
                }
            });
            coverageByTech[tech] = coverage;
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            stats: {
                ...stats,
                technologyCoverage: coverageByTech,
            },
        };
    }
    /**
     * Generate a coverage report showing technology compatibility matrix
     */
    generateCoverageMatrix() {
        console.log('\n========== FUNCTION COVERAGE MATRIX ==========');
        const categories = this.service.getAllCategories();
        const technologies = this.service.getAllTechnologies();
        // Header
        console.log('Category'.padEnd(25) +
            technologies.map(t => t.substring(0, 8).padEnd(10)).join(''));
        console.log('-'.repeat(25 + technologies.length * 10));
        // Rows
        for (const cat of categories) {
            let row = cat.padEnd(25);
            for (const tech of technologies) {
                const functions = this.service.getFunctionsByCategoryAndTech(cat, tech);
                const count = functions.length.toString().padEnd(10);
                row += count;
            }
            console.log(row);
        }
        console.log('=============================================\n');
    }
    /**
     * Export current state as JSON
     */
    exportAsJSON() {
        const matrix = this.service.exportMatrix();
        return JSON.stringify(matrix, null, 2);
    }
    /**
     * Export statistics as CSV
     */
    exportStatsAsCSV() {
        const stats = this.service.getStatistics();
        let csv = 'Category,Count\n';
        for (const [cat, count] of Object.entries(stats.functionsByCategory)) {
            csv += `${cat},${count}\n`;
        }
        return csv;
    }
    /**
     * Generate a markdown report
     */
    generateMarkdownReport() {
        const stats = this.service.getStatistics();
        const report = this.validateMatrix();
        let md = '# Function Matrix Report\n\n';
        md += `Generated: ${new Date().toISOString()}\n\n`;
        md += '## Summary\n\n';
        md += `- **Total Functions**: ${stats.totalFunctions}\n`;
        md += `- **Enabled Functions**: ${stats.enabledFunctions}\n`;
        md += `- **Categories**: ${stats.totalCategories}\n`;
        md += `- **Valid**: ${report.isValid ? '✓ Yes' : '✗ No'}\n\n`;
        if (report.errors.length > 0) {
            md += '## Errors\n\n';
            report.errors.forEach(err => (md += `- ${err}\n`));
            md += '\n';
        }
        if (report.warnings.length > 0) {
            md += '## Warnings\n\n';
            report.warnings.forEach(warn => (md += `- ${warn}\n`));
            md += '\n';
        }
        md += '## Functions by Category\n\n';
        for (const [cat, count] of Object.entries(stats.functionsByCategory)) {
            md += `- ${cat}: ${count}\n`;
        }
        md += '\n';
        md += '## Coverage by Technology\n\n';
        md += '| Technology | Functions | Native | Alternative | Partial | None |\n';
        md += '|---|---|---|---|---|---|\n';
        for (const [tech, coverage] of Object.entries(report.stats.technologyCoverage)) {
            const total = coverage.native + coverage.alternative + coverage.partial + coverage.none;
            md += `| ${tech} | ${total} | ${coverage.native} | ${coverage.alternative} | ${coverage.partial} | ${coverage.none} |\n`;
        }
        return md;
    }
    /**
     * Generate a JSON report
     */
    generateJSONReport() {
        return {
            timestamp: new Date().toISOString(),
            statistics: this.service.getStatistics(),
            validation: this.validateMatrix(),
            featureFlags: this.service.getFeatureFlags(),
            matrices: this.service.exportMatrix(),
        };
    }
}
/**
 * Global development instance for browser console
 */
export const functionMatrixDevTools = new FunctionMatrixDevTools();
// Expose globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    window.functionMatrixDev = functionMatrixDevTools;
    console.log('Function Matrix Dev Tools available as window.functionMatrixDev');
    console.log('Usage: functionMatrixDev.printCurrentState(), functionMatrixDev.listCategory(category), etc.');
}
export default FunctionMatrixDevTools;
