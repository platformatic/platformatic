import generate from '@babel/generator'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import {
  blockStatement,
  functionDeclaration,
  identifier,
  restElement,
  returnStatement,
  variableDeclaration,
  variableDeclarator
} from '@babel/types'
import { transformSync } from 'amaro'
import { readFile, realpath } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const originalId = '__pltEnhanceNextConfig'
let candidates = ['next.config.ts', 'next.config.js', 'next.config.cjs', 'next.config.mjs']

function parseSingleExpression (expr) {
  return parse(expr, { allowAwaitOutsideFunction: true }).program.body[0]
}

function createEvaluatorWrapperFunction (original) {
  return functionDeclaration(
    identifier(originalId),
    [restElement(identifier('args'))],
    blockStatement([
      parseSingleExpression("const { enhanceNextConfig } = await import('@platformatic/vinext')"),
      variableDeclaration('const', [variableDeclarator(identifier('original'), original)]),
      parseSingleExpression('const enhanced = await enhanceNextConfig(original, ...args)'),
      returnStatement(identifier('enhanced'))
    ]),
    false,
    true
  )
}

export function transformCJS (source) {
  const ast = parse(source.toString(), { sourceType: 'module' })

  // Manipulate the AST
  traverse.default(ast, {
    AssignmentExpression (path) {
      const { left, right } = path.node

      // module.exports = $EXPRESSION
      if (left.object.name === 'module' && left.property.name === 'exports') {
        path.node.right = createEvaluatorWrapperFunction(right)
        path.skip()
      }
    }
  })

  return generate.default(ast).code
}

export function transformESM (source) {
  const ast = parse(source.toString(), { sourceType: 'module' })

  // Manipulate the AST
  traverse.default(ast, {
    ExportDefaultDeclaration (path) {
      const declaration = path.node.declaration

      // export default [async] function
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
        // export default $EXPRESSION
        path.node.declaration = createEvaluatorWrapperFunction(declaration)
      }
    }
  })

  return generate.default(ast).code
}

export async function initialize (data) {
  const realRoot = pathToFileURL(await realpath(fileURLToPath(data.root)))

  if (!realRoot.pathname.endsWith('/')) {
    realRoot.pathname += '/'
  }

  if (data.config.next?.useExperimentalAdapter === true) {
    return
  }

  candidates = candidates.map(c => new URL(c, realRoot).toString())
}

export async function load (url, context, nextLoad) {
  // Load the original file
  const result = await nextLoad(url, context)

  if (!url.startsWith('file:')) {
    return result
  }

  url = pathToFileURL(await realpath(fileURLToPath(url))).toString()

  if (!candidates.includes(url)) {
    return result
  }

  result.format = result.format.replace('-typescript', '')
  result.source = transformSync(result.source.toString('utf-8'), { mode: 'strip-only' }).code

  if (result.format === 'commonjs') {
    result.source = transformCJS(result.source ?? (await readFile(new URL(result.responseURL ?? url), 'utf-8')))
  } else {
    result.source = transformESM(result.source)
  }

  return result
}
