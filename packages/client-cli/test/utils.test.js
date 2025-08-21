import { deepEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'

import { getAllResponseCodes, getResponseContentType, getResponseTypes, is200JsonResponse } from '../lib/utils.js'

test('should get response content type', async (t) => {
  {
    // returns the first content type found
    const template = {
      description: 'Contents of file',
      content: {
        'text/html': {
          schema: {
            type: 'string'
          }
        },
        'application/json': {
          schema: {
            type: 'string'
          }
        }
      }
    }
    equal(getResponseContentType(template), 'text/html')
  }
  {
    // returns null, AKA empty/unknown response
    const template = {
      description: 'Contents of file'
    }
    equal(getResponseContentType(template), null)
  }
})

test('should detect a json response', async (t) => {
  {
    const responsesObject = {
      200: {
        content: {
          'application/json': {
            schema: {}
          }
        }
      }
    }
    equal(is200JsonResponse(responsesObject), true)
  }

  {
    const responsesObject = {
      200: {
        description: 'Default response'
      }
    }
    equal(is200JsonResponse(responsesObject), false)
  }

  {
    const responsesObject = {
      '2xx': {
        content: {
          'application/json': {
            schema: {}
          }
        }
      }
    }
    equal(is200JsonResponse(responsesObject), true)
  }
})

test('should return all response codes', async () => {
  const responseObject = {
    200: {},
    204: {},
    404: {},
    400: {},
    502: {}
  }
  const expected = [200, 204, 404, 400, 502]
  const extracted = getAllResponseCodes(responseObject)
  equal(extracted.length, expected.length)
  extracted.forEach((code) => {
    ok(expected.includes(code))
  })
})

test('should map responses to fetch parse function', async () => {
  const responseObject = {
    200: {
      content: {
        'application/json': {
          schema: { type: 'object', properties: { foobar: { type: 'string' } } }
        },
        'text/plain': {
          schema: { type: 'string' }
        }
      }
    },
    202: {
      content: {
        'image/png': {
          schema: { type: 'string', format: 'binary' }
        }
      }
    }
  }
  const mapped = getResponseTypes(responseObject)
  const expected = {
    json: [200],
    blob: [202],
    text: [200]
  }
  deepEqual(mapped, expected)
})
