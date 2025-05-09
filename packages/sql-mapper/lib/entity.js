'use strict'

const camelcase = require('camelcase')
const {
  toSingular,
  toUpperFirst,
  toLowerFirst,
  tableName,
  sanitizeLimit,
} = require('./utils')
const { singularize } = require('inflected')
const { findNearestString } = require('@platformatic/utils')
const errors = require('./errors')
const { wrapDB } = require('./telemetry')
const { buildCursorCondition } = require('./cursor')

function createMapper (defaultDb, sql, log, table, fields, primaryKeys, relations, queries, autoTimestamp, schema, useSchemaInName, limitConfig, columns, constraintsList) {
  /* istanbul ignore next */ // Ignoring because this won't be fully covered by DB not supporting schemas (SQLite)
  const entityName = useSchemaInName ? toUpperFirst(`${schema}${toSingular(table)}`) : toSingular(table)
  /* istanbul ignore next */
  const pluralName = camelcase(useSchemaInName ? camelcase(`${schema} ${table}`) : table)
  const singularName = camelcase(entityName)

  // If the db is in the opts, uses it, otherwise uses the defaultDb
  // if telemetry is enabled, wraps the db with telemetry
  const getDB = (opts) => {
    let db = opts?.tx || defaultDb
    if (opts?.ctx?.app?.openTelemetry && opts?.ctx?.reply?.request) {
      const req = opts.ctx.reply.request
      db = wrapDB(opts.ctx.app, db, req)
    }
    return db
  }

  // Fields remapping
  const fieldMapToRetrieve = {}
  const inputToFieldMap = {}
  const camelCasedFields = Object.keys(fields).reduce((acc, key) => {
    const camel = camelcase(key)
    acc[camel] = fields[key]
    fieldMapToRetrieve[key] = camel
    inputToFieldMap[camel] = key
    fields[key].camelcase = camel
    return acc
  }, {})

  const primaryKeysTypes = Array.from(primaryKeys).map((key) => {
    return {
      key,
      sqlType: fields[key].sqlType,
    }
  })

  function fixInput (input) {
    const newInput = {}
    for (const key of Object.keys(input)) {
      const value = input[key]
      let newKey = inputToFieldMap[key]
      if (newKey === undefined) {
        if (fields[key] !== undefined) {
          newKey = key
        } else {
          throw new errors.UnknownFieldError(key)
        }
      }
      newInput[newKey] = value
    }
    return newInput
  }

  function fixOutput (output) {
    if (!output) {
      return output
    }
    const newOutput = {}
    for (const key of Object.keys(output)) {
      let value = output[key]
      const newKey = fieldMapToRetrieve[key]
      if (primaryKeys.has(key) && value !== null && value !== undefined) {
        value = value.toString()
      }
      newOutput[newKey] = value
    }
    return newOutput
  }

  async function save (args) {
    const db = getDB(args)
    if (args.input === undefined) {
      throw new errors.InputNotProvidedError()
    }
    // args.input is not array
    const fieldsToRetrieve = computeFields(args.fields).map((f) => sql.ident(f))
    const input = fixInput(args.input)

    let hasPrimaryKeys = true
    for (const key of primaryKeys) {
      if (input[key] === undefined) {
        hasPrimaryKeys = false
        break
      }
    }

    let now
    if (autoTimestamp && fields[autoTimestamp.updatedAt]) {
      now = new Date()
      input[autoTimestamp.updatedAt] = now
    }
    if (hasPrimaryKeys) { // update
      const res = await queries.updateOne(db, sql, table, schema, input, primaryKeys, fieldsToRetrieve)
      if (res) {
        return fixOutput(res)
      }
      // If we are here, the record does not exist, so we create it
      // this is inefficient because it will do 2 queries.
      // TODO there is a way to do it in one query with DB specific syntax.
    }

    // insert
    if (autoTimestamp && fields[autoTimestamp.createdAt]) {
      /* istanbul ignore next */
      now = now || new Date()
      input[autoTimestamp.createdAt] = now
    }
    const res = await queries.insertOne(db, sql, table, schema, input, primaryKeysTypes, fieldsToRetrieve)
    return fixOutput(res)
  }

  async function insert (args) {
    const db = getDB(args)
    const fieldsToRetrieve = computeFields(args.fields).map((f) => sql.ident(f))
    const inputs = args.inputs
    // This else is skipped on MySQL because of https://github.com/ForbesLindesay/atdatabases/issues/221
    /* istanbul ignore else */
    if (autoTimestamp) {
      const now = new Date()
      for (const input of inputs) {
        if (fields[autoTimestamp.createdAt]) {
          input[autoTimestamp.createdAt] = now
        }
        if (fields[autoTimestamp.updatedAt]) {
          input[autoTimestamp.updatedAt] = now
        }
      }
    }
    /* istanbul ignore next */
    if (queries.insertMany) {
      // We are not fixing the input here because it is done in the query.
      const res = await queries.insertMany(db, sql, table, schema, inputs, inputToFieldMap, primaryKeysTypes, fieldsToRetrieve, fields)
      return res.map(fixOutput)
    } else {
      // TODO this can be optimized, we can still use a batch insert if we do not want any fields
      const res = []
      for (let input of inputs) {
        input = fixInput(input)
        const resOne = await queries.insertOne(db, sql, table, schema, input, primaryKeysTypes, fieldsToRetrieve)
        res.push(fixOutput(resOne))
      }

      return res
    }
  }

  async function updateMany (args) {
    if (args.input === undefined) {
      throw new errors.InputNotProvidedError()
    }
    if (args.where === undefined || Object.keys(args.where).length === 0) {
      throw new errors.MissingWhereClauseError()
    }
    const db = getDB(args)
    const fieldsToRetrieve = computeFields(args.fields).map((f) => sql.ident(f))
    const input = fixInput(args.input)
    if (autoTimestamp && fields[autoTimestamp.updatedAt]) {
      const now = new Date()
      input[autoTimestamp.updatedAt] = now
    }
    const criteria = computeCriteria(args)

    const res = await queries.updateMany(db, sql, table, schema, criteria, input, fieldsToRetrieve)
    return res.map(fixOutput)
  }

  function computeFields (fields) {
    if (!fields) {
      return Object.values(inputToFieldMap)
    }

    /**
     * The 'field' can be a relational field which is undefined
     * in the inputToFieldMap
     * @see sql-graphql
    */
    const requestedFields = fields.map((field) => {
      if (relations.some((relation) => field === relation.column_name)) {
        return field
      }
      return inputToFieldMap[field]
    })

    const set = new Set(requestedFields)
    set.delete(undefined)
    const fieldsToRetrieve = [...set]
    return fieldsToRetrieve
  }

  const whereMap = {
    eq: '=',
    in: 'IN',
    nin: 'NOT IN',
    neq: '<>',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    like: 'LIKE',
    ilike: 'ILIKE',
    any: 'ANY',
    all: 'ALL',
    contains: '@>',
    contained: '<@',
    overlaps: '&&',
  }

  function computeCriteria (opts) {
    const where = opts.where || {}
    const criteria = []
    for (const key of Object.keys(where)) {
      if (key === 'or') {
        const orCriteria = []
        for (const orPart of where[key]) {
          const cret = computeCriteria({ where: orPart })
          orCriteria.push(sql`(${sql.join(cret, sql` AND `)})`)
        }
        criteria.push(sql`(${sql.join(orCriteria, sql` OR `)})`)
        continue
      }
      const value = where[key]
      const field = inputToFieldMap[key]
      if (!field) {
        throw new errors.UnknownFieldError(key)
      }
      for (const key of Object.keys(value)) {
        const operator = whereMap[key]
        /* istanbul ignore next */
        if (!operator) {
          // This should never happen
          throw new errors.UnsupportedWhereClauseError(JSON.stringify(where[key]))
        }
        const fieldWrap = fields[field]
        /* istanbul ignore next */
        if (fieldWrap.isArray) {
          if (operator === 'ANY') {
            criteria.push(sql`${value[key]} = ANY (${sql.ident(field)})`)
          } else if (operator === 'ALL') {
            criteria.push(sql`${value[key]} = ALL (${sql.ident(field)})`)
          } else if (operator === '@>') {
            criteria.push(sql`${sql.ident(field)} @> ${value[key]}`)
          } else if (operator === '<@') {
            criteria.push(sql`${sql.ident(field)} <@ ${value[key]}`)
          } else if (operator === '&&') {
            criteria.push(sql`${sql.ident(field)} && ${value[key]}`)
          } else {
            throw new errors.UnsupportedOperatorForArrayFieldError()
          }
        } else if (operator === '=' && value[key] === null) {
          criteria.push(sql`${sql.ident(field)} IS NULL`)
        } else if (operator === '<>' && value[key] === null) {
          criteria.push(sql`${sql.ident(field)} IS NOT NULL`)
        } else if (operator === 'LIKE' || operator === 'ILIKE') {
          let leftHand = sql.ident(field)
          // NOTE: cast fields AS CHAR(64) and TRIM the whitespaces
          // to prevent errors with fields different than VARCHAR & TEXT
          if (!['text', 'varchar'].includes(fieldWrap.sqlType)) {
            leftHand = sql`TRIM(CAST(${sql.ident(field)} AS CHAR(64)))`
          }
          const like = operator === 'LIKE' ? sql`LIKE` : queries.hasILIKE ? sql`ILIKE` : sql`LIKE`
          criteria.push(sql`${leftHand} ${like} ${value[key]}`)
        } else if (operator === 'ANY' || operator === 'ALL' || operator === '@>' || operator === '<@' || operator === '&&') {
          throw new errors.UnsupportedOperatorForNonArrayFieldError()
        } else {
          criteria.push(sql`${sql.ident(field)} ${sql.__dangerous__rawValue(operator)} ${computeCriteriaValue(fieldWrap, value[key])}`)
        }
      }
    }
    return criteria
  }

  function computeCriteriaValue (fieldWrap, value) {
    if (Array.isArray(value)) {
      return sql`(${sql.join(
        value.map((v) => computeCriteriaValue(fieldWrap, v)),
        sql`, `
      )})`
    }

    /* istanbul ignore next */
    if (fieldWrap.sqlType === 'int4' || fieldWrap.sqlType === 'int2' || fieldWrap.sqlType === 'float8' || fieldWrap.sqlType === 'float4') {
      // This cat is needed in PostgreSQL
      return sql`${Number(value)}`
    } else {
      return sql`${value}`
    }
  }

  async function find (opts = {}) {
    const db = getDB(opts)
    const fieldsToRetrieve = computeFields(opts.fields).map((f) => sql.ident(f))
    const criteria = computeCriteria(opts)
    const criteriaExists = criteria.length > 0
    const isBackwardPagination = opts.nextPage === false

    let query = sql`
      SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
      FROM ${tableName(sql, table, schema)}
    `

    if (criteriaExists) {
      query = sql`${query} WHERE ${sql.join(criteria, sql` AND `)}`
    }

    if (opts.cursor) {
      const cursorCondition = buildCursorCondition(sql, opts.cursor, opts.orderBy, inputToFieldMap, fields, computeCriteriaValue, primaryKeys, isBackwardPagination)
      if (cursorCondition) {
        if (criteriaExists) query = sql`${query} AND ${cursorCondition}`
        else query = sql`${query} WHERE ${cursorCondition}`
      }
    }

    if (opts.orderBy && opts.orderBy.length > 0) {
      const orderBy = opts.orderBy.map((order) => {
        const field = inputToFieldMap[order.field]
        let direction = order.direction.toLowerCase()
        if (isBackwardPagination) {
          direction = direction === 'asc' ? 'desc' : 'asc'
        }
        return sql`${sql.ident(field)} ${sql.__dangerous__rawValue(direction)}`
      })
      query = sql`${query} ORDER BY ${sql.join(orderBy, sql`, `)}`
    }

    if (opts.paginate !== false) {
      query = sql`${query} LIMIT ${sanitizeLimit(opts.limit, limitConfig)}`
      if (opts.offset !== undefined) {
        if (opts.offset < 0) {
          throw new errors.ParamNotAllowedError(opts.offset)
        }
        query = sql`${query} OFFSET ${opts.offset}`
      }
    }

    const rows = await db.query(query)
    const res = rows.map(fixOutput)
    return isBackwardPagination ? res.reverse() : res
  }

  async function count (opts = {}) {
    const db = getDB(opts)
    let totalCountQuery = null
    totalCountQuery = sql`
        SELECT COUNT(*) AS total 
        FROM ${tableName(sql, table, schema)}
      `
    const criteria = computeCriteria(opts)
    if (criteria.length > 0) {
      totalCountQuery = sql`${totalCountQuery} WHERE ${sql.join(criteria, sql` AND `)}`
    }
    const [{ total }] = await db.query(totalCountQuery)
    return +total
  }

  async function _delete (opts) {
    const db = getDB(opts)
    const fieldsToRetrieve = computeFields(opts.fields).map((f) => sql.ident(f))
    const criteria = computeCriteria(opts)
    const res = await queries.deleteAll(db, sql, table, schema, criteria, fieldsToRetrieve)
    return res.map(fixOutput)
  }

  return {
    name: entityName,
    singularName,
    pluralName,
    primaryKeys,
    table,
    schema,
    fields,
    camelCasedFields,
    fixInput,
    fixOutput,
    find,
    count,
    insert,
    save,
    delete: _delete,
    updateMany,
  }
}

function buildEntity (db, sql, log, table, queries, autoTimestamp, schema, useSchemaInName, ignore, limitConfig, schemaList, columns, constraintsList) {
  const columnsNames = columns.map(c => c.column_name)
  for (const ignoredColumn of Object.keys(ignore)) {
    if (!columnsNames.includes(ignoredColumn)) {
      const nearestColumn = findNearestString(columnsNames, ignoredColumn)
      log.warn(`Ignored column "${ignoredColumn}" not found. Did you mean "${nearestColumn}"?`)
    }
  }

  // Compute the columns
  columns = columns.filter((c) => !ignore[c.column_name])
  const fields = columns.reduce((acc, column) => {
    acc[column.column_name] = {
      sqlType: column.udt_name,
      isNullable: column.is_nullable === 'YES',
      isArray: column.isArray,
    }

    // To get enum values in mysql and mariadb
    /* istanbul ignore next */
    if (column.udt_name === 'enum') {
      acc[column.column_name].enum = column.column_type.match(/'(.+?)'/g).map(enumValue => enumValue.slice(1, enumValue.length - 1))
    }

    if (autoTimestamp && (column.column_name === autoTimestamp.createdAt || column.column_name === autoTimestamp.updatedAt)) {
      acc[column.column_name].autoTimestamp = true
    }

    // To get generated information
    /* istanbul ignore next */
    if (db.isPg) {
      acc[column.column_name].isGenerated = column.is_generated !== 'NEVER'
    } else if (db.isSQLite) {
      acc[column.column_name].isGenerated = column.is_generated === 'YES'
    } else {
      acc[column.column_name].isGenerated = column.is_generated.includes('GENERATED')
    }

    // To get enum values in pg
    /* istanbul ignore next */
    if (column.enum) {
      acc[column.column_name].enum = column.enum
    }

    return acc
  }, {})

  const currentRelations = []

  const primaryKeys = new Set()

  /* istanbul ignore next */
  function checkSQLitePrimaryKey (constraint) {
    if (db.isSQLite) {
      const validTypes = ['varchar', 'integer', 'uuid', 'serial']
      const pkType = fields[constraint.column_name].sqlType.toLowerCase()
      if (!validTypes.includes(pkType)) {
        throw new errors.InvalidPrimaryKeyTypeError(pkType, validTypes.join(', '))
      }
    }
  }

  for (const constraint of constraintsList) {
    const field = fields[constraint.column_name]

    /* istanbul ignore next */
    if (!field) {
      // This should never happen
      log.warn({
        constraint,
      }, `No field for ${constraint.column_name}`)
      continue
    }

    if (constraint.constraint_type === 'PRIMARY KEY') {
      primaryKeys.add(constraint.column_name)
      // Check for SQLite typeless PK
      checkSQLitePrimaryKey(constraint)
      field.primaryKey = true
    }

    // we need to ignore for coverage here because cannot be covered with sqlite (no schema support)
    // istanbul ignore next
    const isForeignKeySchemaInConfig = schemaList?.length > 0 ? schemaList.includes(constraint.foreign_table_schema) : true
    /* istanbul ignore if */
    if (constraint.constraint_type === 'FOREIGN KEY' && isForeignKeySchemaInConfig) {
      field.foreignKey = true
      const foreignEntityName = singularize(camelcase(useSchemaInName ? camelcase(`${constraint.foreign_table_schema} ${constraint.foreign_table_name}`) : constraint.foreign_table_name))
      const entityName = singularize(camelcase(useSchemaInName ? camelcase(`${constraint.table_schema} ${constraint.table_name}`) : constraint.table_name))
      const loweredTableWithSchemaName = toLowerFirst(useSchemaInName ? camelcase(`${constraint.table_schema} ${camelcase(constraint.table_name)}`) : camelcase(constraint.table_name))
      constraint.loweredTableWithSchemaName = loweredTableWithSchemaName
      constraint.foreignEntityName = foreignEntityName
      constraint.entityName = entityName
      currentRelations.push(constraint)
    }
  }

  if (primaryKeys.size === 0) {
    let found = false
    for (const constraint of constraintsList) {
      const field = fields[constraint.column_name]

      /* istanbul ignore else */
      if (constraint.constraint_type === 'UNIQUE') {
        field.unique = true

        /* istanbul ignore else */
        if (!found) {
          // Check for SQLite typeless PK
          /* istanbul ignore next */
          try {
            checkSQLitePrimaryKey(constraint)
          } catch {
            continue
          }

          primaryKeys.add(constraint.column_name)
          field.primaryKey = true
          found = true
        }
      }
    }
  }

  const entity = createMapper(db, sql, log, table, fields, primaryKeys, currentRelations, queries, autoTimestamp, schema, useSchemaInName, limitConfig)
  entity.relations = currentRelations

  return entity
}

module.exports = buildEntity
