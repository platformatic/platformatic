import { getType } from './get-type.mjs'

/**
 * Parses the "body" parameters and the "requestBody" property of the OpenAPI spec proivded
 * @param {object} requestBody The request body of the path/method
 * @param {object} spec The full OpenAPI Spec (used to resolve $ref pointers)
 * @param {boolean} isFull If true returns an object { body: ... } instead of the string
 * @returns string | object
 */
function requestBodyParser (requestBody, spec, isFull) {
  if (requestBody.content['application/json']) {
    const schema = requestBody.content['application/json'].schema

    const typed = getType(schema, 'req', spec)
    if (isFull) {
      return `body: ${typed}`
    }
    return typed
  }

  // otherwise it will be a string
  return 'string'
}

export { requestBodyParser }
