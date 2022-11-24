# Ignoring entities and fields

`@platformatic/sql-openapi` allows to selectively ignore entities and fields.

To ignore entites:

```javascript
app.register(require('@platformatic/sql-openapi'), {
  ignore: {
    categories: true
  }
})
```

To ignore individual fields:

```javascript
app.register(require('@platformatic/sql-openapi'), {
  ignore: {
    categories: {
      name: true
    }
  }
})
```
