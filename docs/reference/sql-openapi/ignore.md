# Ignoring entities and fields

`@platformatic/sql-openapi` allows to selectively ignore entities and fields.

To ignore entities:

```javascript
app.register(require('@platformatic/sql-openapi'), {
  ignore: {
    category: true
  }
})
```

To ignore individual fields:

```javascript
app.register(require('@platformatic/sql-openapi'), {
  ignore: {
    category: {
      name: true
    }
  }
})
```
