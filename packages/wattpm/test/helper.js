import { createDirectory, safeRemove } from '@platformatic/foundation'
import { execa } from 'execa'
import { on } from 'node:events'
import { cp, mkdir, writeFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import split2 from 'split2'
import { setFixturesDir, temporaryFolder } from '../../basic/test/helper.js'

let tmpCount = 0
export const cliPath = fileURLToPath(new URL('../bin/cli.js', import.meta.url))
export const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url))
setFixturesDir(fixturesDir)

export async function createTemporaryDirectory (t, prefix) {
  const directory = join(tmpdir(), `test-wattpm-${prefix}-${process.pid}-${tmpCount++}`)

  t.after(async () => {
    await safeRemove(directory)
  })

  await mkdir(directory)
  return directory
}

export async function changeWorkingDirectory (t, directory) {
  const originalDirectory = process.cwd()

  t.after(() => {
    process.chdir(originalDirectory)
  })

  process.chdir(directory)
}

export async function prepareGitRepository (t, root) {
  const repo = resolve(temporaryFolder, 'repo-' + Date.now())
  await createDirectory(repo)

  await cp(resolve(fixturesDir, 'external-repo'), repo, { recursive: true })

  await execa('git', ['init', '-b', 'main'], { cwd: repo })

  if (process.env.CI) {
    await execa('git', ['config', 'user.name', 'CI'], { cwd: repo })
    await execa('git', ['config', 'user.email', 'ci@platformatic.dev'], { cwd: repo })
  }

  await writeFile(resolve(repo, 'branch'), 'main', 'utf-8')
  await execa('git', ['add', '-A'], { cwd: repo })
  await execa('git', ['commit', '-n', '-m', 'Initial commit.'], { cwd: repo })

  await execa('git', ['checkout', '-b', 'another'], { cwd: repo })

  await writeFile(resolve(repo, 'branch'), 'another', 'utf-8')
  await execa('git', ['add', '-A'], { cwd: repo })
  await execa('git', ['commit', '-n', '-m', 'Different branch commit.'], { cwd: repo })

  await execa('git', ['checkout', 'main'], { cwd: repo })

  t.after(() => safeRemove(repo))

  const url = pathToFileURL(repo)
  return url.toString()
}

export async function waitForStart (startProcess, application = 'main') {
  let url
  const raw = []
  const objects = []

  if (startProcess.stderr) {
    startProcess.stderr.pipe(split2()).on('data', (log) => {
      if (process.env.PLT_TESTS_DEBUG === 'true') {
        process._rawDebug(log.toString())
      }

      raw.push(log)
    })
  }

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    if (process.env.PLT_TESTS_DEBUG === 'true') {
      process._rawDebug(log.toString())
    }

    raw.push(log)

    let parsed
    try {
      parsed = JSON.parse(log.toString())
      objects.push(parsed)
    } catch (e) {
      continue
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (\S+) for worker \d+ of the application "([^"]+)"/)
    if (mo?.[2] === application) {
      url = mo[1]
      break
    }
  }

  return { url, raw, parsed: objects }
}

/*
  Spawn a runtime and wait for it to announce a URL, retrying the whole boot if it exits or hangs
  before doing so. A dev/start boot can fail transiently on a loaded runner -- a worker races its
  port, or the process exits before printing the listening line -- which surfaced as an intermittent
  `url` of undefined on the slowest matrix combos. `spawn` is called fresh for each attempt (so the
  caller decides the command and directory); every spawned process is registered for cleanup, and
  the last boot's output is included when all attempts are exhausted so a real failure is diagnosable
  rather than a bare assertion on an undefined URL.
*/
export async function startAndWaitForUrl (t, spawn, application = 'main', { attempts = 3, timeoutMs = 90000 } = {}) {
  let lastRaw = []

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const startProcess = spawn()
    t.after(() => {
      startProcess.kill('SIGINT')
      return startProcess.catch(() => {})
    })

    let result
    try {
      result = await Promise.race([
        waitForStart(startProcess, application),
        sleep(timeoutMs).then(() => ({ url: undefined, raw: [Buffer.from('<timed out waiting for start>')] }))
      ])
    } catch (error) {
      result = { url: undefined, raw: [Buffer.from(String(error?.stack ?? error))] }
    }

    if (result.url) {
      return { startProcess, ...result }
    }

    lastRaw = result.raw ?? []
    startProcess.kill('SIGINT')
    await startProcess.catch(() => {})
  }

  throw new Error(
    `Runtime did not announce a URL for application "${application}" after ${attempts} attempts. ` +
      `Last boot output:\n${lastRaw.map(line => line.toString()).join('\n')}`
  )
}

export function executeCommand (cmd, ...args) {
  const options = typeof args.at(-1) === 'object' ? args.pop() : {}
  const env = options.env
  delete options.env
  return execa(cmd, args, { env: { NO_COLOR: 'true', ...env }, ...options })
}

export function wattpm (...args) {
  return executeCommand(process.argv[0], cliPath, ...args)
}

/*
  A wattpm invocation from a throwaway directory that no runtime lives in. getMatchingRuntime falls
  back to "any runtime whose cwd is the current one" when the id it was given matches none -- which
  is how `inject <app>` autodetects the runtime -- and every runtime a test starts reports this
  package's directory as its cwd, because the helper spawns them there without changing it. A
  "runtime not found" test run from that shared directory therefore picks up a sibling runtime that
  has not finished shutting down instead of finding nothing; running from its own directory leaves
  the fallback nothing to match.
*/
export async function wattpmNoRuntime (t, ...args) {
  const directory = await createTemporaryDirectory(t, 'no-runtime')
  const options = typeof args.at(-1) === 'object' ? args.pop() : {}
  return executeCommand(process.argv[0], cliPath, ...args, { ...options, cwd: directory })
}

/*
  `dev` and `start` share stdout between two writers: the runtime logs JSON records there, and the
  CLI logs human-readable lines — the boot-scope announcement, the standalone warning, `logger.done`.
  A test looking for a runtime record has to step over the CLI's, which were never JSON to begin
  with, so this returns null instead of throwing on them.
*/
export function parseRuntimeLog (log) {
  try {
    return JSON.parse(log.toString())
  } catch {
    return null
  }
}
