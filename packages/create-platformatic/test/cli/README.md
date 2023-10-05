To have this test working, you need to link 'platformatic' globally with:

```bash 
# in platformatic root
cd packages/cli
pnpm link --global
```
The reason is that the type generation is done expecting the 'platformatic' command to be in the cli, see: https://github.com/platformatic/platformatic/blob/main/packages/create-platformatic/src/service/create-service-cli.mjs#L120
