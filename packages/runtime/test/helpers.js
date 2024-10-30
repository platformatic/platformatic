const { join } = require('node:path')
const { MockAgent, setGlobalDispatcher } = require('undici')
const { createDirectory } = require('@platformatic/utils')
const { safeRemove } = require('@platformatic/utils')
const { mkdir, link } = require('fs/promises')
const { mkdirp } = require('mkdirp')

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

let counter = 0
async function getTempDir (baseDir) {
  if (baseDir === undefined) {
    baseDir = __dirname
  }
  const dir = join(baseDir, 'tmp', `plt-runtime-${process.pid}-${Date.now()}-${counter++}`)
  await createDirectory(dir, true)
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

async function linkNodeModules (dir, pkgs) {
  await mkdirp(join(dir, 'node_modules'))
  for (const pkg of pkgs) {
    if (pkg.startsWith('@')) {
      const [scope, name] = pkg.split('/')
      await mkdir(join(dir, 'node_modules', scope))
      await link(join(__dirname, '..', 'node_modules', scope, name), join(dir, 'node_modules', scope, name))
    } else {
      await link(join(__dirname, '..', 'node_modules', pkg), join(dir, 'node_modules', pkg))
    }
  }
}

module.exports = {
  getTempDir,
  moveToTmpdir,
  mockNpmJsRequestForPkgs,
  linkNodeModules,
  mockAgent,
}
