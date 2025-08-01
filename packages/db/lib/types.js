import { mapOpenAPItoTypes, mapSQLEntityToJSONSchema } from '@platformatic/sql-json-schema-mapper'
import { createDirectory, isFileAccessible } from '@platformatic/utils'
import camelcase from 'camelcase'
import { readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import { setupDB } from './utils.js'

async function removeUnusedTypeFiles (entities, dir) {
  const entityTypes = await readdir(dir)
  const entityNames = Object.keys(entities)
  const removedEntityNames = entityTypes.filter(
    file => file !== 'index.d.ts' && !entityNames.includes(basename(file, '.d.ts'))
  )
  await Promise.all(removedEntityNames.map(file => unlink(join(dir, file))))
}

async function generateEntityType (entity) {
  const jsonSchema = mapSQLEntityToJSONSchema(entity)
  const fieldDefinitions = Object.fromEntries(
    Object.entries(entity.fields).map(([, value]) => [value.camelcase, value])
  )

  const tsCode = mapOpenAPItoTypes(jsonSchema, fieldDefinitions, { indentSpaces: 2 })

  entity.name = camelcase(entity.name).replace(/^\w/, c => c.toUpperCase())
  return tsCode.replaceAll(/^declare interface/gm, 'export interface')
}

async function generateIndexTypes (entities) {
  const allImports = []
  const allExports = []
  const entityMembers = []
  const entityTypesMembers = []
  const entitiesHooks = []
  const schemaGetters = []

  const values = Object.entries(entities)
    .map(([file, entity]) => [file, entity.name])
    .sort((a, b) => a[0].localeCompare(b[0]))

  for (const [name, type] of values) {
    allImports.push(`import { ${type} } from './${name}'`)
    allExports.push(`export { ${type} } from './${name}'`)
    entityMembers.push(`  ${name}: Entity<${type}>`)
    entityTypesMembers.push(`  ${name}: ${type}`)
    entitiesHooks.push(`  addEntityHooks(entityName: '${name}', hooks: EntityHooks<${type}>): any`)
    schemaGetters.push(`getSchema(schemaId: '${name}'): {
    '$id': string,
    title: string,
    description: string,
    type: string,
    properties: { [x in keyof ${type}]: { type: string, nullable?: boolean } },
    required: string[]
  }`)
  }

  const content = `import { Entity, EntityHooks, Entities as DatabaseEntities, PlatformaticDatabaseConfig, PlatformaticDatabaseMixin } from '@platformatic/db'
import { PlatformaticApplication, PlatformaticServiceConfig } from '@platformatic/service'
import { FastifyInstance } from 'fastify'

${allImports.join('\n')}

${allExports.join('\n')}

export interface Entities extends DatabaseEntities {
${entityMembers.join('\n')}
}

export interface EntityTypes {
${entityTypesMembers.join('\n')}
}

export interface EntitiesHooks {
${entitiesHooks.join('\n')}
}

export interface SchemaGetters {
  ${schemaGetters.join('\n\n')}
}

export type ServerInstance<Configuration = PlatformaticDatabaseConfig> = FastifyInstance & {
  platformatic: PlatformaticApplication<Configuration> & PlatformaticDatabaseMixin<Entities> & EntitiesHooks & SchemaGetters
}
`

  return content
}

function generateEnvironmentTypes (folder) {
  return `import { PlatformaticApplication, PlatformaticDatabaseConfig, PlatformaticDatabaseMixin } from "@platformatic/db";
import { Entities, EntitiesHooks, SchemaGetters } from "./${folder.replaceAll(sep, '/')}/index.js";

declare module "fastify" {
  interface FastifyInstance {
    platformatic: PlatformaticApplication<PlatformaticDatabaseConfig> & PlatformaticDatabaseMixin<Entities> & EntitiesHooks & SchemaGetters;
  }
}
`
}

async function writeFileIfChanged (filename, content) {
  const isFileExists = await isFileAccessible(filename)

  if (isFileExists) {
    const fileContent = await readFile(filename, 'utf-8')
    if (fileContent === content) {
      return false
    }
  }

  await writeFile(filename, content)
  return true
}

export async function execute ({ logger, config }) {
  const wrap = await setupDB(logger, config.db)
  const { db, entities } = wrap

  const count = Object.keys(entities).length
  if (count === 0) {
    // do not generate types if no schema is found
    return 0
  }

  const typesFolderPath = resolve(process.cwd(), config.types?.dir ?? 'types')

  // Prepare the types folder
  if (await isFileAccessible(typesFolderPath)) {
    await removeUnusedTypeFiles(entities, typesFolderPath)
  } else {
    await createDirectory(typesFolderPath)
  }

  // Generate all entities
  for (const [name, entity] of Object.entries(entities)) {
    const types = await generateEntityType(entity)
    const pathToFile = join(typesFolderPath, name + '.d.ts')

    if (await writeFileIfChanged(pathToFile, types)) {
      logger.info(`Generated type for ${entity.name} entity.`)
    }
  }

  // Generate index.d.ts
  const indexFilePath = join(typesFolderPath, 'index.d.ts')
  const indexTypes = await generateIndexTypes(entities)
  if (await writeFileIfChanged(indexFilePath, indexTypes)) {
    logger.info('Regenerated index.d.ts.')
  }

  // Generate plt-env.d.ts
  const environmentPath = join(process.cwd(), 'plt-env.d.ts')
  const pltEnvironment = await generateEnvironmentTypes(relative(process.cwd(), typesFolderPath))
  if (await writeFileIfChanged(environmentPath, pltEnvironment)) {
    logger.info('Regenerated plt-env.d.ts.')
  }

  await db.dispose()
  return count
}
