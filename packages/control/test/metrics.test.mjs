'use strict'

import { test } from 'node:test'
import { join } from 'node:path'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime, kill } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should stream runtime metrics', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => kill(runtime))

  const child = execa('node', [cliPath, 'metrics'])
  t.after(() => kill(child))

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 30000)

  return new Promise((resolve) => {
    child.stdout.on('data', (data) => {
      const stringData = data.toString()
      if (stringData.includes('totalHeapSize') && stringData.includes('usedHeapSize') && stringData.includes('newSpaceSize') && stringData.includes('oldSpaceSize') && stringData.includes('latency')) {
        clearTimeout(errorTimeout)
        resolve()
      }
    })
  })
})
