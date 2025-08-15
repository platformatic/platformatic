---
title: Build Your First Watt Application
label: Build Your First Todo API with Watt
---

import NewApiProjectInstructions from '../../getting-started/new-api-project-instructions.md';
import SetupWatt from '../../getting-started/setup-watt.md';

# Build Your First Watt Application

Learn how Watt transforms API development by providing a unified application server that orchestrates multiple services with shared configuration, logging, and deployment.

## What You'll Learn

In this tutorial, you'll experience Watt's unified development workflow by building a Todo API. By the end, you will:

- ✅ **Set up a Watt application server** with unified development environment
- ✅ **Add a database service to Watt** that auto-generates REST and GraphQL APIs  
- ✅ **Experience service orchestration** - how Watt manages multiple services seamlessly
- ✅ **See unified logging and monitoring** across all services in your application
- ✅ **Understand Watt's value proposition** - one server, multiple services, unified workflow
- ✅ **Deploy a complete application** with a single command

**Time to complete:** 30 minutes  
**Skill level:** Beginner (basic SQL and JavaScript knowledge helpful)

## Why Watt for Modern Development?

Traditional Node.js development requires managing separate servers, configurations, and deployments for each part of your application. Watt eliminates this complexity by:

- **Unified Application Server**: One server runs multiple services (database APIs, custom logic, frontends)
- **Shared Configuration**: Environment variables, logging, and monitoring work consistently across all services
- **Service Orchestration**: Services communicate seamlessly without complex networking setup
- **Single Deployment**: Deploy your entire application stack with one command
- **Built-in Observability**: Unified logging, metrics, and health checks out of the box

This means you can focus on building features instead of managing infrastructure.

## Prerequisites

Before starting, ensure you have:

- [Node.js](https://nodejs.org/) (v20.16.0+ or v22.3.0+)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A code editor (like VS Code)
- Basic familiarity with the command line

You'll install the Platformatic CLI during the tutorial.

## Step 1: Create Your Watt Application Server

Let's start by creating a new Watt application. Unlike traditional Node.js development where you might run separate servers for your API, database, and frontend, Watt provides a unified application server that orchestrates all your services.

### Understanding Watt's Architecture
Watt acts as your **application server** that can host multiple **services**:
- **Database services** for auto-generated APIs
- **HTTP services** for custom business logic  
- **Frontend services** for web applications
- **Composer services** for API gateways

All services share the same configuration, logging, and deployment - giving you a unified development experience.

<SetupWatt />

**✓ Success Check:** You should see a `web/` directory created with configuration files inside.

### Experience Watt's Unified Configuration

Take a moment to examine the files Watt created:

1. **`watt.json`** - Your application server configuration
2. **`.env`** - Environment variables shared across all services  
3. **`web/`** - Directory where your services will live

Notice how Watt uses **one configuration file** and **shared environment variables** for your entire application. This is different from managing separate configurations for each service.

## Step 2: Add Your First Service to Watt

Now we'll add our first service to the Watt application server - a database service that will automatically create REST and GraphQL APIs from our schema.

### Why Add Services to Watt?
Instead of running a separate database server, API server, and frontend server, Watt lets you run them all as **services within one application server**. This means:
- **Shared configuration** - one `.env` file for all services
- **Unified logging** - all service logs in one stream  
- **Single deployment** - deploy everything together
- **Service communication** - services can talk to each other seamlessly

Navigate to your web directory and add a database service:

<NewApiProjectInstructions />

**✓ Success Check:** After running the command, you should see:
- A new `db/` directory inside `web/`
- Configuration files including `platformatic.json`
- An initial migration file in `db/migrations/`

Let's verify everything works:

```bash
npm start
```

Open your browser to `http://localhost:3042/` (or the port shown in your terminal).

**✓ Success Check:** You should see the Platformatic welcome page with links to OpenAPI documentation.

## Step 4: Define Your Service's Data Schema

Now we'll define the database structure for our Todo API service using migrations. This demonstrates how Watt services manage their own data while staying integrated with the overall application.

### Why Migrations?
Migrations provide version control for your database schema. They let you:
- Track schema changes over time
- Safely update production databases
- Share schema changes with your team

### Database Choice: SQLite for Easy Start, Enterprise Ready
The **Platformatic DB service** (running within your Watt application server) uses **SQLite by default** to get you started quickly - no separate database server setup required! 

However, the **Platformatic DB service is enterprise-ready** and supports:
- **PostgreSQL** (recommended for production)
- **MySQL/MariaDB** 
- **SQLite** (great for development and prototyping)

**Important distinction:**
- **Watt** = Your application server that orchestrates multiple services
- **Platformatic DB service** = One type of service that runs within Watt, handles database operations

#### Switching to PostgreSQL (Enterprise Setup)

If you prefer to use PostgreSQL from the start (recommended for enterprise development):

1. **Start PostgreSQL** (using Docker for convenience):
   ```bash
   docker run --name postgres-dev -e POSTGRES_PASSWORD=password -e POSTGRES_DB=todo_app -p 5432:5432 -d postgres:15
   ```

2. **Update your DB service configuration** in `web/db/.env`:
   ```bash
   # Replace the SQLite DATABASE_URL with PostgreSQL
   DATABASE_URL=postgres://postgres:password@localhost:5432/todo_app
   ```

3. **Continue with the tutorial** - all migration commands work the same way!

**For MySQL users:** Replace with `mysql://user:password@localhost:3306/todo_app`

The beauty of this architecture is that **Watt** manages the service orchestration while each **service** (like Platformatic DB) handles its own concerns. Your application code remains identical regardless of which database the DB service connects to.

#### Architecture Overview: Watt vs Platformatic DB Service

| Component | Role | Responsibilities | Configuration |
|-----------|------|------------------|---------------|
| **Watt** | Application Server | • Orchestrates multiple services<br/>• Manages unified configuration<br/>• Handles service discovery<br/>• Provides unified logging<br/>• Manages deployment | `watt.json` + shared `.env` |
| **Platformatic DB Service** | Database Service | • Connects to your database<br/>• Auto-generates REST/GraphQL APIs<br/>• Handles migrations<br/>• Manages data operations<br/>• Provides type generation | `web/db/platformatic.json` + `web/db/.env` |

**Key Distinction:**
- **Watt** is the *container* that runs your application
- **Platformatic DB** is one *service* running inside Watt
- You can have multiple services (DB, HTTP, Frontend) all managed by one Watt instance

### Create the Users Table

Navigate to `web/db/migrations/` and edit the `001.do.sql` file:

```sql
CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Also edit `web/db/migrations/001.undo.sql` to define how to reverse this migration:

```sql
DROP TABLE Users;
```

### Why Plural Table Names?
Platformatic generates RESTful endpoints based on your table names. Using plural names (Users, not User) creates more intuitive API endpoints like `/users` for listing all users.

### Create the Todos Table

Create a new file `web/db/migrations/002.do.sql`:

```sql
CREATE TABLE IF NOT EXISTS Todos (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    completed BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES Users(id)
);
```

Create `web/db/migrations/002.undo.sql`:

```sql
DROP TABLE Todos;
```

### Apply Your Migrations

Now let's create these tables in your database:

```bash
npx platformatic db migrations apply
```

**✓ Success Check:** You should see output confirming the migrations were applied. Also notice:
- A `global.d.ts` file was created with TypeScript types
- A `types/` folder contains detailed type definitions for your tables

### Why Auto-Generated Types?
The **Platformatic DB service** automatically generates TypeScript types from your database schema. This gives you:
- Type safety when writing custom plugins for any service in your Watt application
- IntelliSense in your editor
- Compile-time error checking across all services

## Step 5: Explore Your Service's Auto-Generated API

Start your Watt application with all services:

```bash
npm run dev
```

Open `http://localhost:3042/` in your browser.

![Platformatic DB local server](../images/plt-localhost.png)

**✓ Success Check:** You should see the Platformatic welcome page.

## Step 6: Experience Watt's Unified Development Environment

Before exploring the API endpoints, let's see how Watt provides a unified development experience. 

### Unified Logging and Monitoring

Open your terminal where Watt is running (`npm run dev`). Notice how **all services log to the same stream** with consistent formatting. You'll see logs from:
- The main Watt server
- Your database service 
- Any requests between services

This unified logging means you don't need to check multiple terminals or log files to debug issues across your services.

### Service Discovery and Communication

Watt automatically handles service discovery. Your database service is accessible at `/` and other services you add later can communicate with it using internal networking - no complex configuration needed.

### Discover Your Auto-Generated API Endpoints

Click on the **OpenAPI Documentation** link. This opens an interactive API explorer where you can:
- See all auto-generated endpoints
- Test requests directly in the browser
- View request/response schemas

![Todo API endpoints](../images/plt-endpoints.png)

### Test Your API

Let's create your first todo item:

1. Find the `POST /todos` endpoint
2. Click **Test Request**
3. Enter this JSON body:
   ```json
   {
     "title": "Complete Platformatic tutorial",
     "description": "Learn how to build APIs with Platformatic",
     "completed": false
   }
   ```
4. Click **Send**

![Testing API endpoint](../images/test-endpoint.png)

**✓ Success Check:** You should receive a 200 OK response with the created todo item, including its generated ID.

### Available Endpoints

The **Platformatic DB service** generated these REST endpoints for each table:
- `GET /users` - List all users
- `POST /users` - Create a user
- `GET /users/{id}` - Get a specific user
- `PUT /users/{id}` - Update a user
- `DELETE /users/{id}` - Delete a user

The same pattern applies to `/todos`. You also get GraphQL endpoints at `/graphql`!

## Step 7: Prepare for Multi-Service Architecture

One of Watt's key benefits is supporting multiple services in one application. Let's configure CORS so you can easily add a frontend service later.

### Why Configure CORS in Watt?
When you add a frontend service to your Watt application (like Next.js, React, or Vue), it needs to communicate with your database service. Watt makes this easy with unified configuration - set CORS once and it works across all your services.

Open your `web/db/.env` file and add:

```
PLT_SERVER_CORS_ORIGIN=http://localhost:3000
```

Now add the CORS configuration to your API's config file in `web/db/platformatic.json`:

```json
{
  "server": {
    "cors": {
      "origin": "{PLT_SERVER_CORS_ORIGIN}"
    }
  },
  "db": {
    "connectionString": "{DATABASE_URL}"
  }
}
```

Restart your application with `npm run dev`.

**✓ Success Check:** Your API responses will now include the `access-control-allow-origin` header, allowing frontend applications on `http://localhost:3000` to make requests.

## 🎉 Congratulations!

You've successfully built your first Watt application! Let's review what you accomplished and why this approach is transformative:

### What You Built with Watt
- ✅ **A unified application server** running multiple services seamlessly
- ✅ **Service orchestration** - database service integrated into your application  
- ✅ **Unified configuration** - single `.env` file and shared settings
- ✅ **Integrated logging** - all services logging to one stream
- ✅ **Auto-generated APIs** with zero boilerplate code
- ✅ **Production-ready setup** with TypeScript types and documentation
- ✅ **Multi-service foundation** ready for frontend and additional services

### What Makes Watt Different
Unlike traditional Node.js development where you manage separate servers, configurations, and deployments:

**Traditional Approach:**
- Separate database server + API server + frontend server
- Multiple configuration files and environment setups
- Complex inter-service communication
- Fragmented logging and monitoring
- Multiple deployment processes

**Watt Approach:**  
- **One application server** hosts all services
- **Unified configuration** across your entire application
- **Automatic service discovery** and communication  
- **Integrated observability** with unified logging
- **Single deployment** for your complete application stack

## What's Next?

Now that you understand Watt's unified approach, you can expand your application:

1. **Connect to Your Enterprise Database**: Switch from SQLite to PostgreSQL, MySQL, or your production database
2. **Add a Frontend Service**: Add a Next.js, Astro, or React stackable to your Watt application
3. **Add Custom HTTP Services**: Create additional services for business logic that work alongside your database service
4. **Add a Composer Service**: Create an API gateway that aggregates multiple services
5. **Experience Multi-Service Deployment**: Deploy your entire application stack with one command
6. **Add Authentication**: Implement authentication that works across all services in your Watt application

### Explore Watt's Full Capabilities

### Related Tutorials
- [Connect to PostgreSQL/MySQL](../../guides/databases/postgresql-setup.md) - Switch to your enterprise database
- [Add Authentication to Your API](../intermediate/authentication.md)
- [Build a Full-Stack App with Next.js](../examples/nextjs-integration.md)
- [Deploy Your API to Production](../advanced/production-deployment.md)

### Get Help
- Check the [Reference Documentation](../../reference/) for detailed configuration options
- Join our [Community Discord](https://discord.gg/platformatic) for support
- Browse [Example Applications](https://github.com/platformatic/examples) on GitHub

Happy building! 🚀
