import { generateOperationId } from '@platformatic/client'
import CodeBlockWriter from 'code-block-writer'
import { writeOperations } from './openapi-common.mjs'
import { capitalize, toJavaScriptName } from './utils.mjs'

export function processOpenAPI ({
  schema,
  name,
  fullResponse,
  fullRequest,
  optionalHeaders,
  validateResponse,
  typesComment,
  propsOptional
}) {
  return {
    types: generateTypesFromOpenAPI({
      schema,
      name,
      fullResponse,
      fullRequest,
      optionalHeaders,
      typesComment,
      propsOptional
    }),
    implementation: generateImplementationFromOpenAPI({ name, fullResponse, fullRequest, validateResponse })
  }
}

function generateImplementationFromOpenAPI ({ name, fullResponse, fullRequest, validateResponse }) {
  const camelcasedName = toJavaScriptName(name)

  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })

  // TODO support esm
  writer.writeLine("'use strict'")
  writer.blankLine()

  writer.writeLine("const { buildOpenAPIClient } = require('@platformatic/client')")
  writer.writeLine("const { join } = require('path')")
  writer.blankLine()

  const functionName = `generate${capitalize(camelcasedName)}Client`
  writer.write(`async function ${functionName} (opts)`).block(() => {
    writer.write('return buildOpenAPIClient(').inlineBlock(() => {
      writer.writeLine("type: 'openapi',")
      writer.writeLine(`name: '${camelcasedName}',`)
      writer.writeLine(`path: join(__dirname, '${name}.openapi.json'),`)
      writer.writeLine('url: opts.url,')
      writer.writeLine('serviceId: opts.serviceId,')
      writer.writeLine('throwOnError: opts.throwOnError,')
      writer.writeLine(`fullResponse: ${fullResponse},`)
      writer.writeLine(`fullRequest: ${fullRequest},`)
      writer.writeLine(`validateResponse: ${validateResponse},`)
      writer.writeLine('getHeaders: opts.getHeaders')
    })
    writer.write(')')
  })
  writer.blankLine()
  writer.writeLine(`module.exports = ${functionName}`)
  writer.writeLine(`module.exports.default = ${functionName}`)
  return writer.toString()
}

function generateTypesFromOpenAPI ({
  schema,
  name,
  fullResponse,
  fullRequest,
  optionalHeaders,
  typesComment,
  propsOptional
}) {
  const camelcasedName = toJavaScriptName(name)
  const capitalizedName = capitalize(camelcasedName)
  const { paths } = schema
  const generatedOperationIds = []

  const operations = Object.entries(paths).flatMap(([path, methods]) => {
    let commonParameters = []
    if (methods.parameters) {
      // common parameters for all operations
      commonParameters = methods.parameters
      delete methods.parameters
    }
    return Object.entries(methods).map(([method, operation]) => {
      if (operation.parameters) {
        operation.parameters = [...operation.parameters, ...commonParameters]
      } else {
        operation.parameters = commonParameters
      }
      const opId = generateOperationId(path, method, operation, generatedOperationIds)
      return {
        path,
        method,
        operation: {
          ...operation,
          operationId: opId
        }
      }
    })
  })

  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })

  const interfaces = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })

  if (typesComment) {
    writer.writeLine(`// ${typesComment}`)
  }

  writer.writeLine(
    "import { type GetHeadersOptions, type PlatformaticClientOptions, type StatusCode1xx, type StatusCode2xx, type StatusCode3xx, type StatusCode4xx, type StatusCode5xx } from '@platformatic/client'"
  )
  writer.writeLine("import { type FormData } from 'undici'")
  writer.blankLine()

  const functionName = `generate${capitalize(camelcasedName)}Client`

  // Add always FullResponse interface because we don't know yet
  // if we are going to use it
  interfaces.write('export interface FullResponse<T, U extends number>').block(() => {
    interfaces.writeLine("'statusCode': U;")
    interfaces.writeLine("'headers': Record<string, string>;")
    interfaces.writeLine("'body': T;")
  })
  interfaces.blankLine()

  writer.write(`export type ${capitalizedName} =`).block(() => {
    writeOperations(interfaces, writer, operations, {
      fullRequest,
      fullResponse,
      optionalHeaders,
      schema,
      propsOptional
    })
  })

  writer.write(interfaces.toString())

  writer.blankLine()
  writer.writeLine(`export function ${functionName}(opts: PlatformaticClientOptions): Promise<${capitalizedName}>;`)
  writer.writeLine(`export default ${functionName};`)

  return writer.toString()
}
