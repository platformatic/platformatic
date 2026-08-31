import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'
import { serializeConfiguration, serializeString } from '../../lib/v4/index.js'

test('serialized strings survive every character that could break the literal', () => {
  /*
    The writer emits a module, so a value that unbalances the quote or terminates the line is a
    SyntaxError in someone's generated watt.config.js. \r is the one that hid: a LineTerminator
    inside a string literal, riding in from a v3 value with CRLF in it.
  */
  for (const value of ["quo'te", 'back\\slash', 'multi\nline', 'carriage\r\nreturn', "all\\'of\r\nthem"]) {
    // eslint-disable-next-line no-eval
    deepStrictEqual(eval(serializeString(value)), value)
  }
})

test('a configuration holding such strings serializes to an evaluable expression', () => {
  const config = { logger: { level: 'info' }, description: 'line one\r\nline two' }

  // eslint-disable-next-line no-eval
  deepStrictEqual(eval(`(${serializeConfiguration(config)})`), config)
})
