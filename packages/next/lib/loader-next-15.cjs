const { resolve } = require('node:path')
const { fileURLToPath } = require('node:url')
const fsPromises = require('node:fs').promises
const { transformSync } = require('amaro')
const { parse } = require('@babel/parser')
const traverse = require('@babel/traverse')

const originalReadFile = fsPromises.readFile
const targetFile = resolve(fileURLToPath(globalThis.platformatic.root), 'next.config.ts')

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

fsPromises.readFile = async function readAndPatchNextConfigTS (url, options) {
  if (url.startsWith('file://')) {
    url = fileURLToPath(url)
  }

  const contents = await originalReadFile(url, options)

  if (url !== targetFile) {
    return contents
  }

  const { code } = transformSync(contents.toString('utf-8'), { mode: 'strip-only' })

  const { transformESM, transformCJS } = await import('./loader.js')
  const transformer = detectFormat(code) === 'esm' ? transformESM : transformCJS
  const transformed = transformer(code)

  // Restore the original method
  fsPromises.readFile = originalReadFile
  return transformed
}
