import chalk from 'chalk'

function getSimpleBanner (version) {
  const versionStr = version || '0.0.1'
  const versionLine = `WattExtra v${versionStr}`
  const padding = ' '.repeat(33 - versionLine.length - 2)

  const bannerText = `
   +=================================+
   |                                 |
   |  ${versionLine}${padding}|
   |  Platformatic Runtime Manager   |
   |                                 |
   +=================================+
  `

  return chalk.green(bannerText)
}

export {
  getSimpleBanner
}
