import CodeBlockWriter from 'code-block-writer'
import jsonpointer from 'jsonpointer'
import { generateOperationId } from '../index.js'
import { capitalize } from './utils.mjs'

export function processOpenAPI ({ schema, name }) {
  return {
    types: generateTypesFromOpenAPI({ schema, name }),
    implementation: generateImplementationFromOpenAPI({ schema, name })
  }
}

function generateImplementationFromOpenAPI ({ schema, name }) {
  /* eslint-disable new-cap */
  const writer = new CodeBlockWriter.default({
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

  const functionName = `generate${capitalize(name)}ClientPlugin`
  writer.write(`async function ${functionName} (app, opts)`).block(() => {
    writer.write('app.register(pltClient, ').inlineBlock(() => {
      writer.writeLine('type: \'openapi\',')
      writer.writeLine(`name: '${name}',`)
      writer.writeLine(`file: join(__dirname, '${name}.openapi.json'),`)
      writer.writeLine('url: opts.url')
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

function generateTypesFromOpenAPI ({ schema, name }) {
  const capitalizedName = capitalize(name)
  const { paths } = schema

  const operations = Object.entries(paths).flatMap(([path, methods]) => {
    return Object.entries(methods).map(([method, operation]) => {
      return {
        path,
        method,
        operation: {
          ...operation,
          operationId: generateOperationId(path, method, operation)
        }
      }
    })
  })
  /* eslint-disable new-cap */
  const writer = new CodeBlockWriter.default({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })

  const interfaces = new CodeBlockWriter.default({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })
  /* eslint-enable new-cap */

  interfaces.writeLine('import { FastifyPluginAsync } from \'fastify\'')
  interfaces.blankLine()

  writer.write(`interface ${capitalizedName}`).block(() => {
    for (const operation of operations) {
      const operationId = operation.operation.operationId
      const { parameters, responses, requestBody } = operation.operation
      const operationRequestName = `${capitalize(operationId)}Request`
      const operationResponseName = `${capitalize(operationId)}Response`
      interfaces.write(`interface ${operationRequestName}`).block(() => {
        const addedProps = new Set()
        if (parameters) {
          for (const parameter of parameters) {
            const { name, schema, required } = parameter
            if (addedProps.has(name)) {
              continue
            }
            writeProperty(interfaces, name, schema, addedProps, required)
          }
        }
        if (requestBody) {
          writeContent(interfaces, requestBody.content, schema, addedProps)
        }
      })
      interfaces.writeLine()
      let isResponseArray = false
      interfaces.write(`interface ${operationResponseName}`).block(() => {
        const success = responses['200']
        if (!success) {
          throw new Error(`Could not find 200 response for ${operationId}`)
        }
        isResponseArray = writeContent(interfaces, success.content, schema, new Set())
      })
      interfaces.writeLine()
      if (isResponseArray) {
        writer.writeLine(`${operationId}(req: ${operationRequestName}): Promise<Array<${operationResponseName}>>;`)
      } else {
        writer.writeLine(`${operationId}(req: ${operationRequestName}): Promise<${operationResponseName}>;`)
      }
    }
  })

  writer.blankLine()
  const pluginName = `${capitalizedName}Plugin`
  const optionsName = `${capitalizedName}Options`

  writer.write(`type ${pluginName} = FastifyPluginAsync<NonNullable<${name}.${optionsName}>>`)

  writer.blankLine()
  writer.write('declare module \'fastify\'').block(() => {
    writer.write('interface FastifyInstance').block(() => {
      writer.quote(name)
      writer.write(`: ${capitalizedName};`)
      writer.newLine()
    })

    writer.blankLine()

    writer.write('interface FastifyRequest').block(() => {
      writer.quote(name)
      writer.write(`: ${capitalizedName};`)
      writer.newLine()
    })
  })

  writer.blankLine()
  writer.write(`declare namespace ${name}`).block(() => {
    writer.write(`export interface ${optionsName}`).block(() => {
      writer.writeLine('url: string')
    })

    writer.writeLine(`export const ${name}: ${pluginName};`)
    writer.writeLine(`export { ${name} as default };`)
  })

  writer.blankLine()
  writer.writeLine(`declare function ${name}(...params: Parameters<${pluginName}>): ReturnType<${pluginName}>;`)
  writer.writeLine(`export = ${name};`)

  return interfaces.toString() + writer.toString()
}

function writeContent (writer, content, spec, addedProps) {
  let isResponseArray = false
  if (content) {
    let added = false
    for (const [contentType, body] of Object.entries(content)) {
      if (contentType !== 'application/json') {
        continue
      }
      added = true
      if (body.schema.type === 'array') {
        isResponseArray = true
        writeObjectProperties(writer, body.schema.items, spec, addedProps)
      } else {
        writeObjectProperties(writer, body.schema, spec, addedProps)
      }
      break
    }

    if (!added) {
      throw new Error('Could not find application/json body')
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
      console.log(key, value, required)
      writeProperty(writer, key, value, addedProps, required)
    }
  } else if (schema.type === 'array') {
    throw new Error('Array not supported')
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
  if (value.type === 'array') {
    writer.write(`: Array<${JSONSchemaToTsType(value.items.type)}>;`)
  } else {
    writer.write(`: ${JSONSchemaToTsType(value.type)};`)
  }
  writer.newLine()
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
    case 'array':
      throw new Error('Array not supported')
    case 'object':
      throw new Error('Object not supported')
    default:
      return 'any'
  }
}
