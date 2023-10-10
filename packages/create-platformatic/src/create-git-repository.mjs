import { execa } from 'execa'

export const GIT_FIRST_COMMIT_MESSAGE = 'Platformatic project started! 🚀'
export const GIT_MAIN_BRANCH = 'main'

/**
 * Creates a Git repository and performs the initial commit if it doesn't already exist.
 *
 * This function checks if Git is installed, initializes a Git repository in the specified
 * directory if it's not already a Git repository, and performs the initial commit.
 *
 * @param {import('pino.').BaseLogger} logger - The logger interface for logging messages.
 * @param {string} [dir='.'] - The target directory where the Git repository should be created.
 */
export async function createGitRepository (logger, dir = '.') {
  if (!await isGitInstalled()) {
    logger.error('Git is not installed')
    return
  }

  if (!await gitInit(logger, dir)) {
    return
  }

  if (!await gitCommit(logger, dir)) {
    return
  }

  logger.info('Git repository initialized.')
}

/**
 * Checks if Git is installed on the system.
 *
 * @async
 * @returns {Promise<boolean>} A Promise that resolves to true if Git is installed, false otherwise.
 */
async function isGitInstalled () {
  try {
    await execa('git', ['--version'])
    return true
  } catch (err) {
    return false
  }
}

/**
 * Checks if a Git repository exists in the specified directory.
 *
 * @async
 * @param {string} dir - The directory to check for a Git repository.
 * @returns {Promise<boolean>} A Promise that resolves to true if a Git repository exists in the directory, false otherwise.
 */
async function doesGitRepositoryExist (dir) {
  try {
    await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd: dir })
    return true
  } catch (e) {
    return false
  }
}

/**
 * Initializes a Git repository in the specified directory if it doesn't already exist.
 *
 * @async
 * @param {import('pino.').BaseLogger} - The logger object for logging messages.
 * @param {string} dir - The directory where the Git repository should be initialized.
 * @returns {Promise<boolean>} A Promise that resolves to true if the Git repository is successfully initialized, false otherwise.
 */
async function gitInit (logger, dir) {
  try {
    if (await doesGitRepositoryExist(dir)) {
      logger.info('Git repository already exists.')
      return false
    }

    await execa('git', ['init', '-b', GIT_MAIN_BRANCH], { cwd: dir })
    logger.debug('Git repository initialized.')
    return true
  } catch (err) {
    logger.error('Git repository init failed.', err)
    return false
  }
}

/**
 * Commits changes in a Git repository located in the specified directory.
 *
 * @async
 * @param {import('pino.').BaseLogger} - The logger object for logging messages.
 * @param {string} dir - The directory of the Git repository where changes should be committed.
 * @returns {Promise<boolean>} A Promise that resolves to true if the Git commit is successful, false otherwise.
 */
async function gitCommit (logger, dir) {
  try {
    await execa('git', ['add', '-A'], { cwd: dir })
    await execa('git', ['commit', '-m', GIT_FIRST_COMMIT_MESSAGE], { cwd: dir })
    logger.debug('Git commit done.')
    return true
  } catch (err) {
    console.log(err)
    logger.error('Git commit failed.', err)
    return false
  }
}
