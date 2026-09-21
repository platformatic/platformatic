import { ok, strictEqual } from 'node:assert'
import { existsSync } from 'node:fs'
import { lstat, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { isWindows, prepareRuntime, setFixturesDir, updateFile } from '../../basic/test/helper.js'
import { executeCommand, waitForStart, wattpm } from '../../wattpm/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('can pack a Next standalone application and start it with the bundled wattpm binary', async t => {
  const { root } = await prepareRuntime(t, 'server-side-standalone', true, null, async root => {
    await updateFile(resolve(root, 'services/frontend/next.config.js'), () => {
      return 'module.exports = { output: "standalone" }\n'
    })

    await updateFile(resolve(root, 'services/frontend/platformatic.application.json'), raw => {
      const json = JSON.parse(raw)
      json.next ??= {}
      json.next.standalone = true
      return JSON.stringify(json, null, 2)
    })
  })

  const packProcess = await wattpm('frontend:pack', '--output', '.platformatic/frontend-bundle', { cwd: root })
  ok(packProcess.stdout.includes('Packed application frontend into'))

  const bundleRoot = resolve(root, '.platformatic/frontend-bundle')
  ok(existsSync(resolve(bundleRoot, 'server.js')))
  ok(existsSync(resolve(bundleRoot, '.next/static')))
  ok(existsSync(resolve(bundleRoot, 'watt.json')))
  ok(existsSync(resolve(bundleRoot, 'node_modules/wattpm/package.json')))
  ok(existsSync(resolve(bundleRoot, 'node_modules/@platformatic/next/package.json')))

  strictEqual((await lstat(resolve(bundleRoot, 'node_modules/wattpm'))).isSymbolicLink(), false)
  strictEqual((await lstat(resolve(bundleRoot, 'node_modules/@platformatic/next'))).isSymbolicLink(), false)

  const bundleConfigPath = resolve(bundleRoot, 'watt.json')
  const bundleConfig = JSON.parse(await readFile(bundleConfigPath, 'utf-8'))
  bundleConfig.server = { ...(bundleConfig.server ?? {}), hostname: '127.0.0.1', port: 0 }
  await writeFile(bundleConfigPath, JSON.stringify(bundleConfig, null, 2))

  const bundledWattpm = resolve(bundleRoot, 'node_modules/.bin', isWindows ? 'wattpm.cmd' : 'wattpm')
  const startProcess = executeCommand(bundledWattpm, 'start', {
    cwd: bundleRoot,
    reject: false,
    env: {
      PLT_SERVER_HOSTNAME: '127.0.0.1'
    }
  })

  t.after(async () => {
    startProcess.kill('SIGTERM')
    try {
      await startProcess
    } catch {}
  })

  const { url } = await waitForStart(startProcess)
  ok(url)

  const { statusCode, body } = await request(url)
  strictEqual(statusCode, 200)
  ok((await body.text()).includes('Hello from v'))
})
