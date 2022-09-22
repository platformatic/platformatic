import { resolve, join, dirname } from 'path'
import { createRequire } from 'module'
import { access, mkdir, writeFile, readFile, readdir, unlink } from 'fs/promises'
import { join as desmJoin } from 'desm'
import pino from 'pino'
import pretty from 'pino-pretty'
import dtsgenerator, { parseSchema } from 'dtsgenerator'
import { mapSQLEntityToJSONSchema } from '@platformatic/sql-json-schema-mapper'
import { setupDB } from './utils.js'
import loadConfig from './load-config.mjs'

const TYPES_FOLDER_PATH = resolve(process.cwd(), 'types')

const GLOBAL_TYPES_TEMPLATE = `\
import { Entity } from '@platformatic/sql-mapper';
ENTITIES_IMPORTS_PLACEHOLDER

declare module '@platformatic/sql-mapper' {
  interface Entities {
    ENTITIES_DEFINITION_PLACEHOLDER
  }
}
`

async function isFileAccessible (filename) {
  try {
    await access(filename)
    return true
  } catch (err) {
    return false
  }
}

async function removeAllFilesFromDir (dir) {
  const files = await readdir(dir)
  await Promise.all(files.map((file) => unlink(join(dir, file))))
}

async function generateEntityType (entity) {
  const jsonSchema = mapSQLEntityToJSONSchema(entity)
  jsonSchema.id = jsonSchema.$id

  const tsCode = await dtsgenerator.default({ contents: [parseSchema(jsonSchema)] })
  return tsCode + `\nexport { ${entity.name} };\n`
}

async function generateGlobalTypes (entities, config) {
  const globalTypesImports = []
  const globalTypesInterface = []

  if (config.core.graphiql) {
    globalTypesImports.push('import graphqlPlugin from \'@platformatic/sql-graphql\';')
  }

  for (const [key, entity] of Object.entries(entities)) {
    globalTypesImports.push(`import { ${entity.name} } from './types/${entity.name}'`)
    globalTypesInterface.push(`${key}: Entity<${entity.name}>,`)
  }

  return GLOBAL_TYPES_TEMPLATE
    .replace('ENTITIES_IMPORTS_PLACEHOLDER', globalTypesImports.join('\n'))
    .replace('ENTITIES_DEFINITION_PLACEHOLDER', globalTypesInterface.join('\n    '))
}

async function getDependencyVersion (dependencyName) {
  const require = createRequire(import.meta.url)
  const pathToPackageJson = join(dirname(require.resolve(dependencyName)), 'package.json')
  const packageJsonFile = await readFile(pathToPackageJson, 'utf-8')
  const packageJson = JSON.parse(packageJsonFile)
  return packageJson.version
}

async function getPlatformaticPackageVersion (packageFolderName) {
  const pathToPackageJson = desmJoin(import.meta.url, '..', '..', packageFolderName, 'package.json')
  const packageJsonFile = await readFile(pathToPackageJson, 'utf-8')
  const packageJson = JSON.parse(packageJsonFile)
  return packageJson.version
}

function hasDependency (packageJson, dependencyName) {
  const dependencies = packageJson.dependencies || {}
  const devDependencies = packageJson.devDependencies || {}

  return dependencies[dependencyName] !== undefined ||
    devDependencies[dependencyName] !== undefined
}

async function checkForDependencies (logger, args, config) {
  const requiredDependencies = {}
  requiredDependencies.fastify = await getDependencyVersion('fastify')
  requiredDependencies['@platformatic/sql-mapper'] = await getPlatformaticPackageVersion('sql-mapper')

  if (config.core.graphiql) {
    requiredDependencies['@platformatic/sql-graphql'] = await getPlatformaticPackageVersion('sql-graphql')
  }

  const packageJsonPath = resolve(process.cwd(), 'package.json')
  const isPackageJsonExists = await isFileAccessible(packageJsonPath)

  if (isPackageJsonExists) {
    const packageJsonFile = await readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonFile)

    let allRequiredDependenciesInstalled = true
    for (const dependencyName in requiredDependencies) {
      if (!hasDependency(packageJson, dependencyName)) {
        allRequiredDependenciesInstalled = false
        break
      }
    }

    if (allRequiredDependenciesInstalled) return
  }

  let command = 'npm i --save-dev'
  for (const [depName, depVersion] of Object.entries(requiredDependencies)) {
    command += ` ${depName}@${depVersion}`
  }
  logger.warn(`Please run \`${command}\` to install types dependencies.`)
}

async function execute (logger, args, config) {
  const { db, entities } = await setupDB(logger, config.core)

  const isTypeFolderExists = await isFileAccessible(TYPES_FOLDER_PATH)
  if (isTypeFolderExists) {
    await removeAllFilesFromDir(TYPES_FOLDER_PATH)
  } else {
    await mkdir(TYPES_FOLDER_PATH)
  }

  for (const entity of Object.values(entities)) {
    logger.info(`Generating types for ${entity.name}`)

    const types = await generateEntityType(entity)

    const pathToFile = join(TYPES_FOLDER_PATH, entity.name + '.d.ts')
    await writeFile(pathToFile, types)
  }

  const globalTypes = await generateGlobalTypes(entities, config)
  await writeFile(join(TYPES_FOLDER_PATH, '..', 'global.d.ts'), globalTypes)

  await db.dispose()
}

async function generateTypes (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const { configManager, args } = await loadConfig({}, _args)

  await configManager.parseAndValidate()
  const config = configManager.current

  await execute(logger, args, config)
  await checkForDependencies(logger, args, config)
}

export { execute, generateTypes, checkForDependencies }
