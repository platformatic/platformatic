'use strict'

import { stat } from 'fs/promises'
import inquirer from 'inquirer'
import { resolve } from 'path'

const askProjectDir = async (logger, defaultName, message = 'Where would you like to create your project?') => {
  const options = await inquirer.prompt({
    type: 'input',
    name: 'dir',
    message,
    default: defaultName
  })

  const projectDir = resolve(process.cwd(), options.dir)

  try {
    await stat(projectDir)
    console.log('asdasd', projectDir)
    logger.warn(`Directory ${projectDir} is not empty. Smoe files may be overwritten without confirmation.`)
    const confirmation = await inquirer.prompt({
      type: 'list',
      name: 'confirmExistingDirectory',
      message: `Confirm you want to use ${projectDir} directory?`,
      default: 'no',
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    })
    if (!confirmation.confirmExistingDirectory) {
      logger.error(`Please choose another directory.`)
      process.exit(1)
    }
  } catch (err) {
    console.log(err)
    // directory is empty, we can proceed
  }
  return projectDir
}

export default askProjectDir
