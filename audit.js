#!/usr/bin/env node
// audit.js — run before every EAS build: node audit.js
// Uses the TypeScript compiler (tsc) already on your system to parse every
// .ts/.tsx file and catch the exact errors Metro bundler would throw.
// Zero dependencies beyond Node + tsc being in PATH.

const { execSync, spawnSync } = require('child_process');
const { readdirSync, statSync, readFileSync } = require('fs');
const path = require('path');

const ROOT = __dirname;
const RESET  = '\x1b[0m';
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';

// ── Collect all .ts / .tsx files ───────────────────────────────────────────
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.expo', '.git', 'dist'].includes(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}
const files = walk(ROOT);
console.log(`\n${BOLD}Bord Pre-Build Audit${RESET}  (${files.length} files)\n`);

// ── Pass 1: tsc syntax check (TS1xxx errors = Metro crash) ─────────────────
console.log(`${BOLD}Pass 1:${RESET} TypeScript syntax (tsc)`);
let syntaxErrors = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const result = spawnSync('tsc', [
    '--noEmit', '--skipLibCheck', '--allowJs', '--noResolve',
    '--target', 'ES2020', '--module', 'ESNext', '--moduleResolution', 'node',
    '--jsx', 'react-native', '--allowSyntheticDefaultImports', '--esModuleInterop',
    file
  ], { encoding: 'utf8' });

  const syntax = (result.stdout + result.stderr)
    .split('\n')
    .filter(l => /error TS1\d\d\d/.test(l));

  if (syntax.length) {
    console.log(`  ${RED}❌ ${rel}${RESET}`);
    syntax.slice(0, 3).forEach(l => console.log(`     ${l.trim()}`));
    syntaxErrors++;
  }
}
console.log(syntaxErrors === 0 
  ? `  ${GREEN}✅ Clean${RESET}` 
  : `  ${RED}${syntaxErrors} file(s) with syntax errors${RESET}`);

// ── Pass 2: Byte-level checks ──────────────────────────────────────────────
console.log(`\n${BOLD}Pass 2:${RESET} Byte-level (control chars, curly quotes)`);
const CURLY = ['\u2018','\u2019','\u201c','\u201d'];
let byteErrors = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(line)) {
      console.log(`  ${RED}❌ CTRL_CHAR${RESET} ${rel}:${i+1}`);
      byteErrors++;
    }
    for (const ch of CURLY) {
      if (line.includes(ch)) {
        console.log(`  ${RED}❌ CURLY_QUOTE ${JSON.stringify(ch)}${RESET} ${rel}:${i+1}`);
        byteErrors++;
      }
    }
  });
}
console.log(byteErrors === 0
  ? `  ${GREEN}✅ Clean${RESET}`
  : `  ${RED}${byteErrors} byte-level issue(s)${RESET}`);

// ── Pass 3: JSX-specific patterns ─────────────────────────────────────────
console.log(`\n${BOLD}Pass 3:${RESET} JSX patterns (brace syntax, apostrophes)`);
let jsxErrors = 0;

for (const file of files) {
  if (!file.endsWith('.tsx')) continue;
  const rel = path.relative(ROOT, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const n = i + 1;
    // style={ word: — single brace inline object
    if (/style=\{[^{"'\[\s]/.test(line) && /style=\{\s*\w+\s*:/.test(line) && !/style=\{\{/.test(line)) {
      console.log(`  ${RED}❌ SINGLE_BRACE_STYLE${RESET} ${rel}:${n}: ${line.trim().slice(0,70)}`);
      jsxErrors++;
    }
    // {{styles.x}} double-brace variable
    if (/\{\{(styles|colors|spacing|radius)\./.test(line)) {
      console.log(`  ${RED}❌ DOUBLE_BRACE_VAR${RESET} ${rel}:${n}: ${line.trim().slice(0,70)}`);
      jsxErrors++;
    }
    // Apostrophe in JSX text node
    const texts = line.match(/>([^<>{}]+)</g) || [];
    for (const t of texts) {
      if (/\b\w+'\w/.test(t)) {
        console.log(`  ${RED}❌ APOSTROPHE_JSX${RESET} ${rel}:${n}: ${line.trim().slice(0,70)}`);
        jsxErrors++;
      }
    }
  });
}
console.log(jsxErrors === 0
  ? `  ${GREEN}✅ Clean${RESET}`
  : `  ${RED}${jsxErrors} JSX issue(s)${RESET}`);

// ── Pass 4: supabase.ts function body check ────────────────────────────────
console.log(`\n${BOLD}Pass 4:${RESET} Function declarations (no orphaned bodies)`);
let fnErrors = 0;
const sbPath = path.join(ROOT, 'lib/supabase.ts');
const sbLines = readFileSync(sbPath, 'utf8').split('\n');
sbLines.forEach((line, i) => {
  const s = line.trim();
  if (/^\([a-zA-Z_]\w*\s*:/.test(s) && s.endsWith('{')) {
    const ctx = sbLines.slice(Math.max(0, i-3), i).join(' ');
    if (!/function/.test(ctx)) {
      console.log(`  ${RED}❌ ORPHANED_BODY${RESET} lib/supabase.ts:${i+1}: ${s.slice(0,70)}`);
      fnErrors++;
    }
  }
});
console.log(fnErrors === 0
  ? `  ${GREEN}✅ Clean${RESET}`
  : `  ${RED}${fnErrors} function issue(s)${RESET}`);

// ── Summary ────────────────────────────────────────────────────────────────
const total = syntaxErrors + byteErrors + jsxErrors + fnErrors;
console.log(`\n${'━'.repeat(50)}`);
if (total === 0) {
  console.log(`${GREEN}${BOLD}✅  ALL PASSES CLEAN — safe to run EAS build${RESET}`);
} else {
  console.log(`${RED}${BOLD}❌  ${total} issue(s) found — fix before building${RESET}`);
  process.exit(1);
}
console.log('━'.repeat(50) + '\n');
