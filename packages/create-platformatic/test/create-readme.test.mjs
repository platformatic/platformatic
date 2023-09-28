'use strict'

import { test } from 'tap'
import { createReadme } from '../src/create-readme.mjs'
import { fileURLToPath } from 'node:url'
import { readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const fakeLogger = {
  debug: () => {}
}

test('should create readme in current directory', async (t) => {
  const targetFilename = join(__dirname, 'README.md')
  t.teardown(async () => {
    await unlink(targetFilename)
  })
  await createReadme(fakeLogger, __dirname, 'service')
  const fileData = await readFile(targetFilename, 'utf8')
  t.equal(typeof fileData, 'string')
})
