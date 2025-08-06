'use strict'

const { join } = require('node:path')
const { MockAgent, setGlobalDispatcher } = require('undici')
const { safeRemove, createDirectory } = require('@platformatic/foundation')

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

let counter = 0

async function getTempDir (baseDir) {
  if (baseDir === undefined) {
    baseDir = __dirname
  }
  const dir = join(baseDir, 'tmp', `platformatic-generators-${process.pid}-${Date.now()}-${counter++}`)
  await createDirectory(dir)
  return dir
}
async function moveToTmpdir (teardown) {
  const cwd = process.cwd()

  const dir = await getTempDir()
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (!process.env.SKIP_RM_TMP) {
    teardown(() => safeRemove(dir))
  }
  return dir
}

function mockNpmJsRequestForPkgs (pkgs) {
  for (const pkg of pkgs) {
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: `/${pkg}`,
      })
      .reply(200, {
        'dist-tags': {
          latest: '1.42.0',
        },
      })
  }
}

module.exports = {
  fakeLogger: {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  },
  getTempDir,
  moveToTmpdir,
  mockNpmJsRequestForPkgs,
  mockAgent,
}
