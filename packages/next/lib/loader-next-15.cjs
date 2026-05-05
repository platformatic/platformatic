const { resolve } = require('node:path')
const { fileURLToPath } = require('node:url')
const fs = require('node:fs')
const fsPromises = fs.promises
const generate = require('@babel/generator')
const { parse } = require('@babel/parser')
const traverse = require('@babel/traverse')
const {
  blockStatement,
  functionDeclaration,
  identifier,
  restElement,
  returnStatement,
  variableDeclaration,
  variableDeclarator
} = require('@babel/types')
const { transformSync } = require('amaro')

const originalReadFile = fsPromises.readFile
const originalReadFileSync = fs.readFileSync
const targetFile = resolve(fileURLToPath(globalThis.platformatic.root), 'next.config.ts')

const originalId = '__pltEnhanceNextConfig'

function parseSingleExpression (expr) {
  return parse(expr, { allowAwaitOutsideFunction: true }).program.body[0]
}

function createEvaluatorWrapperFunction (original) {
  return functionDeclaration(
    identifier(originalId),
    [restElement(identifier('args'))],
    blockStatement([
      parseSingleExpression("const { enhanceNextConfig } = await import('@platformatic/next')"),
      variableDeclaration('const', [variableDeclarator(identifier('original'), original)]),
      parseSingleExpression('const enhanced = await enhanceNextConfig(original, ...args)'),
      returnStatement(identifier('enhanced'))
    ]),
    false,
    true
  )
}

function transformCJS (source) {
  const ast = parse(source.toString(), { sourceType: 'module' })

  traverse.default(ast, {
    AssignmentExpression (path) {
      const { left, right } = path.node

      if (left.object.name === 'module' && left.property.name === 'exports') {
        path.node.right = createEvaluatorWrapperFunction(right)
        path.skip()
      }
    }
  })

  return generate.default(ast).code
}

function transformESM (source) {
  const ast = parse(source.toString(), { sourceType: 'module' })

  traverse.default(ast, {
    ExportDefaultDeclaration (path) {
      const declaration = path.node.declaration

      if (path.node.declaration.type === 'FunctionDeclaration') {
        path.insertBefore(
          functionDeclaration(
            identifier(originalId + 'Function'),
            declaration.params,
            declaration.body,
            declaration.generator,
            declaration.async
          )
        )

        path.node.declaration = createEvaluatorWrapperFunction(identifier(originalId + 'Function'))
      } else {
        path.node.declaration = createEvaluatorWrapperFunction(declaration)
      }
    }
  })

  return generate.default(ast).code
}

function detectFormat (code) {
  let format = 'esm'

  const ast = parse(code, { sourceType: 'module' })

  // Manipulate the AST
  traverse.default(ast, {
    AssignmentExpression (path) {
      const { left } = path.node

      // module.exports = $EXPRESSION
      if (left.object.name === 'module' && left.property.name === 'exports') {
        format = 'cjs'
        path.stop()
      }
    }
  })

  return format
}

function normalizePath (url) {
  if (typeof url === 'string' && url.startsWith('file://')) {
    return fileURLToPath(url)
  }

  return url
}

function restoreReadMethods () {
  fsPromises.readFile = originalReadFile
  fs.readFileSync = originalReadFileSync
}

async function patchNextConfigTS (contents) {
  let transformed = contents

  if (!globalThis.platformatic.config.next?.useExperimentalAdapter) {
    const { code } = transformSync(contents.toString('utf-8'), { mode: 'strip-only' })
    const transformer = detectFormat(code) === 'esm' ? transformESM : transformCJS
    transformed = transformer(code)

    restoreReadMethods()
  }

  return transformed
}

fsPromises.readFile = async function readAndPatchNextConfigTS (url, options) {
  url = normalizePath(url)

  const contents = await originalReadFile(url, options)

  if (url !== targetFile) {
    return contents
  }

  return patchNextConfigTS(contents)
}

// Next.js 16.2.3+ loads next.config.ts via next/dist/build/next-config-ts/transpile-config.js,
// which reads it synchronously before transpiling it.
fs.readFileSync = function readAndPatchNextConfigTSSync (url, options) {
  url = normalizePath(url)

  const contents = originalReadFileSync(url, options)

  if (url !== targetFile) {
    return contents
  }

  if (globalThis.platformatic.config.next?.useExperimentalAdapter) {
    return contents
  }

  const { code } = transformSync(contents.toString('utf-8'), { mode: 'strip-only' })
  const transformer = detectFormat(code) === 'esm' ? transformESM : transformCJS
  const transformed = transformer(code)

  restoreReadMethods()

  if (typeof options === 'string' || options?.encoding) {
    return transformed
  }

  return Buffer.from(transformed)
}
