# Explicitly including tables

`@platformatic/sql-openapi` allows for specifying tables to be included. **Note**:
using the `include` option will ignore any unspecified tables in the schema.

To include tables:

```javascript
app.register(require('@platformatic/sql-openapi'), {
  include: {
    category: true
  }
})
```
