import { ok, rejects } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { swapVersion } from '../../basic/test/helper-version.js'
import { getLogsFromFile, prepareRuntime, setFixturesDir } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('NestJS version is checked in development', async t => {
  const { runtime, root } = await prepareRuntime(t, 'express-standalone', false, null, async () => {
    await swapVersion(t, import.meta.dirname, '@nestjs/core')
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(logs.some(l => l.err?.message.includes('@nestjs/core version 1.0.0 is not supported')))
})

test('NestJS version is not checked in production', async t => {
  const { runtime, root } = await prepareRuntime(t, 'express-standalone', true, null, async () => {
    await swapVersion(t, import.meta.dirname, '@nestjs/core')
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(!logs.some(l => l.err?.message.includes('@nestjs/core version 1.0.0 is not supported')))
})
