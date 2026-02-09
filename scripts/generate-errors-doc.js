import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function extractErrors (module) {
  const { errors } = module
  const ret = []
  for (const error in errors) {
    const ErrorFunc = errors[error]

    try {
      const err = new ErrorFunc()
      const code = err.code

      if (!code) {
        continue
      }
      const fastifyErrorHeader = `FastifyError [${code}]:`
      const message = err.toString().replace(fastifyErrorHeader, '').trim()
      ret.push({ code, message })
    } catch (err) {}
  }
  return ret
}

function createErrorsMD (errorsByModule) {
  const md = []
  md.push('# Platformatic Errors \n')
  for (const module in errorsByModule) {
    const errors = errorsByModule[module]

    if (errors.length === 0) {
      continue
    }

    md.push(`## ${module} \n`)

    for (const error of errors) {
      const { code, message } = error
      md.push(`### ${code}`)
      md.push(`**Message:** ${message} \n`)
    }
  }
  return md.join('\n')
}

async function generateErrorsMDFile (errorsByModule) {
  const errorsMd = createErrorsMD(errorsByModule)
  const mdPath = resolve(__dirname, '../docs/packages/errors.md')
  await writeFile(mdPath, errorsMd)
  console.log(`Errors documentation file generated at ${mdPath}`)
}

async function getErrorsByModule () {
  const allPackages = await readdir(resolve(__dirname, '../packages'))
  allPackages.sort()

  const errorsByModule = {}
  for (const path of allPackages) {
    const root = resolve(__dirname, '../packages', path)

    let moduleInfo
    try {
      moduleInfo = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
    } catch (err) {
      continue
    }

    if (!moduleInfo.main) {
      console.warn(`Skipping ${moduleInfo.name} as it does not have a main entry in package.json`)
      continue
    }

    const pkg = await import(resolve(root, moduleInfo.main))
    const errors = extractErrors(pkg)
    errorsByModule[moduleInfo.name] = errors
  }
  return errorsByModule
}

async function generate () {
  const errorsByModule = await getErrorsByModule()
  await generateErrorsMDFile(errorsByModule)
}

generate()
