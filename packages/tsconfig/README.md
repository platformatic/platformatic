# @platformatic/tsconfig

⚡ **Shared TypeScript configuration for Platformatic applications** - A carefully crafted `tsconfig.json` base configuration that provides optimal settings for Node.js applications in the Platformatic ecosystem.

## 📦 Install

```sh
npm install @platformatic/tsconfig
```

## 🚀 Usage

To use this configuration, extend it in your project's `tsconfig.json`:

```json
{
  "extends": "@platformatic/tsconfig",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Basic Setup

1. Install the package:

   ```sh
   npm install --save-dev @platformatic/tsconfig
   ```

2. Create or update your `tsconfig.json`:

   ```json
   {
     "extends": "@platformatic/tsconfig"
   }
   ```

3. Start using TypeScript with the optimized configuration!

## ⚙️ Configuration Settings

This configuration is optimized for modern Node.js applications and includes the following settings:

### 🎯 General Settings

| Setting            | Value        | Description                                                       |
| ------------------ | ------------ | ----------------------------------------------------------------- |
| [`target`][target] | `ESNext`     | Compile to the latest ECMAScript standard for maximum performance |
| [`lib`][lib]       | `["ESNext"]` | Include latest ECMAScript library features                        |

### 📦 Module Settings

| Setting                                                              | Value      | Description                                                |
| -------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| [`module`][module]                                                   | `NodeNext` | Use Node.js ESM module resolution for modern applications  |
| [`moduleResolution`][moduleResolution]                               | `NodeNext` | Enable Node.js 16+ module resolution algorithm             |
| [`skipLibCheck`][skipLibCheck]                                       | `true`     | Skip type checking of declaration files for faster builds  |
| [`esModuleInterop`][esModuleInterop]                                 | `true`     | Enable CommonJS/ES module interoperability                 |
| [`allowSyntheticDefaultImports`][allowSyntheticDefaultImports]       | `true`     | Allow default imports from modules without default exports |
| [`allowImportingTsExtensions`][allowImportingTsExtensions]           | `true`     | Allow importing `.ts` files directly                       |
| [`rewriteRelativeImportExtensions`][rewriteRelativeImportExtensions] | `true`     | Automatically rewrite import extensions                    |
| [`allowJs`][allowJs]                                                 | `false`    | Enforce TypeScript-only codebase for type safety           |

### 🔒 Language Settings (Type Safety)

| Setting                                                    | Value   | Description                                                   |
| ---------------------------------------------------------- | ------- | ------------------------------------------------------------- |
| [`strict`][strict]                                         | `true`  | Enable all strict type checking options                       |
| [`strictNullChecks`][strictNullChecks]                     | `true`  | Enforce strict null and undefined checking                    |
| [`noImplicitAny`][noImplicitAny]                           | `true`  | Raise error on expressions with implied `any` type            |
| [`noUnusedLocals`][noUnusedLocals]                         | `true`  | Report errors on unused local variables                       |
| [`noUnusedParameters`][noUnusedParameters]                 | `true`  | Report errors on unused function parameters                   |
| [`useUnknownInCatchVariables`][useUnknownInCatchVariables] | `false` | Use `any` type for catch clause variables (for compatibility) |

### 🔧 Transpilation Settings

| Setting                            | Value  | Description                                              |
| ---------------------------------- | ------ | -------------------------------------------------------- |
| [`removeComments`][removeComments] | `true` | Remove comments from compiled output for smaller bundles |
| [`newLine`][newLine]               | `lf`   | Use Unix-style line endings for consistency              |

## 💡 Why These Settings?

### Modern Node.js Support

- **`NodeNext` module resolution** ensures compatibility with Node.js 22+ ESM features
- **`ESNext` target** leverages the latest JavaScript features for optimal performance

### Type Safety First

- **Strict mode enabled** catches common bugs at compile time
- **No implicit any** ensures all types are explicitly defined
- **Unused variable detection** keeps code clean and maintainable

### Developer Experience

- **Skip lib check** speeds up compilation without sacrificing safety
- **Import extensions** work seamlessly with modern tooling
- **Consistent formatting** with LF line endings across platforms

## 📄 License

Apache 2.0

[target]: https://www.typescriptlang.org/tsconfig#target
[lib]: https://www.typescriptlang.org/tsconfig#lib
[module]: https://www.typescriptlang.org/tsconfig#module
[moduleResolution]: https://www.typescriptlang.org/tsconfig#moduleResolution
[skipLibCheck]: https://www.typescriptlang.org/tsconfig#skipLibCheck
[esModuleInterop]: https://www.typescriptlang.org/tsconfig#esModuleInterop
[allowSyntheticDefaultImports]: https://www.typescriptlang.org/tsconfig#allowSyntheticDefaultImports
[allowImportingTsExtensions]: https://www.typescriptlang.org/tsconfig#allowImportingTsExtensions
[rewriteRelativeImportExtensions]: https://www.typescriptlang.org/tsconfig#rewriteRelativeImportExtensions
[allowJs]: https://www.typescriptlang.org/tsconfig#allowJs
[strict]: https://www.typescriptlang.org/tsconfig#strict
[strictNullChecks]: https://www.typescriptlang.org/tsconfig#strictNullChecks
[noImplicitAny]: https://www.typescriptlang.org/tsconfig#noImplicitAny
[noUnusedLocals]: https://www.typescriptlang.org/tsconfig#noUnusedLocals
[noUnusedParameters]: https://www.typescriptlang.org/tsconfig#noUnusedParameters
[useUnknownInCatchVariables]: https://www.typescriptlang.org/tsconfig#useUnknownInCatchVariables
[removeComments]: https://www.typescriptlang.org/tsconfig#removeComments
[newLine]: https://www.typescriptlang.org/tsconfig#newLine
