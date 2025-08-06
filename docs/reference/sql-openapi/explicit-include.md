# Explicitly including entities

`@platformatic/sql-openapi` allows you to specify which entities to be included. 

**Note**: Using the `include` option will ignore any unspecified entities in the schema.

## Including Entities 

To include specific entities, use the following configuration:

```javascript
app.register(require('@platformatic/sql-openapi'), {
  include: {
    category: true
  }
})
```
