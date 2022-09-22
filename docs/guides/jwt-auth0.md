# Configure JWT with Auth0

[Auth0](https://auth0.com/) is a powerful authentication and authorization service provider that can be integrated with Platformatic DB through [JSON Web Tokens](https://jwt.io/) (JWT) tokens. 
When a user is authenticated, Auth0 creates a JWT token with all necessary security informations and custom claims (like the `X-PLATFORMATIC-ROLE`, see [User Metadata](../reference/db-authorization/intro#user-metadata)) and signs the token. 

Platformatic DB needs the correct public key to verify the JWT signature. 
The fastest way is to leverage [JWKS](https://www.rfc-editor.org/rfc/rfc7517), since Auth0 exposes a [JWKS](https://www.rfc-editor.org/rfc/rfc7517) endpoint for each tenant.
Given a Auth0 tenant's `issuer` URL, the (public) keys are accessible at `${issuer}/.well-known/jwks.json`.
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

Note that specify `allowedDomains` is critical to correctly restrict the JWT that MUST be issued from one of the allowed domains.


