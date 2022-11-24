# Ignoring types and fields

`@platformatic/sql-graphql` allows to selectively ignore types and fields.

To ignore types:

```javascript
app.register(require('@platformatic/sql-graphql'), {
  ignore: {
    categories: true
  }
})
```

To ignore individual fields:

```javascript
app.register(require('@platformatic/sql-graphql'), {
  ignore: {
    categories: {
      name: true
    }
  }
})
```
