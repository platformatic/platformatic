'use strict'

const express = require('express')
const router = express.Router()

const setup = (pool) => {
  /**
   * @openapi
   *
   * /users:
   *    get:
   *      tags: [Users]
   *      summary: Get all the people
   *      responses:
   *        200:
   *          description: The list of people
   *          content:
   *            application/json:
   *              schema:
   *                type: array
   *                items:
   *                  type: object
   *                  properties:
   *                    id:
   *                      type: integer
   *                      description: The person id
   *                      example: 1
   *                    name:
   *                      type: string
   *                      description: The person name
   *                      example: George Lucas
   *                    email:
   *                      type: string
   *                      description: The person email
   *                      example: george.lucas@plt.dev
   */
  router.get('/', async function (_req, res) {
    const query = 'SELECT * FROM users'
    const { rows: users } = await pool.query(query)
    res.json(users)
  })

  return router
}

module.exports = setup
