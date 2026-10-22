import assert from 'node:assert'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { Profile } from 'pprof-format'
import { SourceMapGenerator } from 'source-map'
import { request } from 'undici'
import { createRuntime } from '../../runtime/test/helpers.js'

const serviceDir = resolve(import.meta.dirname, 'fixtures/sourcemap-minified-test/service')
const distDir = resolve(serviceDir, 'dist')

// The minified version of src/plugin.js, with the code on a single line after the loader code
const loader = '/* loader */'.repeat(30)
const minified =
  loader +
  'function a(b){return b<2?b:a(b-1)+a(b-2)}' +
  'function d(e){let f=0;for(let g=0;g<e;g++){f=(f*31+a(g%20))%1000003}return f}' +
  'export default async function(c){' +
  'c.get("/",async()=>({message:"Hello from minified code"}));' +
  'c.get("/compute",async()=>({result:d(3000)+a(25)}))}'

// The identifiers whose original name is part of the source map. The other
// ones are mapped without a name, like the code of React bundled in Next.js.
const namedIdentifiers = ['fibonacci', 'n']

function getIdentifiers (code, offset = 0) {
  const identifiers = []
  const matcher = /\/\*.*?\*\/|"[^"]*"|'[^']*'|[A-Za-z_$][\w$]*/g

  let match
  while ((match = matcher.exec(code)) !== null) {
    if (/^[A-Za-z_$]/.test(match[0])) {
      identifiers.push({ name: match[0], index: match.index + offset })
    }
  }

  return identifiers
}

async function build () {
  const original = await readFile(resolve(serviceDir, 'src/plugin.js'), 'utf8')
  const generator = new SourceMapGenerator({ file: 'plugin.js' })
  generator.setSourceContent('../src/plugin.js', original)

  const generated = getIdentifiers(minified)
  const sources = getIdentifiers(original)
  assert.strictEqual(generated.length, sources.length)

  for (let i = 0; i < generated.length; i++) {
    const before = original.slice(0, sources[i].index)
    const line = before.split('\n').length
    const column = sources[i].index - (before.lastIndexOf('\n') + 1)

    const mapping = {
      generated: { line: 1, column: generated[i].index },
      original: { line, column },
      source: '../src/plugin.js'
    }

    if (namedIdentifiers.includes(sources[i].name)) {
      mapping.name = sources[i].name
    }

    generator.addMapping(mapping)
  }

  await mkdir(distDir, { recursive: true })
  await writeFile(resolve(distDir, 'plugin.js'), `${minified}\n//# sourceMappingURL=plugin.js.map`)
  await writeFile(resolve(distDir, 'plugin.js.map'), generator.toString())
}

async function waitForProfilingState (app, check) {
  for (let i = 0; i < 100; i++) {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    if (check(state)) {
      return
    }
    await sleep(100)
  }

  throw new Error('Timeout waiting for the profiling state')
}

test.before(build)

test.after(async () => {
  await rm(distDir, { recursive: true, force: true })
})

test('should resolve the original function names of minified code', { skip: process.platform === 'win32' }, async t => {
  const configFile = resolve(import.meta.dirname, 'fixtures/sourcemap-minified-test/platformatic.json')
  const tmpDir = resolve(import.meta.dirname, '../../tmp')
  await mkdir(tmpDir, { recursive: true })

  const app = await createRuntime(configFile, null, { logsPath: resolve(tmpDir, `sourcemap-names-${Date.now()}.log`) })
  t.after(() => app.close())
  const url = await app.start()

  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 3000, sourceMaps: true })
  await waitForProfilingState(app, state => state.isProfilerRunning)

  const end = Date.now() + 3500
  while (Date.now() < end) {
    const { statusCode, body } = await request(`${url}/compute`, { headersTimeout: 30000, bodyTimeout: 30000 })
    await body.dump()
    assert.strictEqual(statusCode, 200)
  }

  await waitForProfilingState(app, state => state.hasProfile)

  const profile = Profile.decode(await app.sendCommandToApplication('service', 'getLastProfile'))
  await app.sendCommandToApplication('service', 'stopProfiling')

  const names = new Set()
  for (const fn of profile.function) {
    const filename = profile.stringTable.strings[Number(fn.filename)]
    if (filename.endsWith('src/plugin.js')) {
      names.add(profile.stringTable.strings[Number(fn.name)])
    }
  }

  const found = [...names].sort().join(', ')
  assert.ok(names.has('fibonacci'), `should use the name in the source map. Found: ${found}`)
  assert.ok(names.has('computeChecksum'), `should extract the name from the sources. Found: ${found}`)

  for (const name of ['a', 'd', 'n', 'rows', 'sum', 'i']) {
    assert.ok(!names.has(name), `should not contain a function named ${name}. Found: ${found}`)
  }
})
