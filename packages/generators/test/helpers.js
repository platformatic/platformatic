import { createDirectory, safeRemove } from '@platformatic/foundation'
import { join } from 'node:path'
import { MockAgent, setGlobalDispatcher } from 'undici'

export const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

let counter = 0

export async function getTempDir (baseDir) {
  if (baseDir === undefined) {
    baseDir = import.meta.dirname
  }
  const dir = join(baseDir, 'tmp', `platformatic-generators-${process.pid}-${Date.now()}-${counter++}`)
  await createDirectory(dir)
  return dir
}

export async function moveToTmpdir (teardown) {
  const cwd = process.cwd()

  const dir = await getTempDir()
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (!process.env.PLT_TESTS_SKIP_REMOVE_TEMPORARY) {
    teardown(() => safeRemove(dir))
  }
  return dir
}

export function mockNpmJsRequestForPkgs (pkgs) {
  for (const pkg of pkgs) {
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: `/${pkg}`
      })
      .reply(200, {
        'dist-tags': {
          latest: '1.42.0'
        }
      })
  }
}

export const fakeLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {}
}
