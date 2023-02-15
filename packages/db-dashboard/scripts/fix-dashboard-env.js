'use strict'

const { join } = require('path')
const { readFile, writeFile } = require('fs/promises')
const { ConfigManager } = require('@platformatic/service')
const { findConfigFile } = require('@platformatic/service/lib/utils')

async function main () {
  const ourConfigFiles = [
    'platformatic.db.json',
    'platformatic.db.json5',
    'platformatic.db.yaml',
    'platformatic.db.yml',
    'platformatic.db.toml',
    'platformatic.db.tml'
  ]
  const rootDirectory = join(__dirname, '..', '..', '..')
  const configFileName = await findConfigFile(rootDirectory, ourConfigFiles)
  if (!configFileName) {
    console.log('No config file found, skipping other checks.')
    return
  }
  const configFilePath = join(rootDirectory, configFileName)
  
  const cm = new ConfigManager({
    source: configFilePath
  })
  await cm.parse()
  const configDashboardEdnpoint = cm.current.dashboard?.path
  if (configDashboardEdnpoint) {
    const newLine = `VITE_DASHBOARD_PATH=${configDashboardEdnpoint}`
    const envFilePath = join(__dirname, '..', '.env')
    const data = await readFile(envFilePath, 'utf-8')
    const splitted = data.split('\n')
    const envFileLine = findEnvFileDashboardPathLine(splitted)
    if (envFileLine === null) {
      // Append line to the end of file
      console.log('VITE_DASHBOARD_PATH variable not found, fixing it...')
      splitted.push(newLine)
    } else {
      // Change line
      console.log('Changing VITE_DASHBOARD_PATH variable...')
      splitted[envFileLine] = newLine
    }
    // Write file
    await writeFile(envFilePath, splitted.join('\n'))
    console.log('New .env file has been written!')
  } else {
    console.log('No dashboard custom endpoint found')
  }
}

function findEnvFileDashboardPathLine (lines) {
  let output = null
  lines.find((line, index) => {
    if (line.match(/^VITE_DASHBOARD_PATH/)) {
      output = index
      return true
    }
    return false
  })
  return output
}
main()
