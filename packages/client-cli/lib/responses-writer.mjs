'use strict'
import { STATUS_CODES } from 'node:http'
import { capitalize, classCase } from './utils.mjs'
import { getType, writeObjectProperties } from './openapi-common.mjs'

function responsesWriter (operationId, responsesArray, isFullResponse, writer, spec) {
  const responseTypes = Object.entries(responsesArray)
    .filter(([statusCode, response]) => {
      // We ignore all non-JSON endpoints for now
      // TODO: support other content types
      return response.content && response.content['application/json'] !== undefined
    })
    .map(([statusCode, response]) => {
      if (statusCode === '204') {
        return 'undefined'
      }
      // Unrecognized status code
      const statusCodeName = STATUS_CODES[statusCode]
      let typeName
      if (statusCodeName === undefined) {
        typeName = `${operationId}${statusCode}Response`
      } else {
        typeName = `${operationId}Response${classCase(STATUS_CODES[statusCode])}`
      }
      let isResponseArray
      writeResponse(typeName, response.content['application/json'].schema)
      if (isResponseArray) typeName = `Array<${typeName}>`
      if (isFullResponse) typeName = `FullResponse<${typeName}, ${statusCode}>`
      return typeName
    })

  // write response unions
  if (responseTypes.length) {
    const allResponsesName = `${capitalize(operationId)}Responses`
    writer.writeLine(`export type ${allResponsesName} = `)
    writer.indent(() => {
      if (responseTypes.length > 0) {
        writer.write(responseTypes.join('\n| '))
      } else {
        writer.write('unknown')
      }
    })
    writer.blankLine()
    // mainWriter.writeLine(`${camelCaseOperationId}(req?: ${operationRequestName}): Promise<${allResponsesName}>;`)
    // currentFullResponse = originalFullResponse

    return allResponsesName
  }
  return 'unknown'

  function writeResponse (typeName, responseSchema) {
    if (!responseSchema) {
      return
    }
    if (responseSchema.type === 'object') {
      writer.write(`export type ${typeName} =`).block(() => {
        // writer.writeLine(getType(responseSchema, 'res'))
        writeObjectProperties(writer, responseSchema, {}, new Set(), 'res')
      })
    } else {
      writer.writeLine(`export type ${typeName} = ${getType(responseSchema, 'res', spec)}`)
    }

    return
    let isResponseArray
    for (const [contentType, body] of Object.entries(responseSchema)) {
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
      writer.write(`export type ${typeName} =`).block(() => {
        writer.writeLine(getType(schema, 'res', spec))
      })
      // if (body.schema.type === 'array') {
      //   isResponseArray = true
      //   schema = body.schema.items
      //   if (schema.type !== 'object') {
      //     writer.writeLine(getType(schema, 'res'))
      //     return isResponseArray
      //   }
      // } else {
      //   schema = body.schema
      // }
      break
    }
  }
}

export { responsesWriter }
