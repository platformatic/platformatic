export const getRunPackageManagerInstall = pkgManager => {
  return {
    type: 'list',
    name: 'runPackageManagerInstall',
    message: `Do you want to run ${pkgManager} install?`,
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }
}

export const getUseTypescript = typescript => {
  return {
    type: 'list',
    when: !typescript,
    name: 'useTypescript',
    message: 'Do you want to use TypeScript?',
    default: typescript,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }
}

export const getCreateDefaultMigrations = () => {
  return {
    type: 'list',
    name: 'defaultMigrations',
    message: 'Do you want to create default migrations?',
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }
}

export const getCreatePlugin = plugin => {
  return {
    type: 'list',
    name: 'generatePlugin',
    message: 'Do you want to create a plugin?',
    default: plugin,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }
}

export const getDBToBeUsed = db => {
  return {
    type: 'list',
    name: 'database',
    message: 'Which database would you like to use?',
    default: db,
    choices: [{ name: 'SQLite', value: 'sqlite' },
              { name: 'MySQL', value: 'mysql' },
              { name: 'MySQL 8.0', value: 'mysql8' },
              { name: 'PostgreSQL', value: 'postgres' },
              { name: 'Maria DB', value: 'mariadb' }
    ]
  }
}
