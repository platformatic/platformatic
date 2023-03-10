# @platformatic/metaconfig

Utility module to migrate between one version of Platformatic to another.

## Install

```sh
npm install @platformatic/metaconfig
```

## Usage

```javascript
import { analyze, write } from '@platformatic/metaconfig'

const meta = await analyze({ file: 'path/to/platformatic.db.json' }))

console.log(meta.version)
console.log(meta.kind)
console.log(meta.config)
console.log(meta.path)

// Bring it to the next version
const metaNext = meta.up()

console.log(metaNext.version)
console.log(metaNext.kind)
console.log(metaNext.config)
console.log(metaNext.path)

// this will override the old config
await write(metaNext)
```

## License

Apache 2.0
