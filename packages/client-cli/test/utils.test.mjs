import { test } from 'node:test'
import { equal } from 'node:assert'

import { getResponseContentType } from '../lib/utils.mjs'

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
