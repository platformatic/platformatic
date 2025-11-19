import { test } from 'node:test'
import { deepStrictEqual } from 'node:assert'
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
