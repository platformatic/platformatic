import CodeBlockWriter from 'code-block-writer'
import { generateOperationId } from '@platformatic/client'
import { capitalize, toJavaScriptName } from './utils.mjs'
import { writeOperations } from './openapi-common.mjs'

export function processOpenAPI ({ schema, name, fullResponse, fullRequest, optionalHeaders, validateResponse }) {
  return {
    types: generateTypesFromOpenAPI({ schema, name, fullResponse, fullRequest, optionalHeaders }),
    implementation: generateImplementationFromOpenAPI({ name, fullResponse, fullRequest, validateResponse })
  }
}

function generateImplementationFromOpenAPI ({ name, fullResponse, fullRequest, validateResponse }) {
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

  writer.write(`declare namespace ${camelcasedName}`).block(() => {
    // Add always FullResponse interface because we don't know yet
  // if we are going to use it
    interfaces.write('export interface FullResponse<T>').block(() => {
      interfaces.writeLine('\'statusCode\': number;')
      interfaces.writeLine('\'headers\': Record<string, string>;')
      interfaces.writeLine('\'body\': T;')
    })
    interfaces.blankLine()

    writer.write(`export interface ${capitalizedName}`).block(() => {
      writeOperations(interfaces, writer, operations, {
        fullRequest, fullResponse, optionalHeaders, schema
      })
    })

    writer.write(`export interface ${optionsName}`).block(() => {
      writer.writeLine('url: string')
    })

    writer.writeLine(`export const ${camelcasedName}: ${pluginName};`)
    writer.writeLine(`export { ${camelcasedName} as default };`)

    writer.write(interfaces.toString())
  })

  writer.blankLine()
  writer.write(`type ${pluginName} = FastifyPluginAsync<NonNullable<${camelcasedName}.${optionsName}>>`)

  writer.blankLine()
  writer.write('declare module \'fastify\'').block(() => {
    writer.write(`interface Configure${capitalizedName}`).block(() => {
      writer.writeLine('getHeaders(req: FastifyRequest, reply: FastifyReply): Promise<Record<string,string>>;')
    })
    writer.write('interface FastifyInstance').block(() => {
      writer.quote(camelcasedName)
      writer.write(`: ${camelcasedName}.${capitalizedName};`)
      writer.newLine()

      writer.writeLine(`configure${capitalizedName}(opts: Configure${capitalizedName}): unknown`)
    })

    writer.blankLine()

    writer.write('interface FastifyRequest').block(() => {
      writer.quote(camelcasedName)
      writer.write(`: ${camelcasedName}.${capitalizedName};`)
      writer.newLine()
    })
  })

  writer.blankLine()
  writer.writeLine(`declare function ${camelcasedName}(...params: Parameters<${pluginName}>): ReturnType<${pluginName}>;`)
  writer.writeLine(`export = ${camelcasedName};`)

  return writer.toString()
}
