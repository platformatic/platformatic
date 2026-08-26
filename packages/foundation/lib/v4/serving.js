import { ApplicationStartsNothingError } from './errors.js'

/*
  A declaration is a constant in the common case and a callable for the capability whose behaviour
  its own configuration selects — the shape a per-package constant cannot express.

  The callable receives the configuration as authored and validated, never as transformed: this is
  read main-side, after validation and before any worker, while the capability transform runs
  worker-side and later. So it sees whatever shapes the schema admits, and any capability whose
  schema accepts a shorthand has to read every spelling rather than the one transform produces.
*/
export function evaluateServesWithoutPort (declaration, config) {
  const resolved = typeof declaration === 'function' ? declaration(config) : declaration

  // Absent means 'worker', not false. A third-party capability that does not declare this is one
  // the loader knows nothing about, and the two wrong answers are opposite: false rejects at load
  // a capability that would have served the mesh perfectly well, and true prints a mesh URL that
  // answers nothing. Deferring to the started worker does neither.
  return resolved ?? 'worker'
}

export function servingEnvironment (production) {
  return production ? 'production' : 'development'
}

/*
  An application will serve if any of three things holds: its capability can serve without a
  listener in the mode this boot will use, its server.port is defined, or it declares a custom
  command for that mode.

  The third is not a technicality. Every framework capability checks its command before the port,
  so a framework application with a custom command and no server.port is valid and starts — its
  command binds whatever it binds and the runtime observes the address. A predicate that looked
  only at the capability would reject that configuration at load.

  Which command counts is decided by the mode, not by either command existing: the development and
  production start paths read their own key and neither falls back to the other, so an application
  declaring only a development command and booted with start has no command and no port.
*/
export function willApplicationServe ({ declaration, config, production }) {
  const resolved = evaluateServesWithoutPort(declaration, config)

  // Worker-classified rows are exempt in both modes, because nothing main-side can prove they
  // start nothing — which is what worker classification means. Reading "framework capability under
  // dev" as covering Vite SSR would reject exactly the configuration the matrix exists to admit.
  if (resolved === 'worker') {
    return { serves: true, reason: 'worker-classified' }
  }

  const environment = servingEnvironment(production)

  if (resolved?.[environment]) {
    return { serves: true, reason: 'serves-without-port' }
  }

  if (config?.server?.port !== undefined) {
    return { serves: true, reason: 'port' }
  }

  if (config?.application?.commands?.[environment]) {
    return { serves: true, reason: 'command' }
  }

  return { serves: false, reason: 'no-port-no-command' }
}

// All three inputs are configuration, so the predicate is decidable before boot. An application
// satisfying none of them fails the load naming it and its capability — rather than booting a
// runtime with one application silently missing.
export function assertApplicationServes ({ id, module, declaration, config, production }) {
  const outcome = willApplicationServe({ declaration, config, production })

  if (!outcome.serves) {
    // The environment appears twice: once as the mode that refuses, and once as the key under
    // application.commands the reader would have to add.
    const environment = servingEnvironment(production)

    throw new ApplicationStartsNothingError(id, module, environment, environment)
  }

  return outcome
}
