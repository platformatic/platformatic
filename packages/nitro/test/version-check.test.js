import { ok, rejects, strictEqual } from 'node:assert'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { swapVersion } from '../../basic/test/helper-version.js'
import {
  getLogsFromFile,
  prepareRuntime,
  setAdditionalDependencies,
  setFixturesDir,
  startRuntime
} from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(['nitro', 'nitropack', 'vite'])

test('checks Nitro versions in development', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone-nitro', false, null, async () => {
    await swapVersion(t, import.meta.dirname, 'nitropack', '', '2.0.0')
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)
  ok(logs.some(log => log.err?.message.includes('nitropack version 2.0.0 is not supported')))
})

test('checks Nitro versions in Nitro Vite development', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone', false, null, async () => {
    await swapVersion(t, import.meta.dirname, 'nitro', '', '2.0.0')
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)
  ok(logs.some(log => log.err?.message.includes('nitro version 2.0.0 is not supported')))
})

test('starts production output without a Nitro package or version check', async t => {
  const { runtime } = await prepareRuntime(t, 'standalone-nitro', true, null, async root => {
    const applicationRoot = resolve(root, 'services/frontend')
    const output = resolve(applicationRoot, '.output/server')
    await mkdir(output, { recursive: true })
    await writeFile(
      resolve(output, 'index.mjs'),
      "import { createServer } from 'node:http'\ncreateServer((_, res) => res.end('built output')).listen(Number(process.env.NITRO_PORT), process.env.NITRO_HOST)\n"
    )
    await writeFile(
      resolve(applicationRoot, 'package.json'),
      JSON.stringify({ private: true, type: 'module', dependencies: { '@platformatic/nitro': '^3.61.1' } })
    )
    await rm(resolve(applicationRoot, 'node_modules/nitro'), { recursive: true, force: true })
    await rm(resolve(applicationRoot, 'node_modules/nitropack'), { recursive: true, force: true })
  })

  const url = await startRuntime(t, runtime)
  const response = await request(url)
  strictEqual(response.statusCode, 200)
  ok((await response.body.text()).includes('built output'))
})
