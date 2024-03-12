'use strict'

const { table, getBorderCharacters } = require('table')
const RuntimeApiClient = require('./runtime-api-client')

const tableColumns = [
  {
    value: 'pid',
    alias: 'PID'
  },
  {
    value: 'packageName',
    alias: 'NAME'
  },
  {
    value: 'platformaticVersion',
    alias: 'PLT'
  },
  {
    value: 'uptimeSeconds',
    alias: 'TIME',
    formatter: formatRuntimeTime
  },
  {
    value: 'url',
    alias: 'URL'
  },
  {
    value: 'projectDir',
    alias: 'PWD'
  }
]

function formatRuntimeTime (timeSeconds) {
  let result = ''
  if (timeSeconds < 3600) {
    const seconds = Math.floor(timeSeconds % 60)
    result = `${seconds}s`
  }
  if (timeSeconds >= 60) {
    const minutes = Math.floor((timeSeconds % 3600) / 60)
    result = `${minutes}m ` + result
  }
  if (timeSeconds >= 3600) {
    const hours = Math.floor((timeSeconds % (3600 * 24)) / 3600)
    result = `${hours}h ` + result
  }
  if (timeSeconds >= 3600 * 24) {
    const days = Math.floor(timeSeconds / (3600 * 24))
    result = `${days}d ` + result
  }
  return result
}

const tableConfig = {
  border: getBorderCharacters('void'),
  columnDefault: {
    paddingLeft: 0,
    paddingRight: 1
  },
  drawHorizontalLine: () => false
}

async function printRuntimes (runtimes) {
  const raws = [tableColumns.map(column => column.alias)]

  for (const runtime of runtimes) {
    const raw = []
    for (const column of tableColumns) {
      let value = runtime[column.value]
      if (column.formatter) {
        value = column.formatter(value)
      }
      value ??= '-----'
      raw.push(value)
    }
    raws.push(raw)
  }

  const runtimesTable = table(raws, tableConfig)
  console.log(runtimesTable)
}

async function listRuntimesCommand () {
  const client = new RuntimeApiClient()
  const runtimes = await client.getRuntimes()
  if (runtimes.length === 0) {
    console.log('No platformatic runtimes found.')
    return
  }
  printRuntimes(runtimes)

  await client.close()
}

module.exports = listRuntimesCommand
