# Watt 3 proof-of-concept checklist

## Agree on the outcome

Identify a representative application, required framework/capability versions, public
routes, internal calls, database dependencies, and deployment environment. Define
success criteria before restructuring the project or comparing performance.

## Integrate

- Require Node.js 22.19.0+ and a local Watt installation with `skill` support (3.74.0+).
- Preserve the package manager and lockfile; install major 3 packages only with authorization.
- Select the [framework capability](frameworks.md), then follow [integration](integration.md).
- Keep existing source, framework configuration, and build scripts.
- Document environment variable names without copying secrets.
- Ensure one owner for listeners and a clean shutdown path for external resources.
- Use `applications`/`autoload` and the root `entrypoint` for multi-app orchestration.

## Validate with authorization

1. Start development mode and check representative routes and asset URLs.
2. Exercise internal calls and gateway rewriting where applicable.
3. Build and start production output using the same dependency lockfile.
4. Verify readiness, graceful shutdown, and worker replacement.
5. Check observability, database pools, and memory under representative traffic.
6. Compare performance against the same baseline and resource limits.

JSON parsing or `wattpm --version` alone is not an integration test. Record what ran,
what failed, and what remains unverified. Stop temporary processes when finished.

See [operations](operations.md), [performance](performance.md), and
[troubleshooting](troubleshooting.md).
