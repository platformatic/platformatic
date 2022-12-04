import { isFileAccessible } from './utils.mjs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const gitignore = `\
dist 
.DS_Store

# dotenv environment variable files
.env

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
`

export const createGitignore = async (logger, dir = '.') => {
  const gitignoreFileName = join(dir, '.gitignore')
  const isGitignoreExists = await isFileAccessible(gitignoreFileName)
  if (!isGitignoreExists) {
    writeFileSync(gitignoreFileName, gitignore)
    logger.debug(`Gitignore file ${gitignoreFileName} successfully created.`)
  } else {
    logger.debug(`Gitignore file ${gitignoreFileName} found, skipping creation of gitignore file.`)
  }
}
