import { safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import { on } from 'node:events'
import { mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import split2 from 'split2'
import { setFixturesDir } from '../../basic/test/helper.js'

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

export async function isDirectory (path) {
  const statObject = await stat(path)

  return statObject.isDirectory()
}

export async function waitForStart (stream) {
  let url

  for await (const log of on(stream.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

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
