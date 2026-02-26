/* eslint-disable no-console */
// Run with: tsx scripts/build-contracts.ts [--force]
// This script copies artifacts from @defi-wonderland/aztec-standards and compiles local contracts

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Output directory for artifacts (TypeScript wrappers)
const ARTIFACTS_OUTPUT_DIR = 'src/artifacts';
// Output directory for target JSONs (relative to src/, used by wrappers)
const TARGET_OUTPUT_DIR = 'src/target';
// Local contracts directory
const LOCAL_CONTRACTS_DIR = 'contracts';
// NPM package path
const NPM_PACKAGE_PATH = 'node_modules/@defi-wonderland/aztec-standards';

/**
 * Try to run a command
 */
function tryRun(cmd: string, opts: Record<string, unknown> = {}): boolean {
  try {
    const res = spawnSync(cmd, { stdio: 'inherit', shell: true, ...opts });
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists
 */
function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Copy files with optional filter
 */
function copyFiles(
  sourceDir: string,
  targetDir: string,
  forceOverwrite = false,
  filter?: (file: string) => boolean
): number {
  if (!fs.existsSync(sourceDir)) {
    console.log(`⚠️ Source directory ${sourceDir} does not exist`);
    return 0;
  }

  ensureDir(targetDir);
  const files = fs.readdirSync(sourceDir);
  let copiedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    // Apply filter if provided
    if (filter && !filter(file)) {
      continue;
    }

    const srcPath = path.join(sourceDir, file);
    const dstPath = path.join(targetDir, file);

    if (fs.existsSync(dstPath) && !forceOverwrite) {
      console.log(`   ⏭️ Skipping ${file} (already exists)`);
      skippedCount++;
      continue;
    }

    // Overwrite or copy new
    if (fs.statSync(srcPath).isDirectory()) {
      fs.cpSync(srcPath, dstPath, { recursive: true, force: true });
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
    console.log(`   ✅ Copied ${file}`);
    copiedCount++;
  }

  console.log(`   📊 Copied ${copiedCount} items, skipped ${skippedCount} existing items`);
  return copiedCount;
}

/**
 * Strip the __aztec_nr_internals__ prefix from function names in compiled artifact JSONs.
 * Replicates the Docker-only strip_aztec_nr_prefix.sh script.
 */
function stripAztecNrPrefix(targetDir: string): void {
  if (!fs.existsSync(targetDir)) return;

  const PREFIX = '__aztec_nr_internals__';
  const jsonFiles = fs
    .readdirSync(targetDir)
    .filter((f) => f.endsWith('.json'));

  for (const file of jsonFiles) {
    const filePath = path.join(targetDir, file);
    const artifact = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!Array.isArray(artifact.functions)) continue;

    let modified = false;
    for (const fn of artifact.functions) {
      if (typeof fn.name === 'string' && fn.name.startsWith(PREFIX)) {
        fn.name = fn.name.slice(PREFIX.length);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(artifact));
      console.log(`   🔧 Stripped __aztec_nr_internals__ prefix from ${file}`);
    }
  }
}

/**
 * Copy aztec-standards artifacts from node_modules
 */
function copyAztecStandardsArtifacts(projectRoot: string, forceOverwrite: boolean): void {
  console.log('\n📦 Copying aztec-standards artifacts from node_modules...');

  const npmPackagePath = path.join(projectRoot, NPM_PACKAGE_PATH);

  if (!fs.existsSync(npmPackagePath)) {
    console.error(`❌ Package @defi-wonderland/aztec-standards not found at ${npmPackagePath}`);
    console.error('   Run: yarn add @defi-wonderland/aztec-standards');
    throw new Error('Missing aztec-standards package');
  }

  // Filter for Dripper and Token contracts only
  const contractFilter = (file: string) =>
    (file.includes('Dripper') || file.includes('Token')) && !file.endsWith('.bak');

  // Copy TypeScript wrappers from artifacts/
  const artifactsDir = path.join(projectRoot, ARTIFACTS_OUTPUT_DIR);

  console.log(`\n   📁 Copying TypeScript wrappers to ${ARTIFACTS_OUTPUT_DIR}/`);
  copyFiles(
    path.join(npmPackagePath, 'artifacts'),
    artifactsDir,
    forceOverwrite,
    contractFilter
  );

  // Copy JSON artifacts from target/
  const targetDir = path.join(projectRoot, TARGET_OUTPUT_DIR);
  console.log(`\n   📁 Copying JSON artifacts to ${TARGET_OUTPUT_DIR}/`);
  copyFiles(
    path.join(npmPackagePath, 'target'),
    targetDir,
    forceOverwrite,
    contractFilter
  );

  console.log('\n✅ aztec-standards artifacts copied successfully');
}

/**
 * Compile local contracts using workspace Nargo.toml at root level
 */
function compileLocalContracts(projectRoot: string, forceOverwrite: boolean): boolean {
  const workspaceNargo = path.join(projectRoot, 'Nargo.toml');

  if (!fs.existsSync(workspaceNargo)) {
    console.error(`❌ No workspace Nargo.toml found at ${projectRoot}`);
    return false;
  }

  console.log('\n🔨 Compiling contracts from workspace...');

  // Remove stale v3 artifacts from node_modules that can crash the v4 barretenberg post-processor
  const staleTargetDir = path.join(projectRoot, NPM_PACKAGE_PATH, 'target');
  if (fs.existsSync(staleTargetDir)) {
    fs.rmSync(staleTargetDir, { recursive: true, force: true });
    console.log('   🗑️ Removed stale artifacts from node_modules aztec-standards');
  }

  // Compile all contracts from workspace root
  if (!tryRun(`cd "${projectRoot}" && aztec compile`)) {
    console.error('   ❌ Failed to compile contracts');
    return false;
  }

  const compiledTarget = path.join(projectRoot, 'target');
  const hasArtifacts =
    fs.existsSync(compiledTarget) &&
    fs.readdirSync(compiledTarget).some((f) => f.endsWith('.json'));
  if (!hasArtifacts) {
    console.error('   ❌ Failed to compile contracts — no artifacts generated');
    return false;
  }

  console.log('   ✅ Contracts compiled successfully');

  // Postprocess: transpile public bytecode (ACIR → AVM) and generate VKs (required by aztec codegen)
  console.log('   🔧 Postprocessing contracts (transpile + VK generation)...');
  const bbCmd = [
    `cd "${projectRoot}"`,
    `&& for f in target/*.json; do flags="$flags -i $f"; done;`,
    'bb aztec_process $flags',
  ].join(' ');
  if (!tryRun(bbCmd)) {
    console.error('   ❌ Failed to postprocess contracts');
    return false;
  }
  console.log('   ✅ Contracts postprocessed successfully');

  // Strip __aztec_nr_internals__ prefix from function names
  stripAztecNrPrefix(compiledTarget);

  // Copy target JSONs to src/target for codegen
  const targetOutputDir = path.join(projectRoot, TARGET_OUTPUT_DIR);
  ensureDir(targetOutputDir);
  copyFiles(compiledTarget, targetOutputDir, forceOverwrite, (file) =>
    file.endsWith('.json') && !file.endsWith('.bak')
  );

  // Generate TypeScript wrappers from src/target to src/artifacts
  console.log('   📝 Generating TypeScript bindings...');
  if (!tryRun(`cd "${projectRoot}" && aztec codegen ${TARGET_OUTPUT_DIR} --outdir ${ARTIFACTS_OUTPUT_DIR} -f`)) {
    console.error('   ❌ Codegen failed');
    return false;
  }

  return true;
}

async function main() {
  const forceOverwrite = process.argv.includes('--force');
  const projectRoot = process.cwd().concat('/../..');

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           BUILD CONTRACTS                                      ║
╚════════════════════════════════════════════════════════════════╝
`);

  try {
    // 1) Copy aztec-standards artifacts from node_modules
    console.log('='.repeat(60));
    console.log('📦 Step 1: Copy aztec-standards artifacts (skipped)');
    console.log('='.repeat(60));
    // copyAztecStandardsArtifacts(projectRoot, forceOverwrite);

    // 2) Compile local contracts (e.g., ECDSA account contract)
    console.log('\n' + '='.repeat(60));
    console.log('📦 Step 2: Compile local contracts');
    console.log('='.repeat(60));

    if (!compileLocalContracts(projectRoot, forceOverwrite)) {
      console.warn('\n⚠️ Some local contracts failed to compile');
    } else {
      console.log('\n✅ All local contracts compiled successfully');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Build complete!');
    console.log('='.repeat(60) + '\n');
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('\n❌ Build script failed:', errorMessage);
    process.exit(1);
  }
}

main();

