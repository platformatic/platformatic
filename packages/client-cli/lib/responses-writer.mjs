'use strict'
import { STATUS_CODES } from 'node:http'
import { capitalize, classCase, getResponseContentType, getResponseTypes } from './utils.mjs'
import { writeObjectProperties } from './openapi-common.mjs'
import { getType } from './get-type.mjs'

function responsesWriter (operationId, responsesObject, isFullResponse, writer, spec) {
  const mappedResponses = getResponseTypes(responsesObject)
  const responseTypes = Object.entries(responsesObject)
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
      const responseContentType = getResponseContentType(response)
      if (responseContentType === 'application/json') {
        writeResponse(typeName, response.content['application/json'].schema)
      } else if (responseContentType === null) {
        isFullResponse = true
        writer.writeLine(`export type ${typeName} = unknown`)
      } else if (mappedResponses.blob.includes(parseInt(statusCode))) {
        writer.writeLine(`export type ${typeName} = Blob`)
      } else if (mappedResponses.text.includes(parseInt(statusCode))) {
        writer.writeLine(`export type ${typeName} = string`)
      } else {
        isFullResponse = true
        writer.writeLine(`export type ${typeName} = string`)
      }

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
  return 'FullResponse<unknown, 200>'

  function writeResponse (typeName, responseSchema) {
    if (!responseSchema) {
      return
    }
    if (responseSchema.type === 'object') {
      writer.write(`export type ${typeName} =`).block(() => {
        writeObjectProperties(writer, responseSchema, spec, new Set(), 'res')
      })
    } else {
      writer.writeLine(`export type ${typeName} = ${getType(responseSchema, 'res', spec)}`)
    }
  }
}

export { responsesWriter }
