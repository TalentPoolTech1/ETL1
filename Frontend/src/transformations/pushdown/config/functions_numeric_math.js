/**
 * Numeric & Mathematical Functions Configuration
 * ~42 functions across all technologies
 */
import { FunctionCategory, SupportLevel, SourceTechnology, functionEntry, capability, } from './FunctionMatrixTypes';
export const numericMathFunctions = [
    // Basic Arithmetic & Rounding
    functionEntry('round_decimal', 'Round to decimal places', FunctionCategory.NUMERIC_MATH, 'Round number to specified decimal places', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'ROUND(n, d)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'ROUND(n, d)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'ROUND(n, d)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'ROUND(n, d)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'ROUND(n, d)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'ROUND(n, d)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'round(col, d)'),
    }, {
        priority: 'high',
        standardName: 'ROUND',
        notes: 'Universally supported with identical syntax',
    }),
    functionEntry('floor', 'Round down (Floor)', FunctionCategory.NUMERIC_MATH, 'Round number down to nearest integer', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'FLOOR(n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'FLOOR(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'FLOOR(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'FLOOR(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'FLOOR(n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'FLOOR(n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'floor(col)'),
    }, {
        priority: 'high',
        notes: 'Universally supported with identical syntax',
    }),
    functionEntry('ceil', 'Round up (Ceiling)', FunctionCategory.NUMERIC_MATH, 'Round number up to nearest integer', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'CEIL(n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'CEIL(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'CEILING(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'CEILING(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'CEIL(n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'CEIL(n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'ceil(col)'),
    }, {
        priority: 'high',
        notes: 'Oracle/PG/RS use CEIL; MySQL/SS use CEILING. UI should accept either.',
        uiBehavior: 'Show alternative syntax tip for MySQL and SQL Server',
    }),
    functionEntry('trunc_decimal', 'Truncate decimal', FunctionCategory.NUMERIC_MATH, 'Truncate / remove decimal places (different from rounding)', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'TRUNC(n, d)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'TRUNC(n, d)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'TRUNCATE(n, d)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.ALTERNATIVE, 'ROUND(n, d, 1)', {
            notes: 'Uses ROUND with third parameter (truncate flag)',
            alternative: {
                functionId: 'round_decimal',
                label: 'ROUND with truncate',
                reason: 'SQL Server uses ROUND() with third param=1 to truncate',
            },
        }),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'TRUNC(n, d)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'TRUNC(n, d)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'bround(col, d)'),
    }, {
        priority: 'high',
        notes: 'SQL Server alternative uses ROUND with truncate flag. MySQL uses TRUNCATE (different syntax from Oracle).',
    }),
    functionEntry('abs', 'Absolute value', FunctionCategory.NUMERIC_MATH, 'Return absolute (positive) value of number', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'ABS(n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'ABS(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'ABS(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'ABS(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'ABS(n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'ABS(n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'abs(col)'),
    }, {
        priority: 'high',
        notes: 'Universally supported with identical syntax',
    }),
    functionEntry('modulo', 'Modulo (remainder)', FunctionCategory.NUMERIC_MATH, 'Return remainder of division operation', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'MOD(n, d)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'MOD(n, d)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'MOD(n, d)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.ALTERNATIVE, 'n % d', {
            notes: 'SQL Server uses % operator instead of MOD function',
        }),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'MOD(n, d)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'MOD(n, d)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'col % d'),
    }, {
        priority: 'high',
        notes: 'SQL Server uses % operator; others use MOD function.',
    }),
    functionEntry('power', 'Power / Exponent', FunctionCategory.NUMERIC_MATH, 'Raise number to a power (e.g., n^e)', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'POWER(n, e)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'POWER(n, e)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'POWER(n, e)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'POWER(n, e)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'POWER(n, e)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'POWER(n, e)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'pow(col, e)'),
    }, {
        priority: 'medium',
        notes: 'Universally supported with identical syntax',
    }),
    functionEntry('sqrt', 'Square root', FunctionCategory.NUMERIC_MATH, 'Return square root of number', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'SQRT(n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'SQRT(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'SQRT(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'SQRT(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'SQRT(n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'SQRT(n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'sqrt(col)'),
    }, {
        priority: 'medium',
        notes: 'Universally supported with identical syntax',
    }),
    functionEntry('sign', 'Sign of number', FunctionCategory.NUMERIC_MATH, 'Return -1, 0, or 1 indicating sign of number', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'SIGN(n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'SIGN(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'SIGN(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'SIGN(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'SIGN(n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'SIGN(n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'signum(col)'),
    }, {
        priority: 'medium',
    }),
    // Logarithmic & Exponential
    functionEntry('ln', 'Natural logarithm', FunctionCategory.NUMERIC_MATH, 'Return natural logarithm (base e) of number', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'LN(n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'LN(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'LN(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'LOG(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'LN(n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'LN(n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'log(col)'),
    }, {
        priority: 'medium',
        notes: 'SQL Server uses LOG() for natural log. Others use LN().',
        uiBehavior: 'Show note for SQL Server users',
    }),
    functionEntry('log10', 'Log base 10', FunctionCategory.NUMERIC_MATH, 'Return logarithm base 10 of number', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'LOG(10, n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'LOG(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'LOG10(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'LOG10(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'LOG(10, n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'LOG(10, n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'log10(col)'),
    }, {
        priority: 'medium',
        notes: 'Syntax varies: Oracle/Redshift use LOG(10,n); PostgreSQL uses LOG(n); MySQL/SS use LOG10(n)',
    }),
    functionEntry('exp', 'Exponential (e^n)', FunctionCategory.NUMERIC_MATH, 'Return e raised to the power of number', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'EXP(n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'EXP(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'EXP(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'EXP(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'EXP(n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'EXP(n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'exp(col)'),
    }, {
        priority: 'medium',
    }),
    // Trigonometric
    functionEntry('sin', 'Sine', FunctionCategory.NUMERIC_MATH, 'Return sine of angle in radians', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'SIN(n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'SIN(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'SIN(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'SIN(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'SIN(n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'SIN(n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'sin(col)'),
    }, {
        priority: 'low',
        notes: 'Universally supported',
    }),
    functionEntry('cos', 'Cosine', FunctionCategory.NUMERIC_MATH, 'Return cosine of angle in radians', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'COS(n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'COS(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'COS(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'COS(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'COS(n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'COS(n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'cos(col)'),
    }, {
        priority: 'low',
    }),
    functionEntry('tan', 'Tangent', FunctionCategory.NUMERIC_MATH, 'Return tangent of angle in radians', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'TAN(n)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'TAN(n)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'TAN(n)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'TAN(n)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'TAN(n)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'TAN(n)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'tan(col)'),
    }, {
        priority: 'low',
    }),
    functionEntry('atan2', 'Arc tangent (2-arg)', FunctionCategory.NUMERIC_MATH, 'Return arc tangent of y/x in radians', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'ATAN2(y, x)'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'ATAN2(y, x)'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'ATAN2(y, x)'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'ATN2(y, x)'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'ATAN2(y, x)'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'ATAN2(y, x)'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'atan2(y, x)'),
    }, {
        priority: 'low',
        notes: 'SQL Server uses ATN2 instead of ATAN2',
        uiBehavior: 'Show note for SQL Server',
    }),
    functionEntry('random', 'Random number 0-1', FunctionCategory.NUMERIC_MATH, 'Generate random float between 0 and 1', {
        [SourceTechnology.ORACLE]: capability(SupportLevel.NATIVE, 'DBMS_RANDOM.VALUE'),
        [SourceTechnology.POSTGRESQL]: capability(SupportLevel.NATIVE, 'RANDOM()'),
        [SourceTechnology.MYSQL]: capability(SupportLevel.NATIVE, 'RAND()'),
        [SourceTechnology.SQLSERVER]: capability(SupportLevel.NATIVE, 'RAND()'),
        [SourceTechnology.REDSHIFT]: capability(SupportLevel.NATIVE, 'RANDOM()'),
        [SourceTechnology.SNOWFLAKE]: capability(SupportLevel.NATIVE, 'RANDOM()'),
        [SourceTechnology.PYSPARK]: capability(SupportLevel.NATIVE, 'rand()'),
    }, {
        priority: 'medium',
        notes: 'Non-deterministic function. Warning: Will return different values on each call.',
        uiBehavior: 'Show warning about non-determinism in pipeline context',
    }),
];
