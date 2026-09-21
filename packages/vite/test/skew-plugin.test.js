import { deepStrictEqual, strictEqual } from 'node:assert'
import test from 'node:test'
import { addDeploymentId, platformaticSkewPlugin } from '../skew-plugin.js'

test('does not create a plugin without a deployment ID', () => {
  strictEqual(platformaticSkewPlugin(''), undefined)
  strictEqual(platformaticSkewPlugin(null), undefined)
})

test('adds deployment IDs while preserving query strings and hashes', () => {
  strictEqual(addDeploymentId('/assets/app.js', 'dpl/test'), '/assets/app.js?dpl=dpl%2Ftest')
  strictEqual(addDeploymentId('/assets/app.js?v=1#hash', 'dpl-1'), '/assets/app.js?v=1&dpl=dpl-1#hash')
  strictEqual(addDeploymentId('https://example.com/app.js', 'dpl-1'), 'https://example.com/app.js')
  strictEqual(addDeploymentId('/assets/app.js?dpl=old', 'dpl-1'), '/assets/app.js?dpl=old')
})

test('defines the deployment ID and rewrites HTML asset URLs', () => {
  const plugin = platformaticSkewPlugin('dpl-1')
  const config = plugin.config()
  strictEqual(config.define['import.meta.env.PLT_DEPLOYMENT_ID'], JSON.stringify('dpl-1'))
  strictEqual(config.define['process.env.PLT_DEPLOYMENT_ID'], JSON.stringify('dpl-1'))

  const html = plugin.transformIndexHtml('<script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css?v=1#x">')
  strictEqual(html, '<script type="module" src="/assets/app.js?dpl=dpl-1"></script><link rel="stylesheet" href="/assets/app.css?v=1&dpl=dpl-1#x">')
})

test('rewrites client dynamic imports but not server imports', () => {
  const plugin = platformaticSkewPlugin('dpl-1')
  const result = plugin.renderDynamicImport({ targetModuleId: '/app/chunk.js', ssr: false })
  strictEqual(result.left.startsWith('import((url =>'), true)
  strictEqual(result.right, ', import.meta.url)))')
  strictEqual(plugin.renderDynamicImport({ targetModuleId: '/app/chunk.js', ssr: true }), undefined)
})

test('rewrites asset URLs in manifests', () => {
  const plugin = platformaticSkewPlugin('dpl-1')
  const output = { type: 'asset', fileName: '.vite/ssr-manifest.json', source: JSON.stringify({ entry: ['assets/app.js'], css: ['assets/app.css'] }) }
  plugin.generateBundle({}, { [output.fileName]: output })
  deepStrictEqual(JSON.parse(output.source), {
    entry: ['assets/app.js?dpl=dpl-1'],
    css: ['assets/app.css?dpl=dpl-1']
  })
})

test('does not rewrite manifest entry names or import references', () => {
  const plugin = platformaticSkewPlugin('dpl-1')
  const output = {
    type: 'asset',
    fileName: 'manifest.json',
    source: JSON.stringify({
      'src/main.js': {
        file: 'assets/main.js',
        name: 'main',
        imports: ['_shared'],
        css: ['assets/main.css']
      },
      _shared: { file: 'assets/shared.js' }
    })
  }
  plugin.generateBundle({}, { [output.fileName]: output })
  deepStrictEqual(JSON.parse(output.source), {
    'src/main.js': {
      file: 'assets/main.js?dpl=dpl-1',
      name: 'main',
      imports: ['_shared'],
      css: ['assets/main.css?dpl=dpl-1']
    },
    _shared: { file: 'assets/shared.js?dpl=dpl-1' }
  })
})
