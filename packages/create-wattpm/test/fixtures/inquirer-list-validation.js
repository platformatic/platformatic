import inquirer from 'inquirer'

const result = await inquirer.prompt({
  type: 'select',
  name: 'choice',
  message: 'Pick one',
  choices: [
    { name: 'yes', value: true },
    { name: 'no', value: false }
  ]
})

console.log('RESULT:' + typeof result.choice + ':' + result.choice)
