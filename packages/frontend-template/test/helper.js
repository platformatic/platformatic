'use strict'

import { join } from 'node:path'
import fs from 'node:fs/promises'
import * as url from 'url'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const cliPath = join(__dirname, '..', 'index.js')

let counter = 0

async function moveToTmpdir (teardown) {
  const cwd = process.cwd()
  const tmp = join(__dirname, 'tmp')
  try {
    await fs.mkdir(tmp)
  } catch {
  }
  const dir = join(tmp, `platformatic-frontend-client-${process.pid}-${Date.now()}-${counter++}`)
  await fs.mkdir(dir)
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (!process.env.SKIP_RM_TMP) {
    teardown(() => fs.rm(tmp, { recursive: true }).catch(() => {}))
  }
  return dir
}

export {
  moveToTmpdir,
  cliPath
}
