---
title: Getting Started with Watt
label: Getting Started
---

# Getting Started with Watt

## Choose Your Learning Path

Different developers learn best in different ways. Choose the path that matches your style and available time:

### 🎯 Quick Start (5-10 minutes)
**Best for:** Developers who want immediate results and learn by experimentation

**What you'll accomplish:**
- Get a full-stack app running locally in under 5 minutes
- See auto-generated APIs from a database
- Experience Watt's unified development workflow

[**Start the Quick Start →**](/docs/getting-started/quick-start-watt)

---

### 📚 Guided Tutorial (30 minutes) 
**Best for:** Developers who prefer step-by-step learning with detailed explanations

**What you'll build:**
- Complete CRUD application with database, API, and frontend
- Understanding of Watt's service orchestration
- Production-ready configuration patterns

[**Start the Tutorial →**](/docs/learn/beginner/crud-application)

---

### 🔍 Example-Driven (15-20 minutes)
**Best for:** Developers who learn best from complete, working examples

**What you'll explore:**
- Multiple real-world application patterns
- Copy-paste ready code for common use cases
- Architecture patterns for different project types

[**Browse Examples →**](/docs/overview/use-cases-and-examples)

---

### 🔄 Migration-Focused (45-60 minutes)
**Best for:** Teams with existing Node.js applications who want to evaluate Watt

**What you'll accomplish:**
- Assessment framework for migration feasibility
- Step-by-step migration of an existing app
- Side-by-side comparison of before/after complexity

[**Start Migration Guide →**](/docs/getting-started/port-your-app)

---

## Not Sure Which Path? Use This Decision Tree

### Are you evaluating Watt for an existing project?
- **Yes** → Choose **Migration-Focused** path
- **No** → Continue below

### How do you prefer to learn new technologies?
- **I want to see it working first, then understand how** → Choose **Quick Start**
- **I want detailed explanations as I build** → Choose **Guided Tutorial**  
- **I want to see multiple complete examples** → Choose **Example-Driven**

### How much time do you have right now?
- **5 minutes** → **Quick Start**
- **15-20 minutes** → **Example-Driven** 
- **30+ minutes** → **Guided Tutorial** or **Migration-Focused**

---

## Success Criteria for Each Path

### Quick Start Success
✅ **You'll know you succeeded when:**
- You have a running app with database, API, and frontend
- You can create/read data through auto-generated APIs
- You understand Watt's unified development experience

**Estimated completion:** 5-10 minutes  
**Next step:** Try the Guided Tutorial for deeper understanding

### Guided Tutorial Success  
✅ **You'll know you succeeded when:**
- You've built a complete application from scratch
- You understand how services communicate in Watt
- You can configure different service types

**Estimated completion:** 30 minutes  
**Next step:** Explore Examples for different architecture patterns

### Example-Driven Success
✅ **You'll know you succeeded when:**
- You've identified patterns relevant to your use case
- You understand different ways to structure Watt applications
- You have starting points for your own projects

**Estimated completion:** 15-20 minutes  
**Next step:** Use Migration Guide to port existing apps, or start the Tutorial

### Migration-Focused Success
✅ **You'll know you succeeded when:**
- You have a clear assessment of migration effort for your apps
- You've successfully migrated a sample application
- You understand the benefits and trade-offs for your specific use case

**Estimated completion:** 45-60 minutes  
**Next step:** Begin migration planning for production applications

---

## Understanding Your Application Type

### Full-Stack Web Applications
**Characteristics:** Frontend + API + Database all managed together  
**Best Path:** Start with **Quick Start**, then **Guided Tutorial**  
**Why Watt fits:** Unified deployment, shared configuration, integrated tooling

### API-First Projects
**Characteristics:** Backend services with auto-generated documentation  
**Best Path:** **Quick Start** focusing on database services  
**Why Watt fits:** Auto-generated REST/GraphQL APIs, built-in OpenAPI

### Microservices Architectures  
**Characteristics:** Multiple services that need orchestration  
**Best Path:** **Example-Driven** to see service composition patterns  
**Why Watt fits:** Service mesh in a single process, simplified deployment

### Existing Node.js Applications
**Characteristics:** You have Express, Fastify, Next.js, or other Node.js apps  
**Best Path:** **Migration-Focused** for evaluation and porting  
**Why Watt fits:** Wrapper patterns for easy integration, gradual migration

---

## First-Time User Experience Flow

### 1. **Initial Assessment** (2 minutes)
- Read [What is Watt?](/docs/overview/what-is-watt) if you haven't already
- Identify your application type and learning preference above
- Check [system requirements](#system-requirements) below

### 2. **Choose Your Path** (immediate)
- Select one of the four paths based on your assessment
- Bookmark the other paths for later exploration
- Set expectations for time investment

### 3. **Complete Your Chosen Path** (5-60 minutes depending on path)
- Follow your selected path completely
- Don't jump between paths initially - complete one fully first
- Take note of concepts that resonate with your use case

### 4. **Next Steps Planning** (5 minutes)
- Review the "Next Step" recommendation for your completed path
- Identify which additional concepts you need for your project
- Choose your next learning activity

---

## System Requirements

### Required
- **Node.js** 18.0+ or 20.0+ (LTS versions recommended)
- **npm** 9.0+ or **pnpm** 8.0+ (pnpm recommended for performance)
- **Operating System:** Windows, macOS, or Linux

### Optional (for database features)
- **PostgreSQL** 12+ (recommended for production)
- **MySQL** 8.0+ or **MariaDB** 10.3+
- **SQLite** (automatically available, good for development)

### Quick Environment Check
```bash
node --version    # Should be 18.0+ or 20.0+
npm --version     # Should be 9.0+
# or
pnpm --version    # Should be 8.0+
```

---

## Common First-Time Questions

### "How is Watt different from [Express/Next.js/other framework]?"
Watt is an **application server** that runs multiple services together, rather than replacing your existing framework. Think of it as orchestration layer that can include Express, Next.js, databases, and more in a single deployment.

**Quick comparison:** [Watt vs. Alternatives](/docs/overview/comparison-with-alternatives)

### "Do I need to rewrite my existing applications?"
No. Watt provides wrapper patterns that let you integrate existing Express, Fastify, Next.js, and other Node.js applications with minimal changes.

**Learn more:** [Migration Guide](/docs/getting-started/port-your-app)

### "Is Watt production-ready?"
Yes. Watt is built on Fastify and includes production features like structured logging, metrics, health checks, and Kubernetes integration out of the box.

**See production examples:** [Deployment Guide](/docs/guides/deployment/)

### "What if I only need [database APIs/frontend hosting/etc.]?"
Watt is modular - you can use just the pieces you need. Each service type (database, HTTP, composer) can be used independently or together.

**Explore service types:** [Architecture Overview](/docs/overview/architecture-overview)

---

## Ready to Start?

Choose your path above and begin your Watt journey. Each path is designed to give you practical experience with clear success criteria.

**Remember:** You can always come back and try different paths as you learn more about Watt's capabilities.

---

## Need Help?

- **Real-time community support:** [Discord](https://discord.gg/platformatic)
- **Technical discussions:** [GitHub Discussions](https://github.com/platformatic/platformatic/discussions)
- **Bug reports:** [GitHub Issues](https://github.com/platformatic/platformatic/issues)
- **Documentation feedback:** [Docs GitHub Issues](https://github.com/platformatic/platformatic/issues?q=is%3Aissue+is%3Aopen+label%3Adocs)

The Watt team and community are active and responsive - don't hesitate to ask questions as you get started.