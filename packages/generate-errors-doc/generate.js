'use strict'

const { writeFile } = require('fs').promises
const { join } = require('path')

// Add the modules here. Remember to add the dependency to package.json
const modules = [
  '@platformatic/sql-mapper'
]

// We assume the function is in the form of:
// function (pkType, validTypes) { return createError(`${ERROR_PREFIX}_INVALID_PRIMARY_KEY_TYPE`, 'Invalid Primary Key type: "%s". We support the following: %s')(pkType, validTypes) }
const parseErrorFunction = (fn) => {
  const src = fn.toString()
  const functionDecl = src.match(/^function\s*[^(]*\(\s*([^)]*)\)/m)[1]
  const params = functionDecl ? functionDecl.trim().split(',') : []
  const body = src.match(/{([\s\S]*)}/m)[1]
  const message = body.match(/'([^`]+)'/)[0]
  return { params, message }
}

const extractErrors = (module) => {
  const { errors } = module
  const ret = []
  for (const error in errors) {
    const ErrorFunc = errors[error]
    const err = new ErrorFunc()
    const code = err.code
    const { params, message } = parseErrorFunction(ErrorFunc)
    ret.push({ code, params, message })
  }
  return ret
}

const createErrorsMD = (errorsByModule) => {
  const md = []
  md.push('# Platformatic Errors')
  md.push('\n')
  for (const module in errorsByModule) {
    md.push(`## ${module}`)
    md.push('\n')
    const errors = errorsByModule[module]
    for (const error of errors) {
      const { code, params, message } = error
      md.push(`### ${code}`)
      md.push(`\n- **Message:** ${message}`)
      md.push(`- **Params :** ${params.join(', ')}`)
      md.push('\n')
    }
    md.join('\n')
  }
  return md.join('\n')
}

const generateErrorsMDFile = async (errorsByModule) => {
  const errorsMd = createErrorsMD(errorsByModule)
  const mdPath = join(__dirname, '..', '..', 'ERRORS.md')
  await writeFile(mdPath, errorsMd)
  console.log(`Errors documentation file generated at ${mdPath}`)
}

const errorsByModule = {}
for (const module of modules) {
  const mod = require(module)
  const errors = extractErrors(mod)
  errorsByModule[module] = errors
}

generateErrorsMDFile(errorsByModule)
