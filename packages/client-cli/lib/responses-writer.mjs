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
    writer.writeLine(`export type ${allResponsesName} =`)
    writer.indent(() => {
      if (responseTypes.length > 0) {
        writer.write(responseTypes.join('\n| '))
      } else {
        writer.write('unknown')
      }
    })
    writer.blankLine()
    return allResponsesName
  }
  return 'unknown'

  function writeResponse (typeName, responseSchema) {
    if (!responseSchema) {
      return
    }
    if (responseSchema.type === 'object') {
      writer.write(`export type ${typeName} =`).block(() => {
        writeObjectProperties(writer, responseSchema, {}, new Set(), 'res')
      })
    } else {
      writer.writeLine(`export type ${typeName} = ${getType(responseSchema, 'res', spec)}`)
    }
  }
}

export { responsesWriter }
