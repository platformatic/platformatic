import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

To start the Watt creator wizard, run the appropriate command for your package manager in your terminal:

<Tabs groupId="package-manager-create">
<TabItem value="npm" label="npm">

```bash
npm create wattpm
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn create wattpm
```

</TabItem>
<TabItem value="pnpm" label="pnpm">

```bash
pnpm create wattpm
```

</TabItem>
</Tabs>

This interactive command-line tool will guide you through setting up a new Watt project. For this guide, please choose the following options:

```
Hello YOURNAME, welcome to Watt 3.0.0!
? Where would you like to create your project? .
✔ Installing @platformatic/runtime@^3.0.0 using npm ...
? Which kind of application do you want to create? @platformatic/db
✔ Installing @platformatic/db@^3.0.0 using npm ...
? What is the name of the application? db
? What is the connection string? sqlite://./db.sqlite
? Do you want to create default migrations? yes
? Do you want to use TypeScript? no
? Do you want to create another application? no
? What port do you want to use? 3042
```

After completing the wizard, your Watt application will be ready in the specified folder. This includes example migration files, plugin scripts, routes, and tests within your application directory.

:::note

If the wizard does not handle dependency installation, ensure to run `npm/yarn/pnpm` install command manually.

`wattpm` sets up workspaces for the selected package manager. Running a manual installation with a different package manager may cause issues or trigger warnings.

:::
