import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { extractLegacyModule, getLegacyParser, loadLegacyConfigurationFile } from '../lib/legacy/reader.js'

async function fileWith (name, contents) {
  const directory = await mkdtemp(join(tmpdir(), 'legacy-reader-'))
  const path = join(directory, name)

  await writeFile(path, contents, 'utf-8')

  return path
}

test('reads every format v3 accepted', async () => {
  for (const [name, contents] of [
    ['platformatic.json', '{ "server": { "port": 3042 } }'],
    ['platformatic.json5', '{ server: { port: 3042 } /* a comment */ }'],
    ['platformatic.yaml', 'server:\n  port: 3042\n'],
    ['platformatic.toml', '[server]\nport = 3042\n']
  ]) {
    deepStrictEqual(await loadLegacyConfigurationFile(await fileWith(name, contents)), { server: { port: 3042 } }, name)
  }
})

/*
  v3's YAML pre-pass, which is the reason this reader cannot simply call a YAML parser. `{PORT}` is
  a flow mapping to YAML and a placeholder to v3, and the files migrate reads were written against
  the second reading.
*/
test('an unquoted placeholder in YAML is a string, not a mapping', async () => {
  const path = await fileWith('platformatic.yaml', 'server:\n  port: {PORT}\n  hostname: "{HOST}"\n')

  deepStrictEqual(await loadLegacyConfigurationFile(path), { server: { port: '{PORT}', hostname: '{HOST}' } })
})

test('a file it cannot parse names itself', async () => {
  const path = await fileWith('platformatic.json', '{ not json')

  await rejects(() => loadLegacyConfigurationFile(path), error => error.message.includes(path))
})

test('an extension it does not recognize is refused', () => {
  throws(() => getLegacyParser('/tmp/platformatic.ini'), /does not have a configuration file extension/)
})

test('the module comes from `module` first, and from the $schema URL otherwise', () => {
  const declared = { module: '@example/capability' }
  strictEqual(extractLegacyModule(declared), declared)

  deepStrictEqual(extractLegacyModule({ $schema: 'https://schemas.platformatic.dev/@platformatic/db/2.0.0.json' }), {
    module: '@platformatic/db',
    version: '2.0.0'
  })

  // The older host, which configurations written years ago still carry.
  deepStrictEqual(extractLegacyModule({ $schema: 'https://platformatic.dev/schemas/v1.2.0/service' }), {
    module: '@platformatic/service',
    version: '1.2.0'
  })

  // `wattpm` is the runtime under another name.
  deepStrictEqual(extractLegacyModule({ $schema: 'https://schemas.platformatic.dev/wattpm/3.0.0.json' }), {
    module: '@platformatic/runtime',
    version: '3.0.0'
  })
})

test('a configuration that declares neither is null, or an error when asked', () => {
  strictEqual(extractLegacyModule({ server: {} }), null)
  strictEqual(extractLegacyModule({ $schema: 'https://example.com/other.json' }), null)
  throws(() => extractLegacyModule({ server: {} }, true), /declares neither a module nor a known \$schema/)
})
