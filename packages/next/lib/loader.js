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
import { readFile, realpath } from 'node:fs/promises'
import { sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const originalId = '__pltOriginalNextConfig'

let config
let candidates
let basePath = ''

function parseSingleExpression (expr) {
  return parse(expr, { allowAwaitOutsideFunction: true }).program.body[0]
}

/*
  Generates:
  async function (...args) {
    let __pltOriginalNextConfig = $ORIGINAL;

    if (typeof __pltOriginalNextConfig === 'function') {
      __pltOriginalNextConfig = await __pltOriginalNextConfig(...args);
    }

    if(typeof __pltOriginalNextConfig.basePath === 'undefined') {
      __pltOriginalNextConfig.basePath = basePath
    }

    if(typeof __pltOriginalNextConfig.cacheHandler === 'undefined') {
      __pltOriginalNextConfig.cacheHandler = $PATH
      __pltOriginalNextConfig.cacheMaxMemorySize = 0
    }

    // This is to send the configuraion when Next is executed in a child process
    globalThis.platformatic.notifyConfig(__pltOriginalNextConfig)

    return __pltOriginalNextConfig;
  }
*/
function createEvaluatorWrapperFunction (original) {
  const cacheHandler = config?.cache?.adapter
    ? fileURLToPath(new URL(`./caching/${config.cache.adapter}.js`, import.meta.url)).replaceAll(sep, '/')
    : undefined

  const trailingSlash = config?.next?.trailingSlash

  return functionDeclaration(
    null,
    [restElement(identifier('args'))],
    blockStatement(
      [
        // This is to avoid https://github.com/vercel/next.js/issues/76981
        parseSingleExpression("Headers.prototype[Symbol.for('nodejs.util.inspect.custom')] = undefined"),
        variableDeclaration('let', [variableDeclarator(identifier(originalId), original)]),
        parseSingleExpression(
          `if (typeof ${originalId} === 'function') { ${originalId} = await ${originalId}(...args) }`
        ),
        parseSingleExpression(
          `if (typeof ${originalId}.basePath === 'undefined') { ${originalId}.basePath = "${basePath}" }`
        ),
        cacheHandler
          ? parseSingleExpression(`
              if (typeof ${originalId}.cacheHandler === 'undefined') {
                ${originalId}.cacheHandler = '${cacheHandler}'
                ${originalId}.cacheMaxMemorySize = 0
              }  
            `)
          : undefined,
        trailingSlash
          ? parseSingleExpression(`
              if (typeof ${originalId}.trailingSlash === 'undefined') { 
                ${originalId}.trailingSlash = true
              }
            `)
          : undefined,
        parseSingleExpression(`globalThis.platformatic.notifyConfig(${originalId})`),
        returnStatement(identifier(originalId))
      ].filter(e => e)
    ),
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

  // Keep in sync with https://github.com/vercel/next.js/blob/main/packages/next/src/shared/lib/constants.ts
  candidates = ['next.config.js', 'next.config.mjs'].map(c => new URL(c, realRoot).toString())
  basePath = data.basePath ?? ''
  config = data.config
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

  if (result.format === 'commonjs') {
    await readFile(new URL(result.responseURL ?? url), 'utf-8')
    result.source = transformCJS(result.source ?? (await readFile(new URL(result.responseURL ?? url), 'utf-8')))
  } else {
    result.source = transformESM(result.source)
  }

  return result
}
