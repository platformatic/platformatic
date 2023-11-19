'use strict'

const { spec } = require('node:test/reporters')
const { run } = require('node:test')
const process = require('node:process')
const fs = require('fs')
const path = require('path')

const testDirectory = './test'
const testFilePattern = /\.test\.js$/

const files = fs.readdirSync(testDirectory)
  .filter(file => testFilePattern.test(file))
  .map(file => path.resolve(testDirectory, file))

run({ files }).compose(spec).pipe(process.stdout)
