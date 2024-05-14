# How to use ENV variables with Platformatic

<head>
  <meta name="description" content="Learn how to use environment variables efficiently with Platformatic to manage different deployment settings." />
  <meta name="keywords" content="Platformatic, environment variables, configuration, software development, API" />
  <link rel="preconnect" href="https://example.com" />
  <script type="application/ld+json">
     {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Guide",
      "headline": "How to Use Environment Variables with Platformatic",
      "image": "../images/ENV_Var_Platforamtic.png",
      "author": {
        "@type": "Person",
        "name": "Fortune Ikechi"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Platformatic",
        "logo": {
          "@type": "ImageObject",
          "url": "../images/ENV_Var_Platforamtic.png"
        }
      },
      "datePublished": "2024-04-23",
      "dateModified": "2024-05-02"
     })}  
  </script>
</head>

## Introduction

Environment variables (env) are key-value pairs that can store data outside of your application code. This can include details such as API keys, and [configuration](https://12factor.net/config) options, which are isolated from your source code. 

This guide provides a step-by-step guide on adding and using environment variables (env) in a Platformatic application.  

## Setting up your Platformatic application

First, if you haven't already, you need to set up your Platformatic application. [Run the command below](https://docs.platformatic.dev/docs/getting-started/quick-start-guide/), follow the steps, and initialize your application. 

```bash
npm create platformatic@latest
```

This will create a Platformatic project directory with all the files including `platformatic.json`, where you will store your `env` values.

The `platformatic.json` file acts as the central configuration for your Platformatic application. Here, you define your database connection, server configurations, and how plugins should be loaded and configured with dynamic values from your environment variables. With this, your configurations can be easily changed without modifying your source code directly.

## Adding options to your Plugin 

In your Platformatic project, navigate to the [Plugins](https://fastify.dev/docs/latest/Reference/Plugins/) directory, and open the `example.js` file in your code editor. This file will generally be your starting point for new plugins.

Next, add [options](https://fastify.dev/docs/latest/Reference/Plugins/#plugin-options) to your Plugins. Below is an example options code for a plugin:

```js
// plugins/greetingPlugin.js

module.exports = async function (fastify, opts) {
  // Use opts to access options passed during plugin registration
  const { greeting, message } = opts;

  fastify.decorate('greet', function() {
    return `${greeting}! ${message}`;
  });
}
```

In this plugin: 

- We use [fastify.decorate](https://fastify.dev/docs/latest/Reference/Decorators/#decorators) to add a new function `greet` to the Fastify instance.
- The `greet` function uses the `greeting` and `message` provided as options to construct and return a greeting message.

## Add Options to `platformatic.json`

Modify your `platformatic.json` config file to register your new plugin along with the options set in your environment variables:

```json 
// platformatic.json

{
   "$schema": "https://platformatic.dev/schemas/v1.33.0/db",
   "db": {
     "connectionString": "{PLT_DATABASE_URL}"
   },
   "watch": {
     "ignore": [
       "*.sqlite",
       "*.sqlite-journal"
     ]
   },
   "plugins": [
     {
       "path": "./plugins/greetingPlugin",
       "options": {
         "greeting": "{GREETING}",
         "message": "{CUSTOM_MESSAGE}"
       }
     }
   ]
}
```
Ensure that you have the variables defined in your `.env` file in the root of your Platformatic application.

```text
PORT=3042
GREETING=Hello World
CUSTOM_MESSAGE=Welcome to the world of the backend without frictions
```

## Conclusion 

In this guide, you learnt how to use environment variables in a Platformatic application to manage configuration data securely. 