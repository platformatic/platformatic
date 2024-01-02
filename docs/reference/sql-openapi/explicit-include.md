# Explicitly including entities

`@platformatic/sql-openapi` allows for specifying entities to be included. **Note**:
using this method will ignore any unspecified entities in the schema.

To include entities:

```javascript
app.register(require('@platformatic/sql-openapi'), {
  include: {
    category: true
  }
})
```
