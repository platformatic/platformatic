import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Run this command in your terminal to start the Platformatic creator wizard:

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

This interactive command-line tool will ask you some questions about how you'd
like to set up your new Platformatic project. For this guide, select these options:

```
- What kind of project do you want to create?   => Application
- Where would you like to create your project?  => quick-start
- Which kind of project do you want to create?  => DB
- What is the name of the service?              => (generated-randomly), e.g. legal-soup
- What is the connection string?                => sqlite://./db.sqlite
- Do you want to create default migrations?     => Yes
- Do you want to create another service?        => No
- Do you want to use TypeScript?                => No
- What port do you want to use?                 => 3042
- Do you want to init the git repository?       => No
```

Once the wizard is complete, you'll have a Platformatic app project in the
folder `quick-start`, with example migration files, plugin script,
routes, and tests inside your service directory under services/

:::info

Make sure you run the npm/yarn/pnpm command `install` command manually if you
don't ask the wizard to do it for you.

:::
