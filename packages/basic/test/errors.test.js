import { deepStrictEqual, ok } from 'node:assert'
import { test } from 'node:test'
import { UnsupportedVersion } from '../lib/errors.js'

test('UnsupportedVersion - should format a single supported version', () => {
  const error = new UnsupportedVersion('astro', '1.0.0', '^6.0.0')

  deepStrictEqual(error.code, 'PLT_BASIC_UNSUPPORTED_VERSION')
  deepStrictEqual(error.message, 'astro version 1.0.0 is not supported. Please use version ^6.0.0.')
})

test('UnsupportedVersion - should format a list of supported versions', () => {
  deepStrictEqual(
    new UnsupportedVersion('vite', '9.0.0', ['^5.0.0', '^6.0.0', '^7.0.0', '^8.0.0']).message,
    'vite version 9.0.0 is not supported. Please use version ^5.0.0, ^6.0.0, ^7.0.0, or ^8.0.0.'
  )

  deepStrictEqual(
    new UnsupportedVersion('next', '1.0.0', ['^16.0.0']).message,
    'next version 1.0.0 is not supported. Please use version ^16.0.0.'
  )
})

test('UnsupportedVersion - should work with and without new', () => {
  const withNew = new UnsupportedVersion('vite', '9.0.0', ['^8.0.0'])
  const withoutNew = UnsupportedVersion('vite', '9.0.0', ['^8.0.0'])

  for (const error of [withNew, withoutNew]) {
    ok(error instanceof UnsupportedVersion)
    ok(error instanceof Error)
    deepStrictEqual(error.code, 'PLT_BASIC_UNSUPPORTED_VERSION')
  }

  deepStrictEqual(withNew.message, withoutNew.message)
})
