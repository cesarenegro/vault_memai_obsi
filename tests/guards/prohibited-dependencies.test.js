import fs from 'fs';
import path from 'path';

/**
 * Automated Prohibited Dependency Guard Test
 * Scans application source files to ensure no forbidden external dependencies,
 * APIs, or AI providers are introduced into LIMEN Vault.
 */

const FORBIDDEN_TERMS = [
  'anthropic',
  'claude',
  'memaiFetch',
  'PII_CRM',
  'M3MAI',
  'gemini',
  'deepseek',
];

const SCAN_DIRS = [
  path.resolve(process.cwd(), 'apps'),
  path.resolve(process.cwd(), 'packages'),
];

// Files that document or present prohibited provider rules to users
const ALLOWLISTED_FILES = [
  'prohibited-dependencies.test.js',
  'prohibited-dependencies.test.ts',
  'M0_M1_IMPLEMENTATION_REPORT.md',
  'AGENTS.md',
  'AGENT.md',
  'README.md',
  'implementation_plan.md',
  'ARCHITECTURE.md',
  'SECURITY_MODEL.md',
  'MILESTONES.md',
  'DEVELOPMENT.md',
  'documentation/page.tsx',
];

function scanDirectory(dirPath) {
  const violations = [];
  if (!fs.existsSync(dirPath)) return violations;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === 'dist' ||
        entry.name === 'out' ||
        entry.name === 'target'
      ) {
        continue;
      }
      violations.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      const relativePath = path.relative(process.cwd(), fullPath);
      if (ALLOWLISTED_FILES.some((allowed) => relativePath.endsWith(allowed))) {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((lineText, index) => {
        // Skip comment lines or UI copy explaining non-configured status
        if (lineText.includes('NOT CONFIGURED') || lineText.trim().startsWith('//') || lineText.trim().startsWith('/*')) {
          return;
        }

        for (const term of FORBIDDEN_TERMS) {
          const regex = new RegExp(`\\b${term}\\b`, 'i');
          if (regex.test(lineText)) {
            violations.push({
              file: relativePath,
              term,
              line: index + 1,
            });
          }
        }
      });
    }
  }

  return violations;
}

function runGuardTest() {
  console.log('🛡️  Running Prohibited Dependency Guard Test for LIMEN Vault...');
  let totalViolations = [];

  for (const dir of SCAN_DIRS) {
    totalViolations.push(...scanDirectory(dir));
  }

  if (totalViolations.length > 0) {
    console.error('❌  FAIL: Prohibited runtime dependency detected!');
    totalViolations.forEach((v) => {
      console.error(`   - ${v.file}:${v.line} -> Found prohibited term "${v.term}"`);
    });
    process.exit(1);
  } else {
    console.log('✅  PASS: Zero prohibited dependencies detected in apps/ and packages/.');
  }
}

runGuardTest();
