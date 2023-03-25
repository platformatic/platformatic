import CodeBlockWriter from 'code-block-writer'
import { capitalize } from './utils.mjs'

export function processGraphQL ({ schema, name, folder, url }) {
  schema = schema.__schema
  return {
    types: generateTypesFromGraphQL({ schema, name }),
    implementation: generateImplementationFromGraqhQL({ schema, name, url })
  }
}

const skip = new Set([
  'Query',
  'Mutation',
  'Subscription',
  'Boolean',
  'String'
])

function generateTypesFromGraphQL ({ schema, name }) {
  const capitalizedName = capitalize(name)
  /* eslint-disable new-cap */
  const writer = new CodeBlockWriter.default({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })
  /* eslint-enable new-cap */

  writer.writeLine('import { FastifyPluginAsync } from \'fastify\'')
  writer.blankLine()

  const pluginname = `${capitalizedName}plugin`
  const optionsname = `${capitalizedName}options`

  writer.write(`type ${pluginname} = FastifyPluginAsync<NonNullable<${name}.${optionsname}>>`)

  writer.blankLine()
  writer.write('declare module \'fastify\'').block(() => {
    writer.write('interface GraphQLQueryOptions').block(() => {
      writer.writeLine('query: string;')
      writer.writeLine('headers: Record<string, string>;')
      writer.writeLine('variables: Record<string, unknown>;')
    })

    writer.write('interface GraphQLClient').block(() => {
      writer.writeLine('graphql<T>(GraphQLQuery): PromiseLike<T>;')
    })

    writer.write(`interface Configure${capitalizedName}`).block(() => {
      writer.writeLine('async getHeaders(req: FastifyRequest, reply: FastifyReply): Promise<Record<string,string>>;')
    })

    writer.write('interface FastifyInstance').block(() => {
      writer.quote(name)
      writer.writeLine(': GraphQLClient;')
      writer.newLine()

      writer.writeLine(`configure${capitalizedName}(opts: Configure${capitalizedName}): unknown`)
    })

    writer.blankLine()

    writer.write('interface FastifyRequest').block(() => {
      writer.quote(name)
      writer.writeLine(': GraphQLClient;')
      writer.newLine()
    })
  })

  writer.blankLine()
  writer.write(`declare namespace ${name}`).block(() => {
    writer.write(`export interface ${optionsname}`).block(() => {
      writer.writeLine('url: string')
    })

    for (const type of schema.types) {
      if (type.kind === 'OBJECT' && type.name.indexOf('__') === -1 && !skip.has(type.name)) {
        const capitalizedName = capitalize(type.name)
        writer.write(`export interface ${capitalizedName}`).block(() => {
          const addedProps = new Set()
          for (const field of type.fields) {
            writeProperty(writer, field.name, field.type, addedProps)
          }
        })
      }
    }

    writer.writeLine(`export const ${name}: ${pluginname};`)
    writer.writeLine(`export { ${name} as default };`)
  })

  writer.blankLine()
  writer.writeLine(`declare function ${name}(...params: Parameters<${pluginname}>): ReturnType<${pluginname}>;`)
  writer.writeLine(`export = ${name};`)
  return writer.toString()
}

function generateImplementationFromGraqhQL ({ name, url }) {
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

  url = new URL(url)

  const functionName = `generate${capitalize(name)}ClientPlugin`
  writer.write(`async function ${functionName} (app, opts)`).block(() => {
    writer.writeLine('const url = new URL(opts.url)')
    writer.writeLine(`url.pathname = '${url.pathname}'`)
    writer.write('app.register(pltClient, ').inlineBlock(() => {
      writer.writeLine('type: \'graphql\',')
      writer.writeLine(`name: '${name}',`)
      writer.writeLine(`path: join(__dirname, '${name}.schema.graphql'),`)
      writer.writeLine('url: url.toString()')
    })
    writer.write(')')
  })
  writer.blankLine()
  writer.write(`${functionName}[Symbol.for('plugin-meta')] = `).block(() => {
    writer.writeLine(`name: '${name} GraphQL Client'`)
  })
  writer.writeLine(`${functionName}[Symbol.for('skip-override')] = true`)
  writer.blankLine()
  writer.writeLine(`module.exports = ${functionName}`)
  writer.writeLine(`module.exports.default = ${functionName}`)
  return writer.toString()
}

function GraphQLScalarToTsType (type) {
  switch (type) {
    case 'String':
      return 'string'
    case 'ID':
      return 'string'
    case 'Int':
      return 'number'
    case 'Float':
      return 'number'
    case 'Date':
      return 'string'
    case 'DateTime':
      return 'string'
      // TODO test other scalar types
      /* c8 ignore next 3 */
    default:
      throw new Error(`Unknown type ${type}`)
  }
}

function writeProperty (writer, key, value, addedProps) {
  addedProps.add(key)
  writer.quote(key)
  writer.write('?')
  if (value.kind === 'SCALAR') {
    writer.write(`: ${GraphQLScalarToTsType(value.name)};`)
    writer.newLine()
  } else if (value.kind === 'LIST') {
    writer.write(`: Array<${capitalize(value.ofType.name)}>;`)
    writer.newLine()
  } else if (value.kind === 'OBJECT') {
    writer.write(`: ${capitalize(value.name)};`)
    writer.newLine()
    // TODO are there other kinds that needs to be handled?
    /* c8 ignore next 3 */
  } else {
    throw new Error(`Unknown type ${value.kind}`)
  }
  writer.newLine()
}
