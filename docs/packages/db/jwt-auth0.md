# Configure JWT with Auth0

[Auth0](https://auth0.com/) is a powerful authentication and authorization service provider that can be integrated with Platformatic DB through [JSON Web Tokens](https://jwt.io/) (JWT) tokens. 
When a user is authenticated, Auth0 creates a JWT token with all necessary security information and custom claims (like the `X-PLATFORMATIC-ROLE`, see [User Metadata](../reference/db/authorization/introduction#user-metadata)) and signs the token. 

Platformatic DB needs the correct public key to verify the JWT signature. 
The fastest way is to leverage [JWKS](https://www.rfc-editor.org/rfc/rfc7517), since Auth0 exposes a [JWKS](https://www.rfc-editor.org/rfc/rfc7517) endpoint for each tenant.
Given an Auth0 tenant's `issuer` URL, the (public) keys are accessible at `${issuer}/.well-known/jwks.json`.
For instance, if `issuer` is: `https://dev-xxx.us.auth0.com/`, the public keys are accessible at `https://dev-xxx.us.auth0.com/.well-known/jwks.json`

To configure Platformatic DB authorization to use [JWKS](https://www.rfc-editor.org/rfc/rfc7517) with Auth0, set:

```json 

...
"authorization": {
    "jwt": {
      "jwks": {
        "allowedDomains": [
          "https://dev-xxx.us.auth0.com/"
        ]
      }
    },
  }
...

```
:::danger
Note that specify `allowedDomains` is critical to correctly restrict the JWT that MUST be issued from one of the allowed domains.
:::

## Custom Claim Namespace

In Auth0 there are [restrictions](https://auth0.com/docs/secure/tokens/json-web-tokens/create-custom-claims#general-restrictions) about the custom claim that can be set on access tokens. One of these is that the custom claims MUST be namespaced, i.e. we cannot have `X-PLATFORMATIC-ROLE` but we must specify a namespace, e.g.: `https://platformatic.dev/X-PLATFORMATIC-ROLE`

To map these claims to user metadata removing the namespace, we can specify the namespace in the JWT options:

```json
...
"authorization": {
    "jwt": {
      "namespace": "https://platformatic.dev/",
      "jwks": {
        "allowedDomains": [
          "https://dev-xxx.us.auth0.com/"
        ]
      }
    },
  }
...

```
With this configuration, the `https://platformatic.dev/X-PLATFORMATIC-ROLE` claim is mapped to `X-PLATFORMATIC-ROLE` user metadata.

