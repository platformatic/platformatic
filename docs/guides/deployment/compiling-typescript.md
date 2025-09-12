# 🚀 Compiling TypeScript for Deployment

Watt provides TypeScript support across different capabilities with varying compilation approaches depending on the type of application you're building.

## 🔧 Server-Side Capabilities

For server-side capabilities like `@platformatic/node`, `@platformatic/gateway`, `@platformatic/service` and `@platformatic/db`, TypeScript support is provided through Node.js native type stripping:

- [Node.js Type Stripping Documentation](https://nodejs.org/api/typescript.html)
- [Node.js --experimental-strip-types flag](https://nodejs.org/docs/latest/api/cli.html#--experimental-strip-types)

These capabilities leverage Node.js's built-in ability to execute TypeScript files directly by stripping type annotations at runtime.

## 🎨 Frontend Capabilities

For frontend capabilities like `@platformatic/next` and `@platformatic/vite`, TypeScript compilation is handled by the underlying frontend technology:

- **Next.js**: Built-in TypeScript support with automatic compilation
- **Vite**: Native TypeScript support through esbuild
- **Astro**: Integrated TypeScript compilation
- **Remix**: Built-in TypeScript support

## ⚡ Development Workflow

During development, no special compilation steps are required. Platformatic automatically handles TypeScript execution:

- For `@platformatic/node`: If a `application.commands.build` is defined in your configuration or a `build` script exists in `package.json`, the build step will be executed automatically
- For frontend capabilities: Development servers handle TypeScript compilation transparently

## 🏗️ Production Deployment

For production deployments, you must compile TypeScript before starting your application:

### For @platformatic/node and Frontend Capabilities

1. **Build your application**:

   ```bash
   wattpm build
   ```

2. **Start the production server**:
   ```bash
   wattpm start
   ```

### ⚠️ Important Notes

- Always run `wattpm build` before `wattpm start` in production environments
- The build process will compile TypeScript files and prepare your application for production
- Ensure all TypeScript dependencies are properly installed before building
- For frontend capabilities, the build process includes bundling, optimization, and asset generation

## ✨ Best Practices

- Use TypeScript configuration files (`tsconfig.json`) to customize compilation settings
- Enable strict mode for better type safety
- Configure proper module resolution for your target environment
- Test your built application in a production-like environment before deployment
