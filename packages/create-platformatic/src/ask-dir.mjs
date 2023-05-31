import { validatePath } from './utils.mjs'
import inquirer from 'inquirer'
import { resolve } from 'path'

const askProjectDir = async (logger, defaultName, message = 'Where would you like to create your project?') => {
  const options = await inquirer.prompt({
    type: 'input',
    name: 'dir',
    message,
    default: defaultName,
    validate: validatePath
  })

  const projectDir = resolve(process.cwd(), options.dir)
  return projectDir
}

export default askProjectDir
