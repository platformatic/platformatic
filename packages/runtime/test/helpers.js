const { join } = require('node:path')
const { mkdir, rm } = require('node:fs/promises')

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

module.exports = {
  getTempDir,
  moveToTmpdir
}
