/**
 * Writes one backup per format of the plan since v2.20, each by the code of
 * its own commit, into src/lib/fixtures/backups/ - the files
 * src/lib/backupVersions.test.ts opens, and the reason they can be trusted:
 * no file there was written by this version pretending to be an older one.
 *
 *   node scripts/backup-fixtures.mjs           every commit below
 *   node scripts/backup-fixtures.mjs c921fdf   one of them
 *
 * A worktree is checked out at each commit in turn, in the system's
 * temporary directory, with this repo's node_modules joined into it. The
 * writer (scripts/backup-fixtures.writer.ts) goes in as a test and runs
 * under that commit's own code: the sample day as that commit seeded it,
 * and a generic overlay of every field that commit's guard knew. A commit
 * whose file is byte for byte the one before it keeps no file of its own.
 *
 * When the plan's shape changes: add the commit to COMMITS, teach the
 * writer's overlay the new field behind `since('<commit>')`, run this for
 * that commit, and the test holds the new file from then on.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, statSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'lib', 'fixtures', 'backups')
const WT = join(tmpdir(), 'dienius-backup-fixtures')

/** Every commit since v2.20 that changed the plan's shape - the guard, the types, storage, North - with its version. */
const COMMITS = [
  ['e0a5b46', 'v2.20'], ['37ea53f', 'v2.20'], ['c8f1c2c', 'v2.22'], ['753d75b', 'v2.22'], ['9f4b45f', 'v2.22'],
  ['5417e30', 'v2.24'], ['c007815', 'v2.24'], ['09836b8', 'v2.27'], ['4e02c1c', 'v2.27'], ['64bb6ec', 'v2.28'],
  ['20029a1', 'v2.28'], ['a88173b', 'v2.29'], ['fda1cb8', 'v2.29'], ['d13a192', 'v2.30'], ['8a13a11', 'v2.30'],
  ['41d4e3e', 'v2.31'], ['a4e1eb0', 'v2.31'], ['44a6638', 'v2.32'], ['2c5f9c1', 'v2.35'], ['d3e4411', 'v2.36'],
  ['db244a8', 'v2.37'], ['039e069', 'v2.39'], ['c921fdf', 'v2.40'], ['9ebe280', 'v2.41'], ['9bb7835', 'v2.43'],
]

/** @param {string[]} args @param {string} cwd */
const git = (args, cwd = ROOT) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString()

mkdirSync(OUT, { recursive: true })
if (!existsSync(WT)) {
  git(['worktree', 'add', '--detach', WT, COMMITS[0][0]])
  symlinkSync(join(ROOT, 'node_modules'), join(WT, 'node_modules'), 'junction')
}

const only = process.argv.slice(2)
/** @type {string | undefined} */
let previous
for (const [commit, version] of COMMITS) {
  const out = join(OUT, `backup-${version}-${commit}.json`)
  if (only.length > 0 && !only.includes(commit)) {
    if (existsSync(out)) previous = readFileSync(out, 'utf8')
    continue
  }
  git(['checkout', '--detach', '-f', commit], WT)
  const writer = join(WT, 'src', 'lib', 'zz-backup-fixture.test.ts')
  copyFileSync(join(ROOT, 'scripts', 'backup-fixtures.writer.ts'), writer)
  try {
    execFileSync(process.execPath, [join(WT, 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'src/lib/zz-backup-fixture.test.ts'], {
      cwd: WT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FIXTURE_OUT: out, FIXTURE_COMMIT: commit, FIXTURE_ORDER: COMMITS.map(([c]) => c).join(',') },
    })
  } catch (error) {
    const failed = /** @type {{ stdout?: Buffer, stderr?: Buffer }} */ (error)
    console.log(`${version} ${commit}: FAILED\n${String(failed.stdout ?? '').slice(-1500)}${String(failed.stderr ?? '').slice(-800)}`)
    process.exitCode = 1
    continue
  } finally {
    unlinkSync(writer)
  }
  const text = readFileSync(out, 'utf8')
  if (text === previous) {
    unlinkSync(out)
    console.log(`${version} ${commit}: the same bytes as the commit before it, no file`)
    continue
  }
  previous = text
  console.log(`${version} ${commit}: ${statSync(out).size} bytes`)
}

// The junction goes first and on its own, so removing the worktree cannot
// reach through it into this repo's node_modules.
rmdirSync(join(WT, 'node_modules'))
git(['worktree', 'remove', '--force', WT])
console.log(`${readdirSync(OUT).length} files in ${OUT}`)
