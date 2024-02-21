'use strict'

const { table, getBorderCharacters } = require('table')
const { getRuntimes } = require('./runtime-api')

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
    value: 'status',
    alias: 'STATUS',
    formatter: (status) => {
      if (status === 'started') {
        return '\x1b[32mrunning\x1b[0m'
      }
      return `\x1b[31m${status}\x1b[0m`
    }
  },
  {
    value: 'url',
    alias: 'URL',
    formatter: (url) => {
      return url || '-----'
    }
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
    paddingLeft: 1,
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
      raw.push(value)
    }
    raws.push(raw)
  }

  const runtimesTable = table(raws, tableConfig)
  console.log(runtimesTable)
}

async function listRuntimesCommand () {
  const runtimes = await getRuntimes()
  if (runtimes.length === 0) {
    console.log('No platformatic runtimes found.')
    return
  }
  printRuntimes(runtimes)
}

module.exports = listRuntimesCommand
