import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'

export const addSchemaToConfig = async (logger, projectDir) => {
  const configPath = join(projectDir, 'platformatic.db.json')
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  config.$schema = './platformatic.db.schema.json'
  await writeFile(join(projectDir, 'platformatic.db.json'), JSON.stringify(config, null, 2))
}
