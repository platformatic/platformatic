'use strict'

const { join } = require('node:path')
const fs = require('node:fs/promises')
const { safeMkdir } = require('../lib/utils')
const { MockAgent, setGlobalDispatcher } = require('undici')

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

let counter = 0

async function getTempDir (baseDir) {
  if (baseDir === undefined) {
    baseDir = __dirname
  }
  const dir = join(baseDir, 'tmp', `platformatic-generators-${process.pid}-${Date.now()}-${counter++}`)
  await safeMkdir(dir)
  return dir
}
async function moveToTmpdir (teardown) {
  const cwd = process.cwd()
  // const tmp = join(__dirname, 'tmp')
  // try {
  //   await fs.mkdir(tmp)
  // } catch {
  // }
  const dir = await getTempDir()
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (!process.env.SKIP_RM_TMP) {
    teardown(() => fs.rm(dir, { recursive: true }).catch(() => {}))
  }
  return dir
}

function mockNpmJsRequestForPkgs (pkgs) {
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
module.exports = {
  fakeLogger: {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {}
  },
  getTempDir,
  moveToTmpdir,
  mockNpmJsRequestForPkgs,
  mockAgent
}
