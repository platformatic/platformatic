'use strict'

import { STATUS_CODES } from 'node:http'
import { capitalize, classCase } from './utils.mjs'
import { hasDuplicatedParameters } from '@platformatic/client'
import jsonpointer from 'jsonpointer'
import errors from './errors.mjs'
import camelcase from 'camelcase'

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
    const operationRequestName = `${capitalize(camelCaseOperationId)}Request`
    const operationResponseName = `${capitalize(camelCaseOperationId)}Response`

    interfacesWriter.write(`export interface ${operationRequestName}`).block(() => {
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
          writeProperties(interfacesWriter, 'body', bodyParams, addedProps, 'req')
          writeProperties(interfacesWriter, 'path', pathParams, addedProps, 'req')
          writeProperties(interfacesWriter, 'query', queryParams, addedProps, 'req')
          writeProperties(interfacesWriter, 'headers', headersParams, addedProps, 'req')
        } else {
          for (const parameter of parameters) {
            let { name, required } = parameter
            if (optionalHeaders.includes(name)) {
              required = false
            }
            // We do not check for addedProps here because it's the first
            // group of properties
            writeProperty(interfacesWriter, name, parameter, addedProps, required, 'req')
          }
        }
      }
      if (requestBody) {
        writeContent(interfacesWriter, requestBody.content, schema, addedProps, 'req', forceFullRequest ? 'body' : null)
      }
    })
    interfacesWriter.blankLine()

    const responseTypes = Object.entries(responses).map(([statusCode, response]) => {
      // The client library will always dump bodies for 204 responses
      // so the type must be undefined
      if (statusCode === '204') {
        return 'undefined'
      }

      // Unrecognized status code
      const statusCodeName = STATUS_CODES[statusCode]
      let type
      if (statusCodeName === undefined) {
        type = `${operationResponseName}${statusCode}Response`
      } else {
        type = `${operationResponseName}${classCase(STATUS_CODES[statusCode])}`
      }
      let isResponseArray
      interfacesWriter.write(`export interface ${type}`).block(() => {
        isResponseArray = writeContent(interfacesWriter, response.content, schema, new Set(), 'res')
      })
      interfacesWriter.blankLine()
      if (isResponseArray) type = `Array<${type}>`
      if (currentFullResponse) type = `FullResponse<${type}, ${statusCode}>`
      return type
    })

    // write response unions
    const allResponsesName = `${capitalize(camelCaseOperationId)}Responses`
    interfacesWriter.writeLine(`type ${allResponsesName} = `)
    interfacesWriter.indent(() => {
      interfacesWriter.write(responseTypes.join('\n| '))
    })
    interfacesWriter.blankLine()
    mainWriter.writeLine(`${camelCaseOperationId}(req?: ${operationRequestName}): Promise<${allResponsesName}>;`)
    currentFullResponse = originalFullResponse
  }
}

export function writeProperties (writer, blockName, parameters, addedProps, methodType) {
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
        writeProperty(writer, name, parameter, addedProps, required, methodType)
      }
    })
  }
}

export function writeProperty (writer, key, value, addedProps, required = true, methodType) {
  addedProps.add(key)
  if (required) {
    writer.quote(key)
  } else {
    writer.quote(key)
    writer.write('?')
  }
  writer.write(`: ${getType(value, methodType)};`)
  writer.newLine()
}

export function getType (typeDef, methodType) {
  if (typeDef.schema) {
    return getType(typeDef.schema, methodType)
  }
  if (typeDef.anyOf) {
    // recursively call this function
    return typeDef.anyOf.map((t) => {
      return getType(t, methodType)
    }).join(' | ')
  }

  if (typeDef.allOf) {
    // recursively call this function
    return typeDef.allOf.map((t) => {
      return getType(t, methodType)
    }).join(' & ')
  }
  if (typeDef.type === 'array') {
    return `Array<${getType(typeDef.items, methodType)}>`
  }
  if (typeDef.enum) {
    return typeDef.enum.map((en) => {
      if (typeDef.type === 'string') {
        return `'${en.replace(/'/g, "\\'")}'`
      } else {
        return en
      }
    }).join(' | ')
  }
  if (typeDef.type === 'object') {
    if (!typeDef.properties || Object.keys(typeDef.properties).length === 0) {
      // Object without properties
      return 'object'
    }
    let output = '{ '
    // TODO: add a test for objects without properties
    /* c8 ignore next 1 */
    const props = Object.keys(typeDef.properties || {}).map((prop) => {
      let required = false
      if (typeDef.required) {
        required = !!typeDef.required.includes(prop)
      }
      return `${prop}${required ? '' : '?'}: ${getType(typeDef.properties[prop], methodType)}`
    })
    output += props.join('; ')
    output += ' }'
    return output
  }
  return JSONSchemaToTsType(typeDef, methodType)
}

function JSONSchemaToTsType ({ type, format, nullable }, methodType) {
  const isDateType = format === 'date' || format === 'date-time'
  let resultType = 'unknown'

  switch (type) {
    case 'string':
      resultType = isDateType && methodType === 'req' ? 'string | Date' : 'string'
      break
    case 'integer':
      resultType = 'number'
      break
    case 'number':
      resultType = 'number'
      break
    case 'boolean':
      resultType = 'boolean'
      break
    // TODO what other types should we support here?
  }

  return nullable === true ? `${resultType} | null` : resultType
}

function writeContent (writer, content, spec, addedProps, methodType, wrapper) {
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

function writeObjectProperties (writer, schema, spec, addedProps, methodType) {
  function _writeObjectProps (obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (addedProps.has(key)) {
        continue
      }
      const required = schema.required && schema.required.includes(key)
      writeProperty(writer, key, value, addedProps, required, methodType)
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
    // This is unlikely to happen with well-formed OpenAPI.
    /* c8 ignore next 3 */
  } else {
    throw new errors.TypeNotSupportedError(schema.type)
  }
}
