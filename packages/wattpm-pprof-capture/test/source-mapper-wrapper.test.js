import { SourceMapper } from '@datadog/pprof'
import { deepStrictEqual, strictEqual } from 'node:assert'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { SourceMapGenerator } from 'source-map'
import { SourceMapperWrapper } from '../lib/source-mapper-wrapper.js'

class MockSourceMapper {
  constructor (mapper) {
    this.mapper = mapper
  }

  mappingInfo (location) {
    return this.mapper(location)
  }
}

test('should correctly map webpack paths', async () => {
  const appPath = '/Users/ivan-tymoshenko/projects/platformatic/leads-demo/web/next'
  const info = {
    file: `${appPath}/.next/server/app/api/heavy/route.js`,
    line: 1,
    column: 42,
    name: 'a'
  }

  const mapper = () => {
    return {
      file: `${appPath}/.next/server/app/api/heavy/webpack:/next/src/app/api/heavy/route.js`,
      name: 'fibonacci',
      line: 6,
      column: 12
    }
  }

  const innerMapper = new MockSourceMapper(mapper)
  const sourceMapper = new SourceMapperWrapper(innerMapper)

  const mappedInfo = sourceMapper.mappingInfo(info)
  deepStrictEqual(mappedInfo, {
    file: 'webpack:/next/src/app/api/heavy/route.js',
    name: 'fibonacci',
    line: 6,
    column: 12
  })
})

test('should correctly map turbopack paths', async () => {
  const appPath = '/app/web/next'
  const mapper = () => {
    return {
      file: `${appPath}/.next/server/chunks/ssr/turbopack:/[turbopack]/nodejs/runtime/build-base.ts`,
      name: 'getOrInstantiateModuleFromParent',
      line: 75,
      column: 10
    }
  }

  const sourceMapper = new SourceMapperWrapper(new MockSourceMapper(mapper))
  const mappedInfo = sourceMapper.mappingInfo({
    file: `${appPath}/.next/server/chunks/ssr/[turbopack]_runtime.js`,
    line: 1,
    column: 42,
    name: 'a'
  })

  deepStrictEqual(mappedInfo, {
    file: 'turbopack:/[turbopack]/nodejs/runtime/build-base.ts',
    name: 'getOrInstantiateModuleFromParent',
    line: 75,
    column: 10
  })
})

async function createSourceMapper (t, name, configure) {
  const dir = await mkdtemp(join(tmpdir(), 'plt-pprof-source-mapper-'))
  t.after(() => rm(dir, { recursive: true, force: true }))

  const generatedPath = join(dir, `${name}.js`)
  const generator = new SourceMapGenerator({ file: `${name}.js` })
  configure(generator)

  await writeFile(generatedPath, `function a(){}\n//# sourceMappingURL=${name}.js.map`)
  await writeFile(`${generatedPath}.map`, generator.toString())

  const innerMapper = await SourceMapper.create([dir])
  return { dir, generatedPath, sourceMapper: new SourceMapperWrapper(innerMapper) }
}

test('should map a location without mappings at or before its column', async t => {
  const { dir, generatedPath, sourceMapper } = await createSourceMapper(t, 'bundle', generator => {
    generator.addMapping({
      generated: { line: 1, column: 350 },
      original: { line: 3, column: 9 },
      source: 'src/utils.ts',
      name: 'getCustomFormFields'
    })
  })

  const mappedInfo = sourceMapper.mappingInfo({ file: generatedPath, line: 1, column: 120, name: 'eY' })
  deepStrictEqual(mappedInfo, {
    file: join(dir, 'src/utils.ts'),
    name: 'getCustomFormFields',
    line: 3,
    column: 10
  })
})

test('should extract the function name from the sources when the source map has no names', async t => {
  const { dir, generatedPath, sourceMapper } = await createSourceMapper(t, 'bundle', generator => {
    generator.setSourceContent(
      'src/react.js',
      'function renderElement(request, task) {\r\n  return task\r\n}\r\nexports.memo = function (type) {\n  return type\n}\n'
    )
    generator.addMapping({ generated: { line: 1, column: 10 }, original: { line: 1, column: 9 }, source: 'src/react.js' })
    generator.addMapping({ generated: { line: 1, column: 50 }, original: { line: 4, column: 15 }, source: 'src/react.js' })
    generator.addMapping({ generated: { line: 1, column: 90 }, original: { line: 2, column: 2 }, source: 'src/react.js' })
  })

  deepStrictEqual(sourceMapper.mappingInfo({ file: generatedPath, line: 1, column: 11, name: 'eY' }), {
    file: join(dir, 'src/react.js'),
    name: 'renderElement',
    line: 1,
    column: 10
  })

  deepStrictEqual(sourceMapper.mappingInfo({ file: generatedPath, line: 1, column: 51, name: '(anonymous)' }), {
    file: join(dir, 'src/react.js'),
    name: 'memo',
    line: 4,
    column: 16
  })

  // The generated name is preserved if the original one cannot be found
  deepStrictEqual(sourceMapper.mappingInfo({ file: generatedPath, line: 1, column: 91, name: 'ak' }), {
    file: join(dir, 'src/react.js'),
    name: 'ak',
    line: 2,
    column: 3
  })
})

test('should not replace a name which is not minified', async t => {
  const { dir, generatedPath, sourceMapper } = await createSourceMapper(t, 'bundle', generator => {
    generator.setSourceContent('src/cookies.ts', 'function parseCookieValue(raw) {\n  return raw\n}\n')
    generator.addMapping({ generated: { line: 1, column: 10 }, original: { line: 1, column: 0 }, source: 'src/cookies.ts' })
  })

  const mappedInfo = sourceMapper.mappingInfo({ file: generatedPath, line: 1, column: 11, name: 'beginLockedNavigation' })
  deepStrictEqual(mappedInfo, {
    file: join(dir, 'src/cookies.ts'),
    name: 'beginLockedNavigation',
    line: 1,
    column: 1
  })
})

test('should not mix the sources with the same name of different source maps', async t => {
  const first = await createSourceMapper(t, 'first', generator => {
    generator.setSourceContent('index.js', 'function first() {}\n')
    generator.addMapping({ generated: { line: 1, column: 10 }, original: { line: 1, column: 0 }, source: 'index.js' })
  })

  const second = await createSourceMapper(t, 'second', generator => {
    generator.setSourceContent('index.js', 'function second() {}\n')
    generator.addMapping({ generated: { line: 1, column: 10 }, original: { line: 1, column: 0 }, source: 'index.js' })
  })

  const innerMapper = await SourceMapper.create([first.dir, second.dir])
  const sourceMapper = new SourceMapperWrapper(innerMapper)

  strictEqual(sourceMapper.mappingInfo({ file: first.generatedPath, line: 1, column: 11, name: 'a' }).name, 'first')
  strictEqual(sourceMapper.mappingInfo({ file: second.generatedPath, line: 1, column: 11, name: 'a' }).name, 'second')
})

test('should return the location of a file without source map', async t => {
  const { dir, sourceMapper } = await createSourceMapper(t, 'bundle', generator => {
    generator.addMapping({ generated: { line: 1, column: 0 }, original: { line: 1, column: 0 }, source: 'src/utils.ts' })
  })

  const location = { file: join(dir, 'other.js'), line: 1, column: 11, name: 'a' }
  deepStrictEqual(sourceMapper.mappingInfo(location), location)
})
