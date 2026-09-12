import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { VaultManifestSchema, FrontmatterSchema } from '@limen-vault/vault-schema';
import { SafeDir } from './safe-fs.js';

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
  pageCount?: number;
  sourceCount?: number;
  proposalCount?: number;
  state?: string;
  validatedManifest?: Record<string, unknown> | null;
}

export interface FrontmatterParseResult {
  data: Record<string, unknown> | null;
  syntaxError?: string;
}

/**
 * Parses YAML frontmatter blocks from a Markdown string using js-yaml.
 */
export function parseYamlFrontmatter(content: string): FrontmatterParseResult | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return /^---(?:\r?\n|$)/.test(content) ? { data: null, syntaxError: 'Unclosed YAML frontmatter' } : null;

  const yamlBlock = match[1];
  try {
    const parsed = yaml.load(yamlBlock, { schema: yaml.JSON_SCHEMA });
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown> };
    }
    return { data: null, syntaxError: 'YAML frontmatter is not a key-value object' };
  } catch (err) {
    return { data: null, syntaxError: (err as Error).message };
  }
}

export class VaultValidator {
  static validateVault(vaultRoot: string): VaultValidationResult {
    const result: VaultValidationResult = { isValid: false, errors: [], warnings: [], checkedFoldersCount: 0, checkedFilesCount: 0, systemFilesValid: false, validatedManifest: null, pageCount: 0, sourceCount: 0, proposalCount: 0, state: 'INVALID' };
    if (!vaultRoot.trim()) { result.state = 'NO_VAULT'; result.errors.push('No vault path specified.'); return result; }
    let root: SafeDir | undefined;
    try { root = SafeDir.open(vaultRoot); root.names(); }
    catch (e) { root?.close(); result.state = 'NOT_ACCESSIBLE'; result.errors.push(`Vault path does not exist or is not accessible: ${(e as Error).message}`); return result; }
    let missing = false;
    let invalid = false;
    const system = new Map<string, string>();
    const walk = (dir: SafeDir, relative: string, depth: number) => {
      if (depth > 64) throw new Error('Directory depth exceeds 64');
      for (const name of dir.names()) {
        const rel = relative ? relative + '/' + name : name;
        let fd: number | undefined;
        try {
          fd = dir.open(name);
          const stat = fs.fstatSync(fd);
          if (stat.isDirectory()) {
            if (rel !== '00_SYSTEM/SNAPSHOTS' && !name.startsWith('.') && name !== 'node_modules') {
              const child = new SafeDir(fd); fd = undefined;
              try { walk(child, rel, depth + 1); } finally { child.close(); }
            }
          } else if (stat.isFile()) {
            result.checkedFilesCount++;
            if (rel === '00_SYSTEM/VAULT_MANIFEST.json' || name.endsWith('.md')) {
              const content = fs.readFileSync(fd, 'utf8');
              if (rel.startsWith('00_SYSTEM/')) system.set(rel, content);
              if (name.endsWith('.md')) {
                result.pageCount!++;
                if (rel.startsWith('20_RAW_SOURCES/')) result.sourceCount!++;
                if (rel.startsWith('90_PROPOSALS/')) result.proposalCount!++;
                const parsed = parseYamlFrontmatter(content);
                if (parsed?.syntaxError) throw new Error('Invalid YAML syntax: ' + parsed.syntaxError);
                if (parsed?.data) {
                  const checked = FrontmatterSchema.safeParse(parsed.data);
                  if (!checked.success) throw new Error('Invalid frontmatter: ' + checked.error.message);
                } else if (!rel.startsWith('00_SYSTEM/')) result.warnings.push(`Markdown file missing YAML frontmatter: "${rel}"`);
              }
            }
          } else throw new Error('Not a regular file or directory');
        } catch (e) { invalid = true; result.errors.push(`${rel}: ${(e as Error).message}`); }
        finally { if (fd !== undefined) fs.closeSync(fd); }
      }
    };
    try {
      for (const folder of REQUIRED_VAULT_FOLDERS) {
        try { const dir = root.dir(folder); try { dir.names(); result.checkedFoldersCount++; } finally { dir.close(); } }
        catch (e) { if ((e as {errno?:number}).errno === 2) missing = true; else invalid = true; result.errors.push(`Missing or inaccessible required vault folder: "${folder}": ${(e as Error).message}`); }
      }
      try { walk(root, '', 0); } catch (e) { invalid = true; result.errors.push((e as Error).message); }
      for (const name of ['HOME.md', 'VAULT_RULES.md', 'VAULT_MANIFEST.json']) {
        if (!system.has('00_SYSTEM/' + name)) {
          missing = true;
          result.errors.push(`Required system path is missing, unreadable or not a regular file: "${name}"`);
        }
      }
      const raw = system.get('00_SYSTEM/VAULT_MANIFEST.json');
      if (raw !== undefined) {
        try { result.validatedManifest = VaultManifestSchema.parse(JSON.parse(raw)); }
        catch (e) { invalid = true; result.errors.push('Invalid manifest: ' + (e as Error).message); }
      }
      result.systemFilesValid = !!result.validatedManifest && system.has('00_SYSTEM/HOME.md') && system.has('00_SYSTEM/VAULT_RULES.md');
      result.isValid = result.errors.length === 0;
      result.state = result.isValid ? 'READY' : invalid ? 'INVALID' : missing ? 'INCOMPLETE' : 'INVALID';
      if (!result.isValid) result.validatedManifest = null;
      return result;
    } finally { root.close(); }
  }
}
