'use strict'

const Table = require('tty-table')
const { getRuntimes } = require('./runtime-api')

const tableHeaders = [
  {
    value: 'pid',
    alias: 'PID',
    width: 10,
    headerColor: 'green'
  },
  {
    value: 'packageName',
    alias: 'NAME',
    headerColor: 'green'
  },
  {
    value: 'platformaticVersion',
    alias: 'PLT',
    headerColor: 'green',
    width: 10
  },
  {
    value: 'uptimeSeconds',
    alias: 'TIME',
    width: 10,
    headerColor: 'green',
    formatter: (timeSeconds) => {
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
  },
  {
    value: 'status',
    alias: 'STATUS',
    width: 10,
    headerColor: 'green',
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
    width: 30,
    headerColor: 'green',
    formatter: (url) => {
      return url || '-----'
    }
  },
  {
    value: 'projectDir',
    alias: 'PWD',
    width: '35%',
    headerColor: 'green'
  }
]

const tableOptions = {
  borderStyle: 'solid',
  borderColor: 'blueBright',
  defaultErrorValue: '-----',
  defaultValue: '-----'
}

async function printRuntimes (runtimes) {
  const runtimesTable = Table(tableHeaders, runtimes, [], tableOptions)
  console.log(runtimesTable.render())
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
