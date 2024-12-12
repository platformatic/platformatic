import { createDirectory, safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import { on } from 'node:events'
import { cp, mkdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import split2 from 'split2'
import { setFixturesDir, temporaryFolder } from '../../basic/test/helper.js'
import { appendEnvVariable } from '../lib/commands/external.js'

let tmpCount = 0
export const cliPath = fileURLToPath(new URL('../bin/wattpm.js', import.meta.url))
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

export async function prepareGitRepository (t, root) {
  const repo = resolve(temporaryFolder, 'repo-' + Date.now())
  await createDirectory(repo)

  await cp(resolve(fixturesDir, 'external-repo'), repo, { recursive: true })

  await execa('git', ['init', '-b', 'main'], { cwd: repo })

  if (process.env.CI) {
    await execa('git', ['config', 'user.name', 'CI'], { cwd: repo })
    await execa('git', ['config', 'user.email', 'ci@platformatic.dev'], { cwd: repo })
  }

  await writeFile(resolve(repo, 'branch'), 'main', 'utf8')
  await execa('git', ['add', '-A'], { cwd: repo })
  await execa('git', ['commit', '-n', '-m', 'Initial commit.'], { cwd: repo })

  await execa('git', ['checkout', '-b', 'another'], { cwd: repo })

  await writeFile(resolve(repo, 'branch'), 'another', 'utf8')
  await execa('git', ['add', '-A'], { cwd: repo })
  await execa('git', ['commit', '-n', '-m', 'Different branch commit.'], { cwd: repo })

  await execa('git', ['checkout', 'main'], { cwd: repo })

  t.after(() => safeRemove(repo))

  const url = pathToFileURL(repo)
  await appendEnvVariable(resolve(root, '.env'), 'PLT_GIT_REPO_URL', url)

  return url.toString()
}

export async function isDirectory (path) {
  const statObject = await stat(path)

  return statObject.isDirectory()
}

export async function waitForStart (startProcess) {
  let url

  startProcess.stderr.pipe(startProcess.stdout)
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    if (process.env.PLT_TESTS_VERBOSE === 'true') {
      process._rawDebug(log.toString())
    }

    let parsed
    try {
      parsed = JSON.parse(log.toString())
    } catch (e) {
      continue
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (.+)/)
    if (mo) {
      url = mo[1]
      break
    }
  }

  return url
}

export function executeCommand (cmd, ...args) {
  const options = typeof args.at(-1) === 'object' ? args.pop() : {}

  return execa(cmd, args, { env: { NO_COLOR: 'true' }, ...options })
}

export function wattpm (...args) {
  return executeCommand('node', cliPath, ...args)
}
