import fs from 'fs';
import path from 'path';
import { VaultManifestSchema, FrontmatterSchema } from '@limen-vault/vault-schema';
import { validateSymlinkSafety, SecurityPathError } from './path-guard.js';

export const REQUIRED_VAULT_FOLDERS = [
  '00_SYSTEM',
  '01_CLIENTS',
  '02_PROJECTS',
  '03_BRANDS',
  '04_POSITIONING',
  '05_PACKAGING_KNOWLEDGE',
  '06_METHODS',
  '07_CASE_STUDIES',
  '08_MARKET_RESEARCH',
  '09_COMPETITORS',
  '10_APPROVED_OUTPUTS',
  '20_RAW_SOURCES',
  '80_AI_OUTPUTS',
  '90_PROPOSALS',
  '99_ARCHIVE',
] as const;

export interface VaultValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checkedFoldersCount: number;
  checkedFilesCount: number;
  systemFilesValid: boolean;
}

/**
 * Parses simple YAML frontmatter blocks from a Markdown string.
 */
export function parseYamlFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yamlBlock = match[1];
  const result: Record<string, unknown> = {};

  for (const line of yamlBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let rawVal = trimmed.slice(colonIdx + 1).trim();

    // Clean quotes
    if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
      rawVal = rawVal.slice(1, -1);
    }

    // Array syntax [item1, item2]
    if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      const items = rawVal
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      result[key] = items;
    } else if (rawVal === 'true') {
      result[key] = true;
    } else if (rawVal === 'false') {
      result[key] = false;
    } else if (!isNaN(Number(rawVal)) && rawVal !== '') {
      result[key] = Number(rawVal);
    } else {
      result[key] = rawVal;
    }
  }

  return result;
}

export class VaultValidator {
  /**
   * Validates an existing Vault directory structure, system files, and frontmatter.
   * Performs READ-ONLY operations and returns a structured validation result.
   */
  static validateVault(vaultRoot: string): VaultValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let checkedFoldersCount = 0;
    let checkedFilesCount = 0;
    let systemFilesValid = false;

    const resolvedRoot = path.resolve(vaultRoot);

    if (!fs.existsSync(resolvedRoot)) {
      return {
        isValid: false,
        errors: [`Vault path does not exist: "${vaultRoot}"`],
        warnings: [],
        checkedFoldersCount: 0,
        checkedFilesCount: 0,
        systemFilesValid: false,
      };
    }

    const stat = fs.statSync(resolvedRoot);
    if (!stat.isDirectory()) {
      return {
        isValid: false,
        errors: [`Vault path is not a directory: "${vaultRoot}"`],
        warnings: [],
        checkedFoldersCount: 0,
        checkedFilesCount: 0,
        systemFilesValid: false,
      };
    }

    // 1. Verify 15 Required Folders & Symlink Security
    for (const folder of REQUIRED_VAULT_FOLDERS) {
      const folderPath = path.join(resolvedRoot, folder);
      try {
        validateSymlinkSafety(resolvedRoot, folderPath);

        if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
          errors.push(`Missing required vault folder: "${folder}"`);
        } else {
          checkedFoldersCount++;
        }
      } catch (err) {
        if (err instanceof SecurityPathError) {
          errors.push(`Security Violation: ${err.message}`);
        } else {
          errors.push(`Folder access error for "${folder}": ${(err as Error).message}`);
        }
      }
    }

    // 2. Verify Required System Files
    const manifestPath = path.join(resolvedRoot, '00_SYSTEM', 'VAULT_MANIFEST.json');
    const homePath = path.join(resolvedRoot, '00_SYSTEM', 'HOME.md');
    const rulesPath = path.join(resolvedRoot, '00_SYSTEM', 'VAULT_RULES.md');

    let isManifestValid = false;
    if (!fs.existsSync(manifestPath)) {
      errors.push('Missing system manifest file: "00_SYSTEM/VAULT_MANIFEST.json"');
    } else {
      try {
        validateSymlinkSafety(resolvedRoot, manifestPath);
        const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
        const manifestData = JSON.parse(manifestRaw);
        const parseResult = VaultManifestSchema.safeParse(manifestData);

        if (!parseResult.success) {
          errors.push(`Invalid manifest schema in "00_SYSTEM/VAULT_MANIFEST.json": ${parseResult.error.message}`);
        } else {
          checkedFilesCount++;
          isManifestValid = true;
        }
      } catch (err) {
        errors.push(`Failed to read/parse manifest "00_SYSTEM/VAULT_MANIFEST.json": ${(err as Error).message}`);
      }
    }

    if (!fs.existsSync(homePath)) {
      errors.push('Missing system home file: "00_SYSTEM/HOME.md"');
    } else {
      checkedFilesCount++;
    }

    if (!fs.existsSync(rulesPath)) {
      errors.push('Missing system rules file: "00_SYSTEM/VAULT_RULES.md"');
    } else {
      checkedFilesCount++;
    }

    systemFilesValid = isManifestValid && fs.existsSync(homePath) && fs.existsSync(rulesPath);

    // 3. Scan Markdown Files for Frontmatter Validation & Symlink Security
    try {
      const scanDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          try {
            validateSymlinkSafety(resolvedRoot, fullPath);

            if (entry.isDirectory()) {
              if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                scanDir(fullPath);
              }
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
              checkedFilesCount++;
              const content = fs.readFileSync(fullPath, 'utf8');
              const frontmatter = parseYamlFrontmatter(content);

              if (frontmatter) {
                const parseResult = FrontmatterSchema.safeParse(frontmatter);
                if (!parseResult.success) {
                  warnings.push(
                    `Invalid frontmatter in "${path.relative(resolvedRoot, fullPath)}": ${parseResult.error.issues[0]?.message || 'Schema mismatch'}`
                  );
                }
              } else if (!fullPath.includes('00_SYSTEM')) {
                warnings.push(`Markdown file missing YAML frontmatter: "${path.relative(resolvedRoot, fullPath)}"`);
              }
            }
          } catch (err) {
            if (err instanceof SecurityPathError) {
              errors.push(`Security Violation in file scan: ${(err as Error).message}`);
            }
          }
        }
      };

      scanDir(resolvedRoot);
    } catch (err) {
      errors.push(`Failed during vault directory scan: ${(err as Error).message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      checkedFoldersCount,
      checkedFilesCount,
      systemFilesValid,
    };
  }
}
