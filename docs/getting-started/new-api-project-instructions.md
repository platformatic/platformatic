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

This interactive command-line tool will guide you through setting up a new Platformatic project. For this guide, please choose the following options:

```
- Where would you like to create your project?      => .
- Which package manager do you want to use?         => npm
- Which kind of application do you want to create?  => @platformatic/db
- What is the name of the application?              => (generated-randomly), e.g. legal-soup
- What is the connection string?                    => sqlite://./db.sqlite
- Do you want to create default migrations?         => Yes
- Do you want to create another application?        => No
- Do you want to use TypeScript?                    => No
- What port do you want to use?                     => 3042
- Do you want to init the git repository?           => No
```

After completing the wizard, your Platformatic application will be ready in the specified folder. This includes example migration files, plugin scripts, routes, and tests within your application directory.

:::note

If the wizard does not handle dependency installation, ensure to run `npm/yarn/pnpm` install command manually.

`wattpm` sets up workspaces for the selected package manager. Running a manual installation with a different package manager may cause issues or trigger warnings.

:::
