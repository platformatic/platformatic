import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

To start the Platformatic creator wizard, run the appropriate command for your package manager in your terminal:

<Tabs groupId="package-manager-create">
<TabItem value="npm" label="npm">

```bash
npm create platformatic@latest
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn create platformatic
```

</TabItem>
<TabItem value="pnpm" label="pnpm">

```bash
pnpm create platformatic@latest
```

</TabItem>
</Tabs>

This interactive command-line tool will guide you through setting up a new Platformatic project. For this guide, please choose the following options:

```
- Where would you like to create your project?  => .
- Which kind of service do you want to create?  => @platformatic/db 
- What is the name of the service?              => (generated-randomly), e.g. legal-soup
- What is the connection string?                => sqlite://./db.sqlite
- Do you want to create default migrations?     => Yes
- Do you want to create another service?        => No
- Do you want to use TypeScript?                => No
- What port do you want to use?                 => 3042
- Do you want to init the git repository?       => No
```

After completing the wizard, your Platformatic application will be ready in the specified folder. This includes example migration files, plugin scripts, routes, and tests within your service directory.

:::note

If the wizard does not handle dependency installation, ensure to run `npm/yarn/pnpm` install command manually:

:::
