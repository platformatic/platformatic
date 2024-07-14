#!/usr/bin/env node

'use strict'

const { join, isAbsolute, dirname } = require('node:path')
const { parseArgs } = require('node:util')
const { writeFile, readFile } = require('node:fs/promises')
const { buildGenerator } = require('typescript-json-schema')
const ts = require('typescript')

function replaceDefinitionsWitComponents (schema) {
  for (const key of Object.keys(schema)) {
    const value = schema[key]
    if (
      key === '$ref' &&
      typeof value === 'string' &&
      value.startsWith('#/definitions/')
    ) {
      schema.$ref = value.replace(
        '#/definitions/',
        '#/components/schemas/'
      )
    }
    if (typeof value === 'object') {
      replaceDefinitionsWitComponents(value)
    }
  }
}

function generateOpenApiSchema (handlers, schemas) {
  replaceDefinitionsWitComponents(schemas)

  const paths = {}

  for (const handler of handlers) {
    const routeSchema = { post: { operationId: handler.name } }

    if (handler.args) {
      routeSchema.post.requestBody = {
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${handler.args}` }
          }
        }
      }
    }

    routeSchema.post.responses = {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${handler.returnType}` }
          }
        }
      }
    }

    paths[`/${handler.name}`] = routeSchema
  }

  const openApiSchema = {
    openapi: '3.0.0',
    info: {
      title: 'Platformatic RPC',
      version: '1.0.0'
    },
    paths,
    components: {
      schemas: schemas.definitions
    }
  }
  return openApiSchema
}

function createUpdatedProgram (program, sourceFiles) {
  const compilerOptions = program.getCompilerOptions()

  const printer = ts.createPrinter()

  const defaultCompilerHost = ts.createCompilerHost(compilerOptions)
  const customCompilerHost = {
    ...defaultCompilerHost,
    getSourceFile: (fileName) => {
      const formattedFile = sourceFiles.find(file => file.fileName === fileName)
      if (formattedFile) {
        const formattedCode = printer.printFile(formattedFile)
        return ts.createSourceFile(fileName, formattedCode, formattedFile.languageVersion)
      }
      return defaultCompilerHost.getSourceFile(fileName)
    }
  }

  const newProgram = ts.createProgram({
    rootNames: program.getRootFileNames(),
    options: compilerOptions,
    host: customCompilerHost
  })

  return newProgram
}

function createTransformer () {
  const handlers = []
  const types = new Set()

  const transformer = (context) => {
    return (rootNode) => {
      const sourceFile = rootNode.getSourceFile()

      function visit (node, context) {
        const children = []

        ts.forEachChild(node, childNode => {
          if (
            ts.isCallExpression(childNode) &&
            ts.isPropertyAccessExpression(childNode.expression)
          ) {
            const functionName = childNode.expression.name.getText(sourceFile)
            if (functionName !== 'rpc') return

            const handlerNameNode = childNode.arguments[0]
            const handlerName = handlerNameNode.getText(sourceFile).slice(1, -1)
            const handler = { name: handlerName }

            const handlerNode = childNode.arguments[1]
            const handlersArgsNode = handlerNode.parameters[0]
            if (handlersArgsNode?.type) {
              const handlerArgsTypeAliasName = `${handlerName}Args`
              const handlerArgsTypeAlias = ts.factory.createTypeAliasDeclaration(
                undefined,
                ts.factory.createIdentifier(handlerArgsTypeAliasName),
                undefined,
                handlersArgsNode.type
              )
              types.add(handlerArgsTypeAliasName)
              children.push(handlerArgsTypeAlias)
              handler.args = handlerArgsTypeAliasName
            }

            const handlerReturnType = handlerNode.type?.getText(sourceFile)
            if (handlerReturnType) {
              const handlerReturnTypeAliasName = `${handlerName}ReturnType`
              const handlerReturnTypeAlias = ts.factory.createTypeAliasDeclaration(
                undefined,
                ts.factory.createIdentifier(handlerReturnTypeAliasName),
                undefined,
                handlerNode.type
              )
              types.add(handlerReturnTypeAliasName)
              children.push(handlerReturnTypeAlias)
              handler.returnType = handlerReturnTypeAliasName
            }

            handlers.push(handler)
          }
        })

        if (children.length > 0) {
          return [...children, node]
        }

        return ts.visitEachChild(node, (child) => visit(child, context), context)
      }

      return ts.visitNode(rootNode, (node) => visit(node, context))
    }
  }
  return { transformer, handlers, types }
}

async function parseTsConfig (tsConfigPath) {
  const tsConfigFile = await readFile(tsConfigPath, 'utf8')
  const tsConfigDir = dirname(tsConfigPath)

  const { config } = ts.parseConfigFileTextToJson(tsConfigPath, tsConfigFile)
  const configParseResult = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    tsConfigDir
  )

  return configParseResult
}

function getTypesSchemas (program, types) {
  const generator = buildGenerator(program, {
    ignoreErrors: true
  })
  const schemas = generator.getSchemaForSymbols(types)
  return schemas
}

async function generateRpcSchema (options) {
  const tsConfig = await parseTsConfig(options.tsConfigPath)

  const program = ts.createProgram({
    rootNames: tsConfig.fileNames,
    options: tsConfig.options
  })

  const compilerOptions = program.getCompilerOptions()

  const { transformer, handlers, types } = createTransformer(program)

  const sourceFiles = program.getSourceFiles().filter(file => !file.isDeclarationFile)
  const { transformed } = ts.transform(sourceFiles, [transformer], compilerOptions)

  const updatedProgram = createUpdatedProgram(program, transformed, compilerOptions)

  const schemas = getTypesSchemas(updatedProgram, [...types])
  const openapiSchema = generateOpenApiSchema(handlers, schemas)

  return openapiSchema
}

async function generateRpcSchemaCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      path: { type: 'string', short: 'p' },
      'ts-config': { type: 'string', short: 't', default: 'tsconfig.json' }
    },
    strict: false
  }).values

  let tsConfigPath = args['ts-config']
  if (!isAbsolute(tsConfigPath)) {
    tsConfigPath = join(process.cwd(), tsConfigPath)
  }

  let openapiSchemaPath = args.path
  if (!openapiSchemaPath) {
    throw new Error('OpenAPI schema path is required')
  }
  if (!isAbsolute(openapiSchemaPath)) {
    openapiSchemaPath = join(process.cwd(), openapiSchemaPath)
  }

  const openapiRpcSchema = await generateRpcSchema({ tsConfigPath })
  await writeFile(openapiSchemaPath, JSON.stringify(openapiRpcSchema, null, 2))
}

if (require.main === module) {
  generateRpcSchemaCommand(process.argv.slice(2))
}

module.exports = generateRpcSchemaCommand
