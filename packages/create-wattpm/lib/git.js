import { execa } from 'execa'

export const GIT_FIRST_COMMIT_MESSAGE = 'Watt project started! 🚀'
export const GIT_MAIN_BRANCH = 'main'

async function isGitInstalled () {
  try {
    await execa('git', ['--version'])
    return true
  } catch (err) {
    return false
  }
}

async function doesGitRepositoryExist (dir) {
  try {
    await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd: dir })
    return true
  } catch (e) {
    return false
  }
}

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
    logger.error('Git repository init failed.')
    logger.debug({ err })
    return false
  }
}

async function gitCommit (logger, dir) {
  try {
    await execa('git', ['add', '-A'], { cwd: dir })
    await execa('git', ['commit', '-n', '-m', GIT_FIRST_COMMIT_MESSAGE], { cwd: dir })
    logger.debug('Git commit done.')
    return true
  } catch (err) {
    console.log(err)
    logger.error('Git commit failed.')
    logger.debug({ err })
    return false
  }
}

export async function createGitRepository (logger, dir = '.') {
  if (!(await isGitInstalled())) {
    logger.error('Git is not installed')
    return
  }

  if (!(await gitInit(logger, dir))) {
    return
  }

  if (!(await gitCommit(logger, dir))) {
    return
  }

  logger.info('Git repository initialized.')
}
