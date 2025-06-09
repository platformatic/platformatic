#!/usr/bin/env node

'use strict'

const { execSync } = require('child_process')

// Function to get modified files from git status
function getUpdatedFiles() {
  try {
    // Get the output of git status in porcelain format
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' })

    // Parse the output to extract file paths
    // Each line of git status --porcelain looks like:
    // XY filename
    // where X and Y are status codes and filename is the path
    return gitStatus
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        // Extract the file path (skip the first 3 characters which are status codes + space)
        return line.substring(3)
      })
  } catch (error) {
    console.error('Error getting git status:', error.message)
    return []
  }
}

function schemaFilesUpdates(files) {
  return files.some(file => file.match(/schema\.js$/))
}

function runGenSchema() {
  console.log(`Running gen-schema...`)
  try {
    const output = execSync(`npm run gen-schema`, {
      encoding: 'utf-8',
      stdio: 'inherit' // This will show the eslint output in real-time
    })
    return true
  } catch (error) {
    console.error(`gen-schema failed`)
    return false
  }
}

function runGenType() {
  console.log(`Running gen-types...`)
  try {
    const output = execSync(`npm run gen-types`, {
      encoding: 'utf-8',
      stdio: 'inherit' // This will show the eslint output in real-time
    })
    return true
  } catch (error) {
    console.error(`gen-types failed`)
    return false
  }
}

// Main function
function main() {
  console.log('\n*** Checking for changes in schema.js files...')
  console.log('> Getting modified files from git status...')
  const modifiedFiles = getUpdatedFiles()

  if (modifiedFiles.length === 0) {
    console.log('  No modified files found, done.')
    return
  }

  console.log(`  Found ${modifiedFiles.length} modified files.`)

  if (!schemaFilesUpdates(modifiedFiles)) {
    console.log('  No schema.js files affected, done.')
    return
  }

  {
    const success = runGenSchema()
    if (success) {
      console.log('  gen-schema succeeded')
    } else {
      console.log('  gen-schema failed')
    }
  }

  {
    const success = runGenType()
    if (success) {
      console.log('  gen-types succeeded')
    } else {
      console.log('  gen-types failed')
    }
  }
}

// Run the script
main()
