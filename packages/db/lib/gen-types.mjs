import { resolve, join, dirname, basename } from 'path'
import { createRequire } from 'module'
import { mkdir, writeFile, readFile, readdir, unlink } from 'fs/promises'
import { join as desmJoin } from 'desm'
import pino from 'pino'
import pretty from 'pino-pretty'
import camelcase from 'camelcase'
import dtsgenerator, { parseSchema } from 'dtsgenerator'
import { mapSQLEntityToJSONSchema } from '@platformatic/sql-json-schema-mapper'
import { setupDB, isFileAccessible } from './utils.js'
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

async function removeUnusedTypeFiles (entities, dir) {
  const entityTypes = await readdir(dir)
  const entityNames = Object.values(entities).map((entity) => entity.name)
  const removedEntityNames = entityTypes.filter((file) => !entityNames.includes(basename(file, '.d.ts')))
  await Promise.all(removedEntityNames.map((file) => unlink(join(dir, file))))
}

async function generateEntityType (entity) {
  const jsonSchema = mapSQLEntityToJSONSchema(entity)
  jsonSchema.id = jsonSchema.$id

  const tsCode = await dtsgenerator.default({ contents: [parseSchema(jsonSchema)] })
  entity.name = camelcase(entity.name).replace(/^\w/, c => c.toUpperCase())
  return tsCode + `\nexport { ${entity.name} };\n`
}

async function generateGlobalTypes (entities, config) {
  const globalTypesImports = []
  const globalTypesInterface = []

  if (config.core.graphql) {
    globalTypesImports.push('import graphqlPlugin from \'@platformatic/sql-graphql\'')
  }

  for (const [key, entity] of Object.entries(entities)) {
    globalTypesImports.push(`import { ${entity.name} } from './types/${entity.name}'`)
    globalTypesInterface.push(`${key}: Entity<${entity.name}>,`)
  }

  return GLOBAL_TYPES_TEMPLATE
    .replace('ENTITIES_IMPORTS_PLACEHOLDER', globalTypesImports.join('\n'))
    .replace('ENTITIES_DEFINITION_PLACEHOLDER', globalTypesInterface.join('\n    '))
}

async function generateGlobalTypesFile (entities, config) {
  const globalTypes = await generateGlobalTypes(entities, config)
  await writeFileIfChanged(join(TYPES_FOLDER_PATH, '..', 'global.d.ts'), globalTypes)
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

  if (config.core.graphql) {
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

  let command = 'npm i --save'

  if (config.plugin?.typescript !== undefined) {
    command += ' @types/node'
  }
  for (const [depName, depVersion] of Object.entries(requiredDependencies)) {
    command += ` ${depName}@${depVersion}`
  }
  logger.warn(`Please run \`${command}\` to install types dependencies.`)
}

async function writeFileIfChanged (filename, content) {
  const isFileExists = await isFileAccessible(filename)
  if (isFileExists) {
    const fileContent = await readFile(filename, 'utf-8')
    if (fileContent === content) return false
  }
  await writeFile(filename, content)
  return true
}

async function execute (logger, _, config) {
  const { db, entities } = await setupDB(logger, config.core)

  const isTypeFolderExists = await isFileAccessible(TYPES_FOLDER_PATH)
  if (isTypeFolderExists) {
    await removeUnusedTypeFiles(entities, TYPES_FOLDER_PATH)
  } else {
    await mkdir(TYPES_FOLDER_PATH)
  }

  let count = 0
  for (const entity of Object.values(entities)) {
    count++
    const types = await generateEntityType(entity)

    const pathToFile = join(TYPES_FOLDER_PATH, entity.name + '.d.ts')
    const isTypeChanged = await writeFileIfChanged(pathToFile, types)

    if (isTypeChanged) {
      logger.info(`Generated type for ${entity.name} entity.`)
    }
  }
  await generateGlobalTypesFile(entities, config)
  await db.dispose()
  return count
}

async function generateTypes (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const { configManager, args } = await loadConfig({}, _args)

  await configManager.parseAndValidate()
  const config = configManager.current

  const count = await execute(logger, args, config)
  if (count === 0) {
    logger.warn('No table found. Please run `platformatic db migrations apply` to generate types.')
  }
  await checkForDependencies(logger, args, config)
}

export { execute, generateTypes, generateGlobalTypesFile, checkForDependencies }
