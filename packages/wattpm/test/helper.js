import { createDirectory, safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import { on } from 'node:events'
import { existsSync } from 'node:fs'
import { stat, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import split2 from 'split2'

let tmpCount = 0
export const cliPath = fileURLToPath(new URL('../bin/wattpm.js', import.meta.url))
export const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url))

export async function createTemporaryDirectory (t, prefix) {
  const directory = join(tmpdir(), `test-wattpm-init-${process.pid}-${tmpCount++}`)

  t.after(async () => {
    await safeRemove(directory)
  })

  return directory
}

export async function isDirectory (path) {
  const statObject = await stat(path)

  return statObject.isDirectory()
}

export async function ensureDependency (t, directory, pkg) {
  const [namespace, name] = pkg.includes('/') ? pkg.split('/') : ['', pkg]
  const basedir = resolve(directory, `node_modules/${namespace}`)
  const source =
    namespace === '@platformatic'
      ? resolve(import.meta.dirname, `../../${name}`)
      : resolve(import.meta.dirname, `../../../node_modules/${pkg}`)
  const destination = resolve(basedir, name)

  t.after(() => safeRemove(resolve(directory, 'node_modules')))

  await createDirectory(basedir)
  if (!existsSync(destination)) {
    await symlink(source, destination, 'dir')
  }
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

export function wattpm (...args) {
  const options = typeof args.at(-1) === 'object' ? args.pop() : {}

  return execa('node', [cliPath, ...args], { env: { NO_COLOR: 'true' }, ...options })
}
