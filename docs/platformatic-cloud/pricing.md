# Platformatic Cloud Pricing

Find the plan that works best for you!


|           | Free  | Basic     | Advanced   | Pro        |
|-----------|-------|-----------|------------|------------|
| Pricing   | $0    | $4.99     | $22.45     | $49.99     |
| Slots     | 0     | 1         | 5          | 12         |
| CNAME     | -     | true      | true       | true       |
| Always On | -     | true      | true       | true       |


## FAQ

### What is a slot?

One slot is equal to one compute unit. The free plan has no always-on
machines and they will be stopped while not in use.

### What is a workspace?

A workspace is the security boundary of your deployment. You will use
the same credentials to deploy to one.

A workspace can be either static or dynamic.
A static workspace always deploy to the same domain, while
in a dynamic workspace each deployment will have its own domain.
The latter are useful to provide for pull request previews.

### Can I change or upgrade my plan after I start using Platformatic?

Plans can be changed or upgraded at any time

### What does it mean I can set my own CNAME?

Free applications only gets a `*.deploy.space` domain name to access
their application. All other plans can set it to a domain of their choosing.
