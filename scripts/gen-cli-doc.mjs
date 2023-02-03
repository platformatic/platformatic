import { readFile, readdir, writeFile } from 'fs/promises'
import { join } from 'desm'
import path from 'path'

let out = `---
toc_max_heading_level: 4
---

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

const mainHelp = await readFile(cliHelp, 'utf8')

out += `
\`\`\`
${mainHelp.trim()}
\`\`\`

`;

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

await writeFile(join(import.meta.url, '..', 'docs', 'reference', 'cli.md'), out)
