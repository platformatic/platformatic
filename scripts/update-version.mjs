import { readFile, writeFile } from 'fs/promises'

const version = process.argv[2].replace(/^v/, '')
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
packageJson.version = version
await writeFile('package.json', JSON.stringify(packageJson, null, 2))
