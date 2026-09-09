import { createDirectory, safeRemove } from '@platformatic/foundation'
import { evaluateConfigurationFile } from '@platformatic/foundation/lib/v4/index.js'
import { execa } from 'execa'
import { on } from 'node:events'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import split2 from 'split2'
import { setFixturesDir, temporaryFolder } from '../../basic/test/helper.js'
import { appendEnvVariable } from '../lib/commands/external.js'

let tmpCount = 0
export const wattCliPath = fileURLToPath(new URL('../../wattpm/bin/cli.js', import.meta.url))
export const wattUtilsCliPath = fileURLToPath(new URL('../bin/cli.js', import.meta.url))
export const fixturesDir = fileURLToPath(new URL('../../wattpm/test/fixtures', import.meta.url))
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
  await appendEnvVariable(resolve(root, '.env'), 'PLT_GIT_REPO_URL', url)

  return url.toString()
}

export async function waitForStart (startProcess) {
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

    const mo = parsed.msg?.match(/Platformatic is now listening at (\S+) for worker \d+ of the application "[^"]+"/)
    if (mo) {
      url = mo[1]
      break
    }
  }

  return { url, raw, parsed: objects }
}

export function executeCommand (cmd, ...args) {
  const options = typeof args.at(-1) === 'object' ? args.pop() : {}

  return execa(cmd, args, { env: { NO_COLOR: 'true' }, ...options })
}

export function wattpm (...args) {
  return executeCommand(process.argv[0], wattCliPath, ...args)
}

export function wattpmUtils (...args) {
  return executeCommand(process.argv[0], wattUtilsCliPath, ...args)
}

/*
  A v4 configuration is a module whose values are expressions, so reading one means evaluating it --
  against the project's own environment, which is where those expressions get their values.
*/
export async function readConfiguration (path, role = 'root') {
  const root = dirname(path)
  const env = { ...process.env }

  try {
    for (const line of (await readFile(join(root, '.env'), 'utf-8')).split(/\r?\n/)) {
      const separator = line.indexOf('=')

      if (separator > 0 && !line.startsWith('#')) {
        env[line.slice(0, separator)] = line.slice(separator + 1)
      }
    }
  } catch {
    // A project without one simply has nothing to layer.
  }

  const { config } = await evaluateConfigurationFile({ path, env, command: 'start', production: false, role })

  return config
}
