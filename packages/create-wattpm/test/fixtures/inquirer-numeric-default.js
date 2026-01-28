import inquirer from 'inquirer'

const result = await inquirer.prompt({
  type: 'input',
  name: 'port',
  message: 'What port?',
  default: 3042
})

console.log('SUCCESS:' + result.port)
