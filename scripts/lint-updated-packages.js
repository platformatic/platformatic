#!/usr/bin/env node

import { execSync } from 'node:child_process'

// Function to get modified files from git status
function getUpdatedFiles () {
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

// Function to extract unique package directories
function getAffectedPackages (files) {
  const packagesRegex = /^packages\/([^\/]+)/

  // Filter files to only get those in packages/ directory
  // and extract unique package directories
  const packageDirs = new Set()

  files.forEach(file => {
    const match = file.match(packagesRegex)
    if (match) {
      packageDirs.add(`packages/${match[1]}`)
    }
  })

  return Array.from(packageDirs)
}

// Function to run eslint --fix on a directory
function runEslintFix (directory) {
  console.log(`Running ESLint on ${directory} (npx eslint --fix)...`)
  try {
    const output = execSync(`cd ${directory} && npx eslint --fix`, {
      encoding: 'utf-8',
      stdio: 'inherit' // This will show the eslint output in real-time
    })
    return true
  } catch (error) {
    // ESLint will exit with non-zero status if it finds problems
    // But we still want to continue with other packages
    console.error(`ESLint found issues in ${directory}`)
    return false
  }
}

// Main function
function main () {
  console.log('\n*** Linting changed packages ...')
  console.log('> Getting modified files from git status...')
  const modifiedFiles = getUpdatedFiles()

  if (modifiedFiles.length === 0) {
    console.log('  No modified files found, done.')
    return
  }

  console.log(`  Found ${modifiedFiles.length} modified files.`)

  const packagesToLint = getAffectedPackages(modifiedFiles)

  if (packagesToLint.length === 0) {
    console.log('  No packages affected, done.')
    return
  }

  console.log(`  Found ${packagesToLint.length} affected packages: ${packagesToLint.join(', ')}`)

  let successCount = 0
  let failCount = 0

  console.log('> Linting packages...')
  packagesToLint.forEach(packageDir => {
    const success = runEslintFix(packageDir)
    if (success) {
      successCount++
    } else {
      failCount++
    }
  })

  console.log('\n> ESLint Summary:')
  console.log(`- ${successCount} packages linted successfully`)
  console.log(`- ${failCount} packages had linting issues`)
}

// Run the script
main()
