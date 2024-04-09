'use strict'

const { describe, test } = require('node:test')
const { getParser, getStringifier } = require('..')
const { equal, throws, deepEqual } = require('node:assert/strict')

for (const ext of ['yaml', 'yml', 'json', 'json5', 'toml', 'tml']) {
  describe(ext, () => {
    test('getParser should return a function', () => {
      const parser = getParser(`file.${ext}`)
      equal(typeof parser, 'function')
    })

    test('getStringifier should return a function', () => {
      const stringifier = getStringifier(`file.${ext}`)
      equal(typeof stringifier, 'function')
    })

    test('mirror test', () => {
      const parser = getParser(`file.${ext}`)
      const stringifier = getStringifier(`file.${ext}`)
      const data = { a: 1, b: 2 }
      deepEqual(parser(stringifier(data)), data)
    })
  })
}

test('getParser should throw for unknown extension', () => {
  throws(() => getParser('file.txt'))
})

test('getStringifier should throw for unknown extension', () => {
  throws(() => getStringifier('file.txt'))
})
