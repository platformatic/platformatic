# Configuration Files

Platformatic detects and loads the configuration file in a directory. There are six names, and they differ only in language and module system:

- `watt.config.ts`
- `watt.config.mts`
- `watt.config.cts`
- `watt.config.js`
- `watt.config.mjs`
- `watt.config.cjs`

**One configuration file per directory.** Two is an error rather than a precedence rule: a project that answers the same question twice has no answer.

A configuration file is a module that exports its configuration as the default export. Because it is a program, it reads its environment directly rather than through interpolation:

```ts config
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  logger: { level: 'info' },
  autoload: { path: 'web' }
})
```

**A configuration file is trusted code.** It runs with the same privileges as the runtime itself —
it can read any file the process can and open sockets, exactly as an application's own code can.
Isolating each configuration file's evaluation protects one application's environment from leaking
into another's, not against hostile configuration. Only add a `watt.config.*` — your own or a
remote application's — that you trust as much as the code it configures. For the same reason, a
resolved configuration can contain secrets that were read from the environment:
`wattpm start --debug-config` and the management API print it as-is, unredacted.

# Supported File Formats

The extension chooses the language and the module system. Which one you can write is decided by the package the file sits in, not by preference.

| Extension | Language   | Module system                                  |
|-----------|------------|------------------------------------------------|
| `.ts`     | TypeScript | Follows the package (`"type": "module"` → ESM) |
| `.mts`    | TypeScript | Always ESM                                     |
| `.cts`    | TypeScript | Always CommonJS                                |
| `.js`     | JavaScript | Follows the package (`"type": "module"` → ESM) |
| `.mjs`    | JavaScript | Always ESM                                     |
| `.cjs`    | JavaScript | Always CommonJS                                |

The prefix is not a style choice, it settles the module system regardless of the nearest `package.json`. A bare `watt.config.js` (or `.ts`) in a package that does not declare `"type": "module"` is CommonJS, and `export default` there is a syntax error — so that package writes `watt.config.mjs` (or `.mts`) to force ESM, or uses a CommonJS file and assigns the configuration to `module.exports`. The loader imports the file and reads its default export either way: `export default …` in an ESM file, `module.exports = …` in a CommonJS one.

TypeScript files are handled by Node's own type stripping, which erases annotations and runs what is left. Nothing is emitted and nothing is compiled, which has three consequences:

- **Erasable syntax only.** The constructs that need code generated for them are unavailable: no `enum`, no `namespace` that holds values, no constructor parameter properties. A type-only `declare namespace` is fine, as are types on values, generics, `satisfies` and `as` — all of them erase to nothing.
- **No `tsconfig`.** It is not read, so its `paths` mappings are not applied — imports resolve the way Node resolves them.
- **No `.ts` under `node_modules`.** Node refuses to strip types from a file there, so a shared `.ts` configuration preset cannot be published and imported as one. Publish it compiled, or as `.js`.

## Comments

Every format supports comments, because every format is source code. This is one of the reasons the configuration file is a program: the JSON dialects it replaces could not carry a note explaining why a value is what it is.

## The JSON formats

`watt.json`, `platformatic.json`, and the JSON5, YAML and TOML variants are the legacy configuration files. They are not read, and one sitting beside a `watt.config.*` file is refused rather than merged — the two describe the same thing and would disagree.

To convert a project, run:

```bash
npx wattpm-utils migrate
```

See the [migration guide](./guides/migrate-v4.md) for what it changes and what it leaves for you.

#### [Back to docs](./reference/gateway/configuration.md#configuration-files)
