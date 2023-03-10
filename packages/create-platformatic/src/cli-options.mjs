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
