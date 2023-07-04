import { isFileAccessible } from './utils.mjs'
import { writeFile } from 'fs/promises'
import { join } from 'node:path'

const gitignore = `\
dist
.DS_Store

# dotenv environment variable files
.env

# database files
*.sqlite
*.sqlite3

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# Dependency directories
node_modules/

# ctags
tags

# clinicjs
.clinic/
`
/**
 * Creates a standard Platformatic app .gitignore file
 * @param {import('pino').BaseLogger} logger Logger Interface
 * @param {string} dir Target directory
 */
export const createGitignore = async (logger, dir = '.') => {
  const gitignoreFileName = join(dir, '.gitignore')
  const isGitignoreExists = await isFileAccessible(gitignoreFileName)
  if (!isGitignoreExists) {
    await writeFile(gitignoreFileName, gitignore)
    logger.debug(`Gitignore file ${gitignoreFileName} successfully created.`)
  } else {
    logger.debug(`Gitignore file ${gitignoreFileName} found, skipping creation of gitignore file.`)
  }
}
