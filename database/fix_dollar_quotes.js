const fs = require('fs');

const files = [
  'c:/Users/yourf/Documents/ETL1/database/logic/rbac_logic.sql',
  'c:/Users/yourf/Documents/ETL1/database/logic/hierarchy_logic.sql',
  'c:/Users/yourf/Documents/ETL1/database/logic/catalog_logic.sql',
  'c:/Users/yourf/Documents/ETL1/database/logic/pipeline_logic.sql',
  'c:/Users/yourf/Documents/ETL1/database/logic/execution_logic.sql',
  'c:/Users/yourf/Documents/ETL1/database/logic/lifecycle_logic.sql',
  'c:/Users/yourf/Documents/ETL1/database/logic/persistence_logic.sql',
  'c:/Users/yourf/Documents/ETL1/database/logic/governance_logic.sql',
];

for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');

  // Fix PowerShell backtick-n corruption: literal backtick+n → real newline
  c = c.replace(/`n/g, '\n');

  // Fix "LANGUAGE xxx AS $\n" → "LANGUAGE xxx AS $$\n"
  // Only replace single $ at end of line (not already $$)
  // Pattern: AS followed by whitespace, then single $, then optional whitespace, then newline
  c = c.replace(/(AS\s+)\$(\s*[\r\n])/g, '$1$$$$$2');

  // Fix standalone "$;" line (possibly with leading/trailing whitespace) → "$$;"
  // This handles closing dollar-quote delimiter
  c = c.replace(/^(\s*)\$;(\s*)$/gm, '$1$$$$;$2');

  fs.writeFileSync(f, c, 'utf8');
  console.log('Fixed:', f);

  // Verify no remaining single-$ patterns
  const remaining = (c.match(/AS\s+\$\s*[\r\n]/g) || []).length;
  const remainingClose = (c.match(/^\s*\$;\s*$/gm) || []).length;
  if (remaining > 0 || remainingClose > 0) {
    console.log('  WARNING: still has', remaining, 'open and', remainingClose, 'close single-$ delimiters');
  } else {
    console.log('  OK: all dollar-quote delimiters doubled');
  }
}
