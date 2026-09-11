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

const ALLOWLISTED_FILES = [
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
];

function scanDirectory(dirPath: string): { file: string; term: string; line: number }[] {
  const violations: { file: string; term: string; line: number }[] = [];
  if (!fs.existsSync(dirPath)) return violations;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist' || entry.name === 'out') {
        continue;
      }
      violations.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      if (ALLOWLISTED_FILES.some((allowed) => entry.name.endsWith(allowed))) {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((lineText, index) => {
        for (const term of FORBIDDEN_TERMS) {
          const regex = new RegExp(`\\b${term}\\b`, 'i');
          if (regex.test(lineText)) {
            violations.push({
              file: path.relative(process.cwd(), fullPath),
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
  let totalViolations: { file: string; term: string; line: number }[] = [];

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
