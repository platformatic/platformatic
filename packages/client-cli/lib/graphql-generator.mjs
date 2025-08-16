import CodeBlockWriter from 'code-block-writer'
import errors from './errors.mjs'
import { capitalize, toJavaScriptName } from './utils.mjs'

export function processGraphQL ({ schema, name, folder, url }) {
  schema = schema.__schema
  return {
    types: generateTypesFromGraphQL({ schema, name }),
    implementation: generateImplementationFromGraqhQL({ schema, name, url })
  }
}

const skip = new Set(['Query', 'Mutation', 'Subscription', 'Boolean', 'String'])

function generateTypesFromGraphQL ({ schema, name }) {
  const camelcasedName = toJavaScriptName(name)

  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })

  const functionName = `generate${capitalize(camelcasedName)}Client`

  writer.writeLine("import { type PlatformaticClientOptions } from '@platformatic/client'")
  writer.blankLine()

  writer.write('interface GraphQLQueryOptions').block(() => {
    writer.writeLine('query: string;')
    writer.writeLine('headers: Record<string, string>;')
    writer.writeLine('variables: Record<string, unknown>;')
  })

  writer.write('interface GraphQLClient').block(() => {
    writer.writeLine('graphql<T>(options: GraphQLQueryOptions): PromiseLike<T>;')
  })
  writer.blankLine()

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

  writer.write('interface GraphQLClient').block(() => {
    writer.writeLine('graphql<T>(GraphQLQuery): Promise<T>;')
  })

  writer.blankLine()
  writer.writeLine(`export function ${functionName}(opts: PlatformaticClientOptions): Promise<GraphQLClient>;`)
  writer.writeLine(`export default ${functionName};`)

  return writer.toString()
}

function generateImplementationFromGraqhQL ({ name, url }) {
  const camelcasedName = toJavaScriptName(name)

  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })

  // TODO support esm
  writer.writeLine("'use strict'")
  writer.blankLine()

  writer.writeLine("const { buildGraphQLClient } = require('@platformatic/client')")
  writer.writeLine("const { join } = require('path')")
  writer.blankLine()

  url = new URL(url)

  const functionName = `generate${capitalize(camelcasedName)}Client`
  writer.write(`async function ${functionName} (opts)`).block(() => {
    writer.writeLine('const url = new URL(opts.url)')
    writer.writeLine(`url.pathname = '${url.pathname}'`)
    writer.write('return buildGraphQLClient(').inlineBlock(() => {
      writer.writeLine("type: 'graphql',")
      writer.writeLine(`name: '${camelcasedName}',`)
      writer.writeLine(`path: join(__dirname, '${name}.schema.graphql'),`)
      writer.writeLine('serviceId: opts.serviceId,')
      writer.writeLine('url: url.toString()')
    })
    writer.write(')')
  })
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
      throw new errors.UnknownTypeError(type)
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
    throw new errors.UnknownTypeError(value.kind)
  }
  writer.newLine()
}
