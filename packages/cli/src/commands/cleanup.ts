import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../paths.ts';

/**
 * `sw2d cleanup` - Remove build artifacts and generated files.
 *
 * Cleans up dist/, pack/, and node_modules/ directories from generated games,
 * demos, and proofs. Useful for reclaiming disk space or preparing for a fresh
 * build.
 *
 * Never touches source files, content, or configuration.
 */
export async function run(args: readonly string[]): Promise<number> {
  const dryRun = args.includes('--dry-run');
  const targets = ['games', 'demos', 'proofs'];
  const cleanDirs = ['dist', 'pack', 'node_modules'];

  console.log('SW2D Cleanup');
  console.log('============');
  console.log('');
  if (dryRun) {
    console.log('(dry run - no files will be deleted)');
    console.log('');
  }

  let totalSize = 0;
  let totalDirs = 0;

  for (const target of targets) {
    const targetDir = join(REPO_ROOT, target);
    if (!existsSync(targetDir)) continue;

    const entries = readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const projectDir = join(targetDir, entry.name);

      for (const cleanDir of cleanDirs) {
        const cleanPath = join(projectDir, cleanDir);
        if (!existsSync(cleanPath)) continue;

        try {
          const size = getDirectorySize(cleanPath);
          totalSize += size;
          totalDirs++;

          if (dryRun) {
            console.log(`  Would remove: ${target}/${entry.name}/${cleanDir} (${formatSize(size)})`);
          } else {
            rmSync(cleanPath, { recursive: true, force: true });
            console.log(`  Removed: ${target}/${entry.name}/${cleanDir} (${formatSize(size)})`);
          }
        } catch (error) {
          console.error(`  Failed to remove ${target}/${entry.name}/${cleanDir}: ${error}`);
        }
      }
    }
  }

  console.log('');
  console.log(`Total: ${totalDirs} directories, ${formatSize(totalSize)}`);
  if (dryRun) {
    console.log('');
    console.log('Run without --dry-run to actually delete these files.');
  }

  return 0;
}

function getDirectorySize(dir: string): number {
  let size = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        size += getDirectorySize(fullPath);
      } else {
        try {
          size += statSync(fullPath).size;
        } catch {
          // Skip inaccessible files
        }
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return size;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
