'use strict'

import { capitalize } from './utils.mjs'
import { hasDuplicatedParameters } from '@platformatic/client'
import jsonpointer from 'jsonpointer'
import errors from './errors.mjs'
import camelcase from 'camelcase'
import { responsesWriter } from './responses-writer.mjs'
import { getType } from './get-type.mjs'

export function writeOperations (interfacesWriter, mainWriter, operations, { fullRequest, fullResponse, optionalHeaders, schema }) {
  const originalFullResponse = fullResponse
  let currentFullResponse = originalFullResponse
  for (const operation of operations) {
    const operationId = operation.operation.operationId
    const camelCaseOperationId = camelcase(operationId)
    const { parameters, responses, requestBody } = operation.operation
    const forceFullRequest = fullRequest || hasDuplicatedParameters(operation.operation)
    const successResponses = Object.entries(responses).filter(([s]) => s.startsWith('2'))
    if (successResponses.length !== 1) {
      currentFullResponse = true
    }
    const capitalizedCamelCaseOperationId = capitalize(camelCaseOperationId)
    const operationRequestName = `${capitalizedCamelCaseOperationId}Request`

    interfacesWriter.write(`export type ${operationRequestName} =`).block(() => {
      const addedProps = new Set()
      if (parameters) {
        if (forceFullRequest) {
          const bodyParams = []
          const pathParams = []
          const queryParams = []
          const headersParams = []
          for (const parameter of parameters) {
            if (optionalHeaders.includes(parameter.name)) {
              parameter.required = false
            }
            switch (parameter.in) {
              case 'query':
                queryParams.push(parameter)
                break
              case 'path':
                pathParams.push(parameter)
                break
              case 'body':
                bodyParams.push(parameter)
                break
              case 'header':
                headersParams.push(parameter)
                break
            }
          }
          writeProperties(interfacesWriter, 'body', bodyParams, addedProps, 'req', schema)
          writeProperties(interfacesWriter, 'path', pathParams, addedProps, 'req', schema)
          writeProperties(interfacesWriter, 'query', queryParams, addedProps, 'req', schema)
          writeProperties(interfacesWriter, 'headers', headersParams, addedProps, 'req', schema)
        } else {
          for (const parameter of parameters) {
            let { name, required } = parameter
            if (optionalHeaders.includes(name)) {
              required = false
            }
            // We do not check for addedProps here because it's the first
            // group of properties
            writeProperty(interfacesWriter, name, parameter, addedProps, required, 'req', schema)
          }
        }
      }
      if (requestBody) {
        writeContent(interfacesWriter, requestBody.content, schema, addedProps, 'req', forceFullRequest ? 'body' : null)
      }
    })
    interfacesWriter.blankLine()
    const allResponsesName = responsesWriter(capitalizedCamelCaseOperationId, responses, currentFullResponse, interfacesWriter, schema)
    mainWriter.writeLine(`${camelCaseOperationId}(req?: ${operationRequestName}): Promise<${allResponsesName}>;`)
    currentFullResponse = originalFullResponse
  }
}

export function writeProperties (writer, blockName, parameters, addedProps, methodType, spec) {
  if (parameters.length > 0) {
    let allOptionalParams = true
    for (const { required } of parameters) {
      if (required !== false) {
        allOptionalParams = false
      }
    }
    const nameToWrite = allOptionalParams ? `${blockName}?: ` : `${blockName}: `
    writer.write(nameToWrite).block(() => {
      for (const parameter of parameters) {
        const { name, required } = parameter
        // We do not check for addedProps here because it's the first
        // group of properties
        writeProperty(writer, name, parameter, addedProps, required, methodType, spec)
      }
    })
  }
}

export function writeProperty (writer, key, value, addedProps, required = true, methodType, spec) {
  addedProps.add(key)
  if (required) {
    writer.quote(key)
  } else {
    writer.quote(key)
    writer.write('?')
  }
  writer.write(`: ${getType(value, methodType, spec)};`)
  writer.newLine()
}

export function writeContent (writer, content, spec, addedProps, methodType, wrapper) {
  let isResponseArray = false
  if (content) {
    for (const [contentType, body] of Object.entries(content)) {
      // We ignore all non-JSON endpoints for now
      // TODO: support other content types
      /* c8 ignore next 3 */
      if (contentType.indexOf('application/json') !== 0) {
        continue
      }

      // Response body has no schema that can be processed
      // Should not be possible with well formed OpenAPI
      /* c8 ignore next 3 */
      if (!body.schema?.type && !body.schema?.$ref) {
        break
      }

      let schema
      // This is likely buggy as there can be multiple responses for different
      // status codes. This is currently not possible with Platformatic DB
      // services so we skip for now.
      // TODO: support different schemas for different status codes

      if (body.schema.type === 'array') {
        isResponseArray = true
        schema = body.schema.items
        if (schema.type !== 'object') {
          writer.writeLine(getType(schema, methodType, spec))
          return isResponseArray
        }
      } else {
        schema = body.schema
      }

      if (wrapper) {
        writer.write(`${wrapper}: `).block(() =>
          writeObjectProperties(writer, schema, spec, addedProps, methodType)
        )
      } else {
        writeObjectProperties(writer, schema, spec, addedProps, methodType)
      }
      break
    }
  }
  return isResponseArray
}

export function writeObjectProperties (writer, schema, spec, addedProps, methodType) {
  function _writeObjectProps (obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (addedProps.has(key)) {
        continue
      }
      const required = schema.required && schema.required.includes(key)
      writeProperty(writer, key, value, addedProps, required, methodType, spec)
    }
  }

  if (schema.$ref) {
    schema = jsonpointer.get(spec, schema.$ref.replace('#', ''))
  }
  if (schema.type === 'object') {
    if (schema.properties) {
      _writeObjectProps(schema.properties)
    }

    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      _writeObjectProps(schema.additionalProperties)
    }
  } else {
    throw new errors.TypeNotSupportedError(schema.type)
  }
}
