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
- Which kind of project do you want to create?  => DB
- Where would you like to create your project?  => quick-start
- Do you want to create default migrations?     => Yes
- Do you want to create a plugin?               => Yes
- Do you want to use TypeScript?                => No
- Do you want to install dependencies?          => Yes (this can take a while)
- Do you want to apply the migrations?          => Yes
- Do you want to generate types?                => Yes
- Do you want to create the github action to deploy this application to Platformatic Cloud dynamic workspace? => No
- Do you want to create the github action to deploy this application to Platformatic Cloud static workspace?  => No
```

Once the wizard is complete, you'll have a Platformatic app project in the
folder `quick-start`, with example migration files and a plugin script.

:::info

Make sure you run the npm/yarn/pnpm command `install` command manually if you
don't ask the wizard to do it for you.

:::
