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

let port = 3042
export const getPort = (nextPort) => {
  if (nextPort === undefined) {
    nextPort = port++
  }

  return {
    type: 'input',
    name: 'port',
    message: 'What port do you want to use?',
    default: nextPort
  }
}
