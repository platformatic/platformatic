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
      fields: {
        name: true
      }
    }
  }
})
```

To ignore individual routes: 

```javascript
app.register(require('@platformatic/sql-openapi'), {
  ignore: {
    categories: {
      routes: {
        GET: ['/categories/'],
        POST: ['/categories/:id']
      }
    }
  }
})
```
