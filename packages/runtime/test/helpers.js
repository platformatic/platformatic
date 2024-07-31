const { join } = require('node:path')
const { mkdir, rm } = require('node:fs/promises')
const { MockAgent, setGlobalDispatcher } = require('undici')

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

let counter = 0
async function getTempDir (baseDir) {
  if (baseDir === undefined) {
    baseDir = __dirname
  }
  const dir = join(baseDir, 'tmp', `plt-runtime-${process.pid}-${Date.now()}-${counter++}`)
  await safeMkdir(dir)
  return dir
}
async function moveToTmpdir (teardown) {
  const cwd = process.cwd()
  const dir = await getTempDir()
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (!process.env.SKIP_RM_TMP) {
    teardown(() => rm(dir, { recursive: true }).catch(() => {}))
  }
  return dir
}

async function safeMkdir (dir) {
  try {
    await mkdir(dir, { recursive: true })
    /* c8 ignore next 3 */
  } catch (err) {
    // do nothing
  }
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
  getTempDir,
  moveToTmpdir,
  mockNpmJsRequestForPkgs,
  mockAgent,
}
