Install the [official Watt skill](../guides/use-watt-with-ai-agents.md):

```sh
npx skills add platformatic/skills --skill watt
```

Select the exact published Watt 4 version and authorize its local installation first,
creating a minimal package manifest if necessary. The discovery skill reads instructions
from that installation; see [new-project setup](../guides/use-watt-with-ai-agents.md#new-projects).

Ask your agent:

> Create a Watt 4 npm workspace in this directory with a database application named
> `db` under `web/db`. Use ESM, `watt.config.ts`, SQLite, and port 3042. Add package
> scripts, a sample `movies` table with paired `001.do.sql` / `001.undo.sql`
> migrations, plugins, routes, and tests. Configure
> `process.env.PLT_DB_DATABASE_URL` with the local default `sqlite://./db.sqlite`.
> Use `PLT_DB_APPLY_MIGRATIONS` to control migration auto-apply for this development
> tutorial. Preserve existing files and ask before installing dependencies.

The result should include a root package with `workspaces: ["web/*"]`, a root
`watt.config.ts` referencing `web/db`, whose own configuration exposes port 3042, and a database application's
own package, configuration, migration directory, and tests. Keep actual credentials
in `.env` and commit only an env example.

If you prefer to write the project manually, follow the
[service and database skill reference](../skills/watt/references/services.md) and
[workspace setup](../skills/watt/references/scaffolding.md). Install with the same
package manager throughout the tutorial; Watt does not create files through a wizard.
