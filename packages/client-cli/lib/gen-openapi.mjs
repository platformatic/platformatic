import CodeBlockWriter from 'code-block-writer'
import jsonpointer from 'jsonpointer'
import { generateOperationId, hasDuplicatedParameters } from '@platformatic/client'
import { capitalize, classCase, toJavaScriptName } from './utils.mjs'
import { STATUS_CODES } from 'node:http'

export function processOpenAPI ({ schema, name, fullResponse, fullRequest, optionalHeaders, validateResponse }) {
  return {
    types: generateTypesFromOpenAPI({ schema, name, fullResponse, fullRequest, optionalHeaders }),
    implementation: generateImplementationFromOpenAPI({ schema, name, fullResponse, fullRequest, validateResponse })
  }
}

function generateImplementationFromOpenAPI ({ schema, name, fullResponse, fullRequest, validateResponse }) {
  const camelcasedName = toJavaScriptName(name)

  /* eslint-disable new-cap */
  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })
  /* eslint-enable new-cap */

  // TODO support esm
  writer.writeLine('\'use strict\'')
  writer.blankLine()

  writer.writeLine('const pltClient = require(\'@platformatic/client\')')
  writer.writeLine('const { join } = require(\'path\')')
  writer.blankLine()

  const functionName = `generate${capitalize(camelcasedName)}ClientPlugin`
  writer.write(`async function ${functionName} (app, opts)`).block(() => {
    writer.write('app.register(pltClient, ').inlineBlock(() => {
      writer.writeLine('type: \'openapi\',')
      writer.writeLine(`name: '${camelcasedName}',`)
      writer.writeLine(`path: join(__dirname, '${name}.openapi.json'),`)
      writer.writeLine('url: opts.url,')
      writer.writeLine('serviceId: opts.serviceId,')
      writer.writeLine('throwOnError: opts.throwOnError,')
      writer.writeLine(`fullResponse: ${fullResponse},`)
      writer.writeLine(`fullRequest: ${fullRequest},`)
      writer.writeLine(`validateResponse: ${validateResponse}`)
    })
    writer.write(')')
  })
  writer.blankLine()
  writer.write(`${functionName}[Symbol.for('plugin-meta')] = `).block(() => {
    writer.writeLine(`name: '${name} OpenAPI Client'`)
  })
  writer.writeLine(`${functionName}[Symbol.for('skip-override')] = true`)
  writer.blankLine()
  writer.writeLine(`module.exports = ${functionName}`)
  writer.writeLine(`module.exports.default = ${functionName}`)
  return writer.toString()
}

function generateTypesFromOpenAPI ({ schema, name, fullResponse, fullRequest, optionalHeaders }) {
  const camelcasedName = toJavaScriptName(name)
  const capitalizedName = capitalize(camelcasedName)
  const { paths } = schema
  const generatedOperationIds = []
  const operations = Object.entries(paths).flatMap(([path, methods]) => {
    return Object.entries(methods).map(([method, operation]) => {
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
  /* eslint-disable new-cap */
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
  /* eslint-enable new-cap */

  writer.writeLine('import { type FastifyReply, type FastifyPluginAsync } from \'fastify\'')
  writer.blankLine()

  const pluginName = `${capitalizedName}Plugin`
  const optionsName = `${capitalizedName}Options`

  writer.write(`declare namespace ${capitalizedName}`).block(() => {
    // Add always FullResponse interface because we don't know yet
  // if we are going to use it
    interfaces.write('export interface FullResponse<T>').block(() => {
      interfaces.writeLine('\'statusCode\': number;')
      interfaces.writeLine('\'headers\': object;')
      interfaces.writeLine('\'body\': T;')
    })
    interfaces.blankLine()

    writer.write(`export interface ${capitalizedName}`).block(() => {
      const originalFullResponse = fullResponse
      let currentFullResponse = originalFullResponse
      for (const operation of operations) {
        const operationId = operation.operation.operationId
        const { parameters, responses, requestBody } = operation.operation
        const forceFullReqeust = fullRequest || hasDuplicatedParameters(operation.operation)
        const successResponses = Object.entries(responses).filter(([s]) => s.startsWith('2'))
        if (successResponses.length !== 1) {
          currentFullResponse = true
        }
        const operationRequestName = `${capitalize(operationId)}Request`
        const operationResponseName = `${capitalize(operationId)}Response`

        interfaces.write(`export interface ${operationRequestName}`).block(() => {
          const addedProps = new Set()
          if (parameters) {
            if (forceFullReqeust) {
              const bodyParams = []
              const queryParams = []
              const headersParams = []
              for (const parameter of parameters) {
                switch (parameter.in) {
                  case 'query':
                    queryParams.push(parameter)
                    break
                  case 'body':
                    bodyParams.push(parameter)
                    break
                  case 'header':
                    headersParams.push(parameter)
                    break
                }
              }
              writeProperties(interfaces, 'body', bodyParams, addedProps)
              writeProperties(interfaces, 'query', queryParams, addedProps)
              writeProperties(interfaces, 'headers', headersParams, addedProps)
            } else {
              for (const parameter of parameters) {
                let { name, required } = parameter
                if (optionalHeaders.includes(name)) {
                  required = false
                }
                // We do not check for addedProps here because it's the first
                // group of properties
                writeProperty(interfaces, name, parameter, addedProps, required)
              }
            }
          }
          if (requestBody) {
            writeContent(interfaces, requestBody.content, schema, addedProps)
          }
        })
        interfaces.blankLine()

        const responseTypes = successResponses.map(([statusCode, response]) => {
        // The client library will always dump bodies for 204 responses
        // so the type must be undefined
          if (statusCode === '204') {
            return 'undefined'
          }
          let isResponseArray
          let type = `${operationResponseName}${classCase(STATUS_CODES[statusCode])}`
          interfaces.write(`export interface ${type}`).block(() => {
            isResponseArray = writeContent(interfaces, response.content, schema, new Set())
          })
          interfaces.blankLine()
          if (isResponseArray) type = `Array<${type}>`
          return type
        })

        let responseType = responseTypes.join(' | ') || 'unknown'
        if (currentFullResponse) responseType = `FullResponse<${responseType}>`
        writer.writeLine(`${operationId}(req?: ${operationRequestName}): Promise<${responseType}>;`)
        currentFullResponse = originalFullResponse
      }
    })

    writer.write(`export interface ${optionsName}`).block(() => {
      writer.writeLine('url: string')
    })

    writer.writeLine(`export const ${camelcasedName}: ${pluginName};`)
    writer.writeLine(`export { ${camelcasedName} as default };`)

    writer.write(interfaces.toString())
  })

  writer.blankLine()
  writer.write(`type ${pluginName} = FastifyPluginAsync<NonNullable<${capitalizedName}.${optionsName}>>`)

  writer.blankLine()
  writer.write('declare module \'fastify\'').block(() => {
    writer.write(`interface Configure${capitalizedName}`).block(() => {
      writer.writeLine('getHeaders(req: FastifyRequest, reply: FastifyReply): Promise<Record<string,string>>;')
    })
    writer.write('interface FastifyInstance').block(() => {
      writer.quote(camelcasedName)
      writer.write(`: ${capitalizedName}.${capitalizedName};`)
      writer.newLine()

      writer.writeLine(`configure${capitalizedName}(opts: Configure${capitalizedName}): unknown`)
    })

    writer.blankLine()

    writer.write('interface FastifyRequest').block(() => {
      writer.quote(camelcasedName)
      writer.write(`: ${capitalizedName}.${capitalizedName};`)
      writer.newLine()
    })
  })

  writer.blankLine()
  console.log(interfaces.toString())

  writer.blankLine()
  writer.writeLine(`declare function ${camelcasedName}(...params: Parameters<${pluginName}>): ReturnType<${pluginName}>;`)
  writer.writeLine(`export = ${camelcasedName};`)

  return writer.toString()
}

function writeProperties (writer, blockName, parameters, addedProps) {
  if (parameters.length > 0) {
    writer.write(`${blockName}: `).block(() => {
      for (const parameter of parameters) {
        const { name, required } = parameter
        // We do not check for addedProps here because it's the first
        // group of properties
        writeProperty(writer, name, parameter, addedProps, required)
      }
    })
  }
}
function writeContent (writer, content, spec, addedProps) {
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
      // This is likely buggy as there can be multiple responses for different
      // status codes. This is currently not possible with Platformatic DB
      // services so we skip for now.
      // TODO: support different schemas for different status codes
      if (body.schema.type === 'array') {
        isResponseArray = true
        writeObjectProperties(writer, body.schema.items, spec, addedProps)
      } else {
        writeObjectProperties(writer, body.schema, spec, addedProps)
      }
      break
    }
  }
  return isResponseArray
}

function writeObjectProperties (writer, schema, spec, addedProps) {
  if (schema.$ref) {
    schema = jsonpointer.get(spec, schema.$ref.replace('#', ''))
  }
  if (schema.type === 'object') {
    for (const [key, value] of Object.entries(schema.properties)) {
      if (addedProps.has(key)) {
        continue
      }
      const required = schema.required && schema.required.includes(key)
      writeProperty(writer, key, value, addedProps, required)
    }
    // This is unlikely to happen with well-formed OpenAPI.
    /* c8 ignore next 3 */
  } else {
    throw new Error(`Type ${schema.type} not supported`)
  }
}

function writeProperty (writer, key, value, addedProps, required = true) {
  addedProps.add(key)
  if (required) {
    writer.quote(key)
  } else {
    writer.quote(key)
    writer.write('?')
  }
  writer.write(`: ${getType(value)};`)
  writer.newLine()
}

export function getType (typeDef) {
  if (typeDef.schema) {
    return getType(typeDef.schema)
  }
  if (typeDef.anyOf) {
    // recursively call this function
    return typeDef.anyOf.map((t) => {
      return getType(t)
    }).join(' | ')
  }

  if (typeDef.allOf) {
    // recursively call this function
    return typeDef.allOf.map((t) => {
      return getType(t)
    }).join(' & ')
  }
  if (typeDef.type === 'array') {
    return `Array<${getType(typeDef.items)}>`
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
      return `${prop}${required ? '' : '?'}: ${getType(typeDef.properties[prop])}`
    })
    output += props.join('; ')
    output += ' }'
    return output
  }
  return JSONSchemaToTsType(typeDef.type)
}

function JSONSchemaToTsType (type) {
  switch (type) {
    case 'string':
      return 'string'
    case 'integer':
      return 'number'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
      // TODO what other types should we support here?
      /* c8 ignore next 2 */
    default:
      return 'unknown'
  }
}
