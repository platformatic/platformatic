import { execa } from 'execa'
import { strictEqual } from 'node:assert'
import { test } from 'node:test'

const loaderHelper = new URL('../../lib/worker/loader.js', import.meta.url).href
const loader = new URL('../fixtures/dual-mode-loader.js', import.meta.url).href

for (const [name, data, expected] of [
  ['without tracing', {}, 'sync'],
  ['with disabled tracing', { tracingConfig: { enabled: false } }, 'sync'],
  ['with enabled tracing', { tracingConfig: { enabled: true } }, 'async'],
  ['with implicit tracing enablement', { tracingConfig: {} }, 'async']
]) {
  test(`registerLoader uses ${expected} hooks ${name}`, async () => {
    // Isolate hooks in a subprocess so they cannot affect the test runner or other cases.
    const { stdout } = await execa(process.execPath, ['--input-type=module', '--eval', `
      import { registerLoader } from ${JSON.stringify(loaderHelper)}
      await registerLoader(${JSON.stringify(loader)}, ${JSON.stringify(data)}, { registerHooks: true })
      console.log((await import('test:loader')).default)
    `])

    strictEqual(stdout, expected)
  })
}
