# @platformatic/nitro

Platformatic capability for running [Nitro](https://nitro.build/) applications inside Watt.

It supports standalone `nitro` and `nitropack` applications, and applications that use Nitro as a Vite plugin. Vite development is delegated to `@platformatic/vite`; production uses the generated Nitro server.

## Install

```bash
npm install @platformatic/nitro
```

## Configuration

Set `nitro.outputDirectory` when the generated output is not `.output`, and `nitro.entrypoint` when the server entrypoint is not `server/index.mjs`. Standalone applications receive `application.basePath` through `NITRO_APP_BASE_URL` during development and builds.

## License

Apache 2.0
