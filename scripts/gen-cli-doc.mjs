import { readFile, readdir, writeFile } from 'fs/promises'
import { join } from 'desm'
import path from 'path'

let out = `---
toc_max_heading_level: 4
---

<!-- ATTENTION: This file is automatically generated through script/gen-cli-doc.mjs, do not change it manually! -->

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import TOCInline from '@theme/TOCInline';

# Platformatic CLI

## Installation and usage

Install the Platformatic CLI as a dependency for your project:

<Tabs groupId="package-manager">
<TabItem value="npm" label="npm">

\`\`\`bash
npm install platformatic
\`\`\`

</TabItem>
<TabItem value="yarn" label="Yarn">

\`\`\`bash
yarn add platformatic
\`\`\`

</TabItem>
<TabItem value="pnpm" label="pnpm">

\`\`\`bash
pnpm add platformatic
\`\`\`

</TabItem>
</Tabs>

Once it's installed you can run it with:

<Tabs groupId="package-manager">
<TabItem value="npm" label="npm">

\`\`\`bash
npx platformatic
\`\`\`

</TabItem>
<TabItem value="yarn" label="Yarn">

\`\`\`bash
yarn platformatic
\`\`\`

</TabItem>
<TabItem value="pnpm" label="pnpm">

\`\`\`bash
pnpm platformatic
\`\`\`

</TabItem>
</Tabs>

:::info

The \`platformatic\` package can be installed globally, but installing it as a
project dependency ensures that everyone working on the project is using the
same version of the Platformatic CLI.

:::

## Commands

The Platformatic CLI provides the following commands:

<TOCInline toc={toc} minHeadingLevel={3} maxHeadingLevel={4} />

### help

`

// Command: help

const cliHelpDir = join(import.meta.url, '../packages/cli/help')
const cliHelp = path.join(cliHelpDir, 'help.txt')

const mainCliHelp = await readFile(cliHelp, 'utf8')

out += `
\`\`\`
${mainCliHelp.trim()}
\`\`\`

`;

// Command: client

out += `
### client

\`\`\`bash
platformatic client <command>
\`\`\`

`

const clientHelpsDir = join(import.meta.url, '../packages/client-cli/help')
const clientHelps = await readdir(clientHelpsDir)

for (const clientHelp of clientHelps) {
  const clientHelpPath = path.join(clientHelpsDir, clientHelp)
  const content = await readFile(clientHelpPath)
  out += `
#### ${clientHelp.replace('.txt', '')}

${content}
`
}

// Command: composer

out += `
### composer

\`\`\`bash
platformatic composer <command>
\`\`\`

`

const composerHelpsDir = join(import.meta.url, '../packages/composer/help')
const composerHelps = await readdir(composerHelpsDir)

for (const composerHelp of composerHelps) {
  const composerHelpPath = path.join(composerHelpsDir, composerHelp)
  const content = await readFile(composerHelpPath)
  out += `
#### ${composerHelp.replace('.txt', '')}

${content}
`
}

// Command: db

out += `
### db

\`\`\`bash
platformatic db <command>
\`\`\`

`

const dbHelpsDir = join(import.meta.url, '../packages/db/help')
const dbHelps = await readdir(dbHelpsDir)

for (const dbHelp of dbHelps) {
  const dbHelpPath = path.join(dbHelpsDir, dbHelp)
  const content = await readFile(dbHelpPath)
  out += `
#### ${dbHelp.replace('.txt', '')}

${content}
`
}

// Command: service

out += `
### service

\`\`\`bash
platformatic service <command>
\`\`\`

`

const serviceHelpsDir = join(import.meta.url, '../packages/service/help')
const serviceHelps = await readdir(serviceHelpsDir)

for (const serviceHelp of serviceHelps) {
  const serviceHelpPath = path.join(serviceHelpsDir, serviceHelp)
  const content = await readFile(serviceHelpPath)
  out += `
#### ${serviceHelp.replace('.txt', '')}

${content}
`
}


// Command: frontend

out += `
### frontend

\`\`\`bash
platformatic frontend <url> <language>
\`\`\`

`

const frontendHelpsDir = join(import.meta.url, '../packages/frontend-template/help')
const frontendHelps = path.join(frontendHelpsDir, 'help.txt')

const mainFrontendHelp = await readFile(frontendHelps, 'utf8')

out += `

${mainFrontendHelp.trim()}

`;

// Command: runtime

out += `
### runtime

\`\`\`bash
platformatic runtime <command>
\`\`\`

`

const runtimeHelpsDir = join(import.meta.url, '../packages/runtime/help')
const runtimeHelps = await readdir(runtimeHelpsDir)

for (const runtimeHelp of runtimeHelps) {
  const runtimeHelpPath = path.join(runtimeHelpsDir, runtimeHelp)
  const content = await readFile(runtimeHelpPath)
  out += `
#### ${runtimeHelp.replace('.txt', '')}

${content}
`
}


// Command: start

const startHelp = path.join(cliHelpDir, 'start.txt')

const startCliHelp = await readFile(startHelp, 'utf8')

out += `
### start

${startCliHelp.trim()}

`;


await writeFile(join(import.meta.url, '..', 'docs', 'reference', 'cli.md'), out)

