---
title: FAQs
label: Welcome to Platformatic
---

# FAQs

### How do I set up a custom authorization strategy in Platformatic?
To set up a custom authorization strategy in Platformatic, you use the addAuthStrategy method. This method allows you to define how the application should handle user sessions and roles. Here’s an example of setting up a custom authorization strategy:

```js
app.addAuthStrategy({
  name: 'custom-auth-strategy',
  createSession: async (req, reply) => {
    const user = ...

    req.user = { id: user.id, role: user.role }
  }
});
```
Here, the `createSession` function runs every time there is an HTTP request. It sets up the user session by retrieving the user’s ID and role and assigning them to `req.user`.

### How do I handle dynamic roles in Platformatic?
If your application uses dynamic roles, such as different roles for different workspaces, you can manage these roles programmatically. Here’s how to approach it:

   1. **Set Up User Roles**: In your custom authorization strategy, store the user roles in the req.user object under the X-PLATFORMATIC-ROLE property (this property name can be configured). Use a comma-separated list for multiple roles.

   ```js
   req.user = { id: user.id, role: user.roles.join(',') };
   ```

   2. **Configure Authorization:**: To use the roles, configure the authorization settings in Platformatic DB. You can specify the property name for roles using the roleKey configuration.

   ```yml
   authorization:
   roleKey: X-PLATFORMATIC-ROLE
   ```
   You can then implement programmatic rules to check the options of the user's workspace, for managing authorizations as [outlined here](https://www.cerbos.dev/blog/supercharging-your-policy-rules-with-self-service-custom-roles). See the [Platformatic DB docs](https://docs.platformatic.dev/docs/db/configuration/#authorization) on how to use a different roleKey.

### Can I use external services for dynamic role management in Platformatic?
Yes, for more complex scenarios where roles vary significantly across different contexts (e.g., different workspaces), you might want to integrate an external service like [Cerbos](https://github.com/platformatic/fastify-cerbos) to handle dynamic role management and authorization. [Cerbos](https://github.com/platformatic/fastify-cerbos) allows you to load roles dynamically and manage authorizations programmatically. 

### How does Platformatic run or compile the root-level files like index.js, which include the start and stop processes for setting up error handling and starting the services? This file also sets up handlers for SIGINT and SIGTERM signals. How does Platformatic take this file and run it?

When you run `platformatic start`, Platformatic does the following: 

1.	**Parse Configuration**: Platformatic parses your configuration file to understand how your application is set up and what services need to be started.
2.	**Setup Signal Handlers**: It sets up signal handlers for SIGINT and SIGTERM to ensure your application can handle termination signals.
3.	**Executes Worker Thread**: Platformatic runs your code inside a worker thread. This allows Platformatic to monitor the execution of your application and provides the ability to automatically restart the worker thread if it crashes.
4.	**Automatic Restart**: If the worker thread running your code crashes, Platformatic automatically restarts it, ensuring that your services remain available with minimal downtime.

All of these processes are open-source, so you can explore the code and contribute to the project on our [GitHub repository](https://github.com/platformatic/platformatic).