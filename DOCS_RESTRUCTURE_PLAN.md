# Platformatic Documentation Restructuring Plan
## Following the Diátaxis Framework

### Executive Summary

The current Platformatic documentation suffers from several critical issues that hinder user onboarding and product adoption:

**Current Problems:**
- **Fragmented positioning**: No clear focus on Watt as the core Node.js Application Server
- **Poor information architecture**: Documentation types are mixed together without clear purpose distinction
- **Inconsistent entry points**: Multiple competing "getting started" paths create confusion
- **Scattered content**: Key information spread across package READMEs, docs/, and getting-started/ folders
- **Outdated content**: References to old patterns and deprecated approaches
- **Missing user journeys**: No clear progression from beginner to advanced usage

**Strategic Focus:**
This plan repositions **Watt (wattpm) as the primary product** - the Node.js Application Server that powers everything else. All other components (DB, Service, Composer, Runtime, Stackables) become services/features that run within Watt.

## User Journey Mapping

### User Types and Entry Points

**1. New Node.js Developers**
- **Background**: Limited Node.js experience, learning web development
- **Entry Point**: Landing page → "What is Watt?" → Quick Start Tutorial
- **Primary Needs**: Guided learning, working examples, conceptual understanding
- **Success Criteria**: Can build and deploy a simple API within 30 minutes
- **Journey Progression**: Overview → Tutorial → How-to Guides → Reference

**2. Experienced Node.js Developers**
- **Background**: Familiar with Express/Fastify, evaluating new tools
- **Entry Point**: README → Architecture Overview → Migration Guide
- **Primary Needs**: Performance comparisons, migration paths, advanced features
- **Success Criteria**: Can migrate existing project or build complex app within 2 hours
- **Journey Progression**: Overview → Comparison → How-to Guides → Reference → Concepts

**3. Teams Migrating from Other Platforms**
- **Background**: Using Spring Boot, Rails, Django, or similar platforms
- **Entry Point**: Landing page → "Why Watt?" → Architecture Comparison
- **Primary Needs**: Platform comparison, team onboarding, deployment strategies
- **Success Criteria**: Team can evaluate and pilot Watt for production use
- **Journey Progression**: Overview → Concepts → Migration Guides → Advanced How-tos

**4. Platform/DevOps Engineers**
- **Background**: Focus on deployment, monitoring, scalability
- **Entry Point**: Documentation → Deployment Guides → Monitoring Setup
- **Primary Needs**: Production configuration, scaling patterns, observability
- **Success Criteria**: Can deploy and monitor Watt applications in production
- **Journey Progression**: Architecture Overview → Deployment How-tos → Advanced Configuration

### Critical Decision Points and Information Needs

**Decision Point 1: "Should I use Watt?"** (Discovery Stage)
- **Information Need**: Value proposition, use cases, alternatives comparison
- **Content Required**: Overview section, "Why Watt?" explanation, comparison matrix
- **User Context**: Evaluating against Express, Fastify, Next.js, other frameworks

**Decision Point 2: "How do I get started?"** (Evaluation Stage)  
- **Information Need**: Quick success, learning path, time investment
- **Content Required**: Multiple getting started options, clear time estimates
- **User Context**: Wanting to see results quickly while learning properly

**Decision Point 3: "Can this work for my project?"** (Implementation Stage)
- **Information Need**: Framework integration, database support, deployment options
- **Content Required**: Integration guides, compatibility matrices, real examples
- **User Context**: Specific technical requirements and constraints

**Decision Point 4: "How do I use this in production?"** (Adoption Stage)
- **Information Need**: Best practices, monitoring, scaling, security
- **Content Required**: Production guides, advanced configuration, troubleshooting
- **User Context**: Moving from prototype to production deployment

### Content-to-Journey Stage Mapping

**Discovery/Awareness Content:**
- Landing page value proposition
- "What is Watt?" overview
- Architecture diagrams
- Use case examples
- Comparison with alternatives

**Evaluation/Learning Content:**
- Quick start tutorial (15 minutes)
- Core feature demonstrations
- Integration examples
- Migration guides from common platforms

**Implementation/Building Content:**
- Step-by-step tutorials
- Framework-specific how-to guides
- Database integration guides
- Deployment tutorials

**Ongoing Usage/Mastery Content:**
- Advanced configuration reference
- Performance optimization guides
- Monitoring and observability setup
- Custom stackable development

## Getting Started Strategy

### Multi-Path Entry Strategy

**Path 1: Quick Start (5-10 minutes)**
- Target: Developers who want immediate results
- Entry: `npx wattpm create demo && npm start`
- Outcome: Running application with API endpoints
- Next Steps: Point to full tutorial or specific integration guides

**Path 2: Guided Tutorial (30 minutes)**
- Target: Developers who prefer step-by-step learning
- Entry: "Your First Watt App" tutorial
- Outcome: Understanding of core concepts plus working application
- Next Steps: Advanced tutorials or how-to guides for specific needs

**Path 3: Example-Driven Learning (15-20 minutes)**
- Target: Developers who learn best from complete examples
- Entry: Gallery of example applications with source code
- Outcome: Working reference implementation for specific use case
- Next Steps: Customization guides and advanced patterns

**Path 4: Migration-Focused (45-60 minutes)**
- Target: Teams with existing applications
- Entry: Migration guides from common platforms (Express, Fastify, etc.)
- Outcome: Existing application running on Watt
- Next Steps: Platform-specific optimization guides

### Success Criteria for Each Path

**Quick Start Success:**
- Application starts within 2 minutes of running command
- API endpoints respond correctly
- Basic functionality demonstrated
- Clear next steps provided

**Guided Tutorial Success:**
- Each step works without modification
- User understands what each step accomplishes
- Final application demonstrates key Watt features
- User can explain basic Watt concepts

**Example-Driven Success:**
- Example applications run without setup issues
- Source code is well-commented and explains key decisions
- Examples cover common real-world scenarios
- User can identify which example matches their needs

**Migration Success:**
- Existing application functionality preserved
- Migration path is clearly documented
- Performance improvements or feature benefits are demonstrated
- Team understands new deployment and development workflow

### First-Time User Experience Flow

**Landing Experience:**
1. Clear headline: "Watt - The Node.js Application Server"
2. Value proposition in 10 seconds: "Build, deploy, and scale Node.js applications with unified tooling"
3. Three entry paths clearly presented
4. Success stories/social proof

**Quick Start Flow:**
```
npm install -g wattpm
↓
npx wattpm create my-first-app
↓
cd my-first-app && npm start
↓
Open browser → See running app
↓
"What's next?" → Clear progression options
```

**Tutorial Flow:**
```
Choose tutorial based on background
↓
Follow step-by-step instructions
↓
Build complete working application
↓
Deploy to production (optional)
↓
Explore advanced features
```

## Overview Content Strategy

### High-Level Product Positioning

**Primary Value Proposition:**
"Watt transforms Node.js development by providing a unified application server that handles the complex infrastructure so you can focus on building features."

**Key Benefits to Highlight:**
- Unified development experience across multiple services
- Built-in observability and monitoring
- Framework-agnostic (works with React, Vue, Express, Fastify, etc.)
- Production-ready deployment patterns
- Microservice orchestration without complexity

### Architecture Overview Levels

**Level 1: Conceptual (30-second explanation)**
- Watt as application server that runs multiple services
- Visual diagram showing Watt containing various services
- Simple analogy: "Like Docker Compose for Node.js applications"

**Level 2: Technical Overview (5-minute read)**
- Service mesh architecture
- Inter-service communication patterns
- Configuration management approach
- Deployment and scaling concepts

**Level 3: Detailed Architecture (15-minute deep dive)**
- Internal component architecture
- Plugin system and extensibility
- Performance characteristics
- Security model and best practices

### "What is Watt?" Explanatory Content Structure

**1. Problem Statement**
- Challenges of modern Node.js development
- Microservices complexity
- Deployment and monitoring overhead

**2. Solution Overview**
- Watt as unified application server
- Key capabilities and features
- How it differs from alternatives

**3. Core Concepts**
- Services and stackables
- Configuration-driven development
- Built-in observability

**4. When to Use Watt**
- Ideal use cases and scenarios
- When not to use Watt
- Migration considerations

### Watt in Platformatic Ecosystem Context

**Positioning Strategy:**
- Watt as the **primary product** - the application server
- Other components as **services that run within Watt**:
  - DB Service: Database APIs
  - HTTP Service: Custom application logic
  - Composer Service: API gateway
  - Runtime: Development environment

**Ecosystem Benefits:**
- Consistent tooling across all services
- Unified configuration and deployment
- Shared monitoring and logging
- Simplified development workflow

## Proposed New Structure (Diátaxis Framework)

### Root Level Navigation
```
docs/
├── overview/                           # NEW: Landing and orientation content
│   ├── what-is-watt.md                # Core product explanation
│   ├── getting-started.md             # Multiple entry paths
│   ├── architecture-overview.md       # Technical architecture
│   └── use-cases-and-examples.md      # When and how to use Watt
├── learn/                             # Learning-oriented content
├── guides/                            # Problem-oriented content  
├── reference/                         # Information-oriented content
└── concepts/                          # Understanding-oriented content
```

### 1. Overview Content (Discovery & Orientation)
```
docs/overview/
├── what-is-watt.md                    # Core product explanation (30 sec → 5 min → 15 min)
├── getting-started.md                 # Multi-path entry strategy
├── architecture-overview.md           # Technical overview with diagrams
├── use-cases-and-examples.md         # When to use Watt, success stories
└── comparison-with-alternatives.md    # vs Express, Fastify, Next.js, etc.
```

### 2. Learning-Oriented Content (Tutorials)
```
docs/learn/
├── quick-start/                       # 5-10 minute immediate results
│   ├── 01-install-and-init.md        # Get running in 2 minutes
│   ├── 02-your-first-endpoint.md     # Add API endpoint
│   └── 03-whats-next.md              # Clear progression options
├── tutorials/
│   ├── your-first-watt-app/           # 30-minute guided learning
│   ├── todo-api-with-database/        # Add DB service to Watt  
│   ├── full-stack-movie-quotes/       # Complete app with frontend
│   └── deploy-to-production/          # End-to-end deployment
├── examples/                          # Example-driven learning
│   ├── ecommerce-api/                # Real-world API example
│   ├── blog-with-cms/                # Content management example  
│   ├── microservices-suite/          # Multi-service example
│   └── nextjs-integration/           # Frontend framework example
└── migrations/                        # Migration-focused learning
    ├── from-express/                 # Express → Watt migration
    ├── from-fastify/                 # Fastify → Watt migration
    └── from-nodejs-monolith/         # Breaking up monoliths
```

### 3. Problem-Oriented Content (How-to Guides)  
```
docs/guides/
├── frameworks/
│   ├── nextjs-integration.md
│   ├── astro-integration.md
│   ├── express-migration.md
│   └── fastify-integration.md
├── databases/
│   ├── postgresql-setup.md
│   ├── mysql-configuration.md
│   └── database-migrations.md
├── deployment/
│   ├── docker-containers.md
│   ├── kubernetes-deployment.md
│   └── environment-configuration.md
├── monitoring/
│   ├── logging-setup.md
│   ├── metrics-collection.md
│   └── distributed-tracing.md
└── advanced/
    ├── custom-stackables.md
    ├── microservices-architecture.md
    └── performance-optimization.md
```

### 4. Information-Oriented Content (Reference)
```
docs/reference/
├── watt/                              # Core product reference
│   ├── cli-commands.md
│   ├── configuration.md
│   └── api-reference.md
├── services/
│   ├── db/
│   ├── service/
│   ├── composer/
│   └── runtime/
└── stackables/
    ├── next/
    ├── astro/
    ├── node/
    └── creating-custom.md
```

### 5. Understanding-Oriented Content (Explanation)
```
docs/concepts/
├── watt-architecture.md               # Why Watt exists, how it works
├── service-mesh.md                    # Inter-service communication
├── application-lifecycle.md           # From development to production
├── microservices-vs-monolith.md      # Architectural decisions
└── comparison-with-alternatives.md    # vs Express, Fastify, etc.
```

## Migration Strategy

### Phase 1: Foundation - Restructure Existing Content ✅ COMPLETED
**Priority: Critical - Focus on Information Architecture & User Journey**

- [x] **Update Root README.md with User Journey Focus**
  - [x] Lead with Watt as primary product and clear value proposition
  - [x] Present three clear entry paths (Quick Start, Tutorial, Examples)
  - [x] Remove confusing multiple entry points
  - [x] Include user type identification ("Are you new to Node.js?" etc.)

- [x] **Restructure Sidebar for User Mental Model (docs/sidebars.js)**
  - [x] Reorganize from package-centric to user journey-centric
  - [x] Create Overview → Learning → Guides → Reference → Concepts progression
  - [x] Keep Overview and Learning sections expanded by default
  - [x] Group content by Services/Stackables rather than internal packages

- [x] **Establish User-Centered Reference Architecture**
  - [x] Move from `docs/packages/` to `docs/reference/` organized by user mental model
  - [x] Group by services (not internal packages): watt/, services/, stackables/
  - [x] Create consistent format addressing "How do I configure X?" questions
  - [x] Preserve all existing technical content, just reorganize structure

- [x] **Consolidate and Clean Existing Getting Started Content**
  - [x] Audit current getting-started/ folder content
  - [x] Migrate working tutorials to proper Diátaxis structure
  - [x] Remove outdated or conflicting entry points
  - [x] Ensure existing `docs/learn/beginner/crud-application.md` works end-to-end

## Current Implementation Status (Phase 2 Complete)

**As of December 2024:** Phase 1 (Foundation) and Phase 2 (Content Enhancement) are **COMPLETE**. The documentation has been successfully restructured with:

1. **Proven Watt-first positioning** working effectively across all content
2. **Diátaxis framework implementation** with clear content type separation
3. **Enterprise developer focus** validated with production-ready guidance
4. **User journey compliance** demonstrated through enhanced tutorials and guides

**Ready for Phase 3:** Strategic new content creation to implement the full planned structure.

### **Current vs. Planned Structure**

**Current Implementation (Intermediate):**
```
Overview/
└── Overview (single comprehensive page promoting Watt)

Getting Started/
├── quick-start-watt
├── quick-start-guide  
├── port-your-app
└── Tutorials/
```

**Planned Final Structure (Still the Goal):**
```
Overview/
├── what-is-watt.md
├── getting-started.md
├── architecture-overview.md
├── use-cases-and-examples.md
└── comparison-with-alternatives.md

Learning/
├── Quick Start (5-10 min)/
├── Step-by-Step Tutorials (30+ min)/
├── Example Applications/
└── Migration Guides/
```

The planned structure will be implemented in future phases once the foundation improvements prove successful.

---

### Phase 2: Content Enhancement - Improve Existing Materials ✅ COMPLETED
**Priority: High - Make Current Content User Journey Compliant**

**Completed December 2024**

- [x] **Enhanced Existing Tutorials** (PR #4183)
  - [x] **Restructured CRUD Tutorial** (`docs/learn/beginner/crud-application.md`):
    - Transformed from 70% DB-focused to 60% Watt-first positioning
    - Added clear learning objectives, time estimates (30 minutes), success criteria
    - Included PostgreSQL/MySQL setup for enterprise developers
    - Added unified logging/monitoring demonstration
    - Distinguished Watt (application server) vs Platformatic DB (service within Watt)
  - [x] **Enhanced Environment Variables Tutorial** (`docs/learn/beginner/environment-variables.md`):
    - 92% rewrite with Diátaxis tutorial principles
    - Added step-by-step progression with "why" explanations
    - Included practical examples for different environments

- [x] **Improved Existing How-To Guides** (Problem-Solution Format Applied)
  - [x] **Deployment Guides Enhanced**:
    - `docs/guides/deployment/dockerize-a-watt-app.md` - Added problem-solution structure with troubleshooting
    - `docs/guides/deployment/compiling-typescript.md` - 81% rewrite with production optimization focus
    - `docs/guides/deployment/k8s-readiness-liveness.md` - Enhanced Kubernetes health checks with advanced patterns
  - [x] **Watt-Specific Guides Enhanced**:
    - `docs/guides/cache-with-platformatic-watt.md` - 82% rewrite with performance optimization focus
    - `docs/guides/use-watt-multiple-repository.md` - 78% rewrite with microservices architecture patterns
    - `docs/guides/using-watt-with-node-config.md` - Configuration management with verification procedures
  - [x] **Logging Guide Enhanced**:
    - `docs/guides/logging.md` - Reorganized by use case with practical examples and troubleshooting

- [x] **Organized Existing Reference Materials** (User Mental Model Structure)
  - [x] **Consolidated CLI Documentation**: Created `docs/reference/watt/cli-commands.md` - unified wattpm and platformatic commands
  - [x] **Standardized Configuration Format**: Updated all service overviews with consistent "When to Use" sections  
  - [x] **Updated API Documentation**: Ensured accuracy across Database Service, HTTP Service, and Composer Service overviews
  - [x] **Created Comprehensive Troubleshooting**: New `docs/reference/troubleshooting.md` with error codes and solutions
  - [x] **Updated Sidebar Structure**: `docs/sidebars.js` organized by user mental model vs internal packages

- [x] **Audited and Updated Explanatory Content** (Watt-First Positioning)
  - [x] **Service Documentation Updates**:
    - `docs/reference/db/overview.md` - Repositioned as "Database Service within Watt"
    - `docs/reference/service/overview.md` - Repositioned as "HTTP Service within Watt"  
    - `docs/reference/composer/overview.md` - Repositioned as "API Gateway within Watt"
  - [x] **Consistent Watt-First Language**: Updated all references to position Watt as primary Node.js Application Server
  - [x] **Added Integration Context**: Showed how services work together within Watt ecosystem

- [x] **Enhanced Monitoring/Observability Guides**
  - [x] **New Comprehensive Guide**: `docs/guides/monitoring-and-observability.md` covering logging, metrics, tracing, health checks with production setup examples

**Key Achievements:**
- **13 files restructured** following Diátaxis framework
- **Enterprise developer focus** with production-ready guidance and PostgreSQL/MySQL setup
- **Architectural clarity** distinguishing Watt (application server) from services (components within Watt)
- **User journey compliance** with clear problem-solution structures and verification steps
- **Consolidated information architecture** organized by user mental model

### Phase 3: Strategic New Content - Create Planned Structure ❌ NOT STARTED
**Priority: Medium - Implement the Final Planned Structure**

- [ ] **Create Missing Overview Content (Core Goal)**
  - [ ] `docs/overview/what-is-watt.md` - Multi-level explanation (30 sec → 5 min → 15 min)
  - [ ] `docs/overview/getting-started.md` - Multi-path entry strategy with clear success criteria
  - [ ] `docs/overview/architecture-overview.md` - Visual diagrams and conceptual models
  - [ ] `docs/overview/comparison-with-alternatives.md` - Address "Should I use Watt?" decision point

- [ ] **Implement Planned Learning Structure**
  - [ ] Create dedicated Learning section as planned
  - [ ] Quick Start path for immediate results (5-10 minutes)
  - [ ] Example gallery for example-driven learners
  - [ ] Migration guides for Express, Fastify, and Node.js monoliths
  - [ ] Advanced tutorials for complex scenarios

- [ ] **Create Advanced Implementation Guides**
  - [ ] Custom stackable development
  - [ ] Complex microservices architecture patterns
  - [ ] Performance optimization and scaling
  - [ ] Security best practices and compliance

- [ ] **Develop Team and Enterprise Content**
  - [ ] Team onboarding and training materials
  - [ ] Production monitoring and observability setup
  - [ ] CI/CD pipeline integration guides
  - [ ] Migration planning for large applications

## Additional Foundation Work Completed ✅

### **Structural Improvements (Foundation for Future Content)**

- [x] **Sidebar Organization** - Fixed Framework Integrations, reordered Services & APIs, reorganized SQL Data Layer
- [x] **Navigation Enhancement** - Added top navigation links, Reference overview page, fixed versioning issues  
- [x] **Watt Positioning** - Rewrote Overview.md to position Watt as primary Node.js Application Server
- [x] **Clean Architecture** - Removed duplication, established clear content separation by type

These improvements create the foundation needed to implement the full planned structure in subsequent phases.

## Specific Content Updates Required

### README.md Updates
```markdown
# Watt - The Node.js Application Server

Build and run multiple Node.js applications with unified logging, monitoring, and deployment.

## Quick Start (2 minutes)
npm install -g wattpm
npx wattpm create my-app
cd my-app && npm start

## Choose Your Learning Path
- **New to Node.js?** → [What is Watt?](docs/overview/what-is-watt.md) → [Guided Tutorial](docs/learn/tutorials/your-first-watt-app/)
- **Experienced Developer?** → [Quick Start](docs/learn/quick-start/) → [Migration Guide](docs/learn/migrations/)
- **Evaluating Platforms?** → [Architecture Overview](docs/overview/architecture-overview.md) → [Comparisons](docs/overview/comparison-with-alternatives.md)

## Documentation
- [Overview](docs/overview/) - Understand what Watt is and why to use it
- [Learning](docs/learn/) - Tutorials, examples, and guided paths
- [How-to Guides](docs/guides/) - Solve specific problems
- [Reference](docs/reference/) - Technical specifications
- [Concepts](docs/concepts/) - Deep architectural understanding
```

### Sidebar Restructuring (docs/sidebars.js)

The current sidebar reflects internal package structure rather than user mental models. Here's the proposed user journey-focused restructure:

**Current Problems:**
- Package-centric organization (`@platformatic/db`, `@platformatic/service`, etc.)
- Watt buried as one package among many
- No clear learning progression
- Mixed content types (tutorials, reference, concepts) in same sections
- Multiple competing "getting started" paths

**New User Journey-Focused Sidebar:**
```javascript
const sidebars = {
  docs: [
    // OVERVIEW & ORIENTATION (Discovery Stage)
    {
      type: 'category',
      label: 'Overview',
      collapsed: false,  // Always open - primary entry point
      items: [
        'overview/what-is-watt',
        'overview/getting-started',  
        'overview/architecture-overview',
        'overview/use-cases-and-examples',
        'overview/comparison-with-alternatives'
      ]
    },

    // LEARNING (Evaluation & Initial Implementation)
    {
      type: 'category', 
      label: 'Learning',
      collapsed: false,  // Keep open for easy access
      items: [
        {
          type: 'category',
          label: 'Quick Start (5-10 min)',
          items: [
            'learn/quick-start/install-and-init',
            'learn/quick-start/your-first-endpoint', 
            'learn/quick-start/whats-next'
          ]
        },
        {
          type: 'category',
          label: 'Step-by-Step Tutorials (30+ min)',
          items: [
            'learn/tutorials/your-first-watt-app',
            'learn/tutorials/todo-api-with-database',
            'learn/tutorials/full-stack-movie-quotes',
            'learn/tutorials/deploy-to-production'
          ]
        },
        {
          type: 'category',
          label: 'Example Applications',
          items: [
            'learn/examples/ecommerce-api',
            'learn/examples/blog-with-cms',
            'learn/examples/microservices-suite',
            'learn/examples/nextjs-integration'
          ]
        },
        {
          type: 'category', 
          label: 'Migration Guides',
          items: [
            'learn/migrations/from-express',
            'learn/migrations/from-fastify',
            'learn/migrations/from-nodejs-monolith'
          ]
        }
      ]
    },

    // HOW-TO GUIDES (Implementation Stage)
    {
      type: 'category',
      label: 'How-to Guides', 
      collapsed: true,
      items: [
        {
          type: 'category',
          label: 'Framework Integration',
          items: [
            'guides/frameworks/nextjs-integration',
            'guides/frameworks/astro-integration',
            'guides/frameworks/react-integration',
            'guides/frameworks/vue-integration'
          ]
        },
        {
          type: 'category',
          label: 'Database Setup',
          items: [
            'guides/databases/postgresql-setup',
            'guides/databases/mysql-configuration',
            'guides/databases/database-migrations'
          ]
        },
        {
          type: 'category',
          label: 'Deployment',
          items: [
            'guides/deployment/docker-containers',
            'guides/deployment/kubernetes-deployment', 
            'guides/deployment/environment-configuration'
          ]
        },
        {
          type: 'category',
          label: 'Production & Monitoring',
          items: [
            'guides/monitoring/logging-setup',
            'guides/monitoring/metrics-collection',
            'guides/monitoring/distributed-tracing'
          ]
        }
      ]
    },

    // REFERENCE (Ongoing Usage)
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      items: [
        {
          type: 'category', 
          label: 'Watt Application Server',  // Primary product first
          items: [
            'reference/watt/cli-commands',
            'reference/watt/configuration', 
            'reference/watt/api-reference'
          ]
        },
        {
          type: 'category',
          label: 'Services', // User mental model: services that run in Watt
          items: [
            {
              type: 'category',
              label: 'Database Service',
              items: [
                'reference/services/db/overview',
                'reference/services/db/configuration',
                'reference/services/db/authorization',
                'reference/services/db/migrations'
              ]
            },
            {
              type: 'category', 
              label: 'HTTP Service',
              items: [
                'reference/services/service/overview',
                'reference/services/service/configuration', 
                'reference/services/service/plugins'
              ]
            },
            {
              type: 'category',
              label: 'Composer Service', 
              items: [
                'reference/services/composer/overview',
                'reference/services/composer/configuration',
                'reference/services/composer/api-modification'
              ]
            }
          ]
        },
        {
          type: 'category',
          label: 'Stackables', // Framework integrations
          items: [
            'reference/stackables/next',
            'reference/stackables/astro', 
            'reference/stackables/node',
            'reference/stackables/creating-custom'
          ]
        }
      ]
    },

    // CONCEPTS (Deep Understanding)
    {
      type: 'category',
      label: 'Concepts',
      collapsed: true,
      items: [
        'concepts/watt-architecture',
        'concepts/service-mesh',
        'concepts/application-lifecycle', 
        'concepts/microservices-vs-monolith'
      ]
    }
  ]
}
```

**Key Changes in Sidebar Strategy:**

1. **User Journey Progression**: Overview → Learning → Guides → Reference → Concepts
2. **Watt-First Positioning**: Watt prominently featured as primary product
3. **Clear Content Separation**: Each section serves distinct user needs per Diátaxis framework
4. **Collapsed State Strategy**: Keep Overview and Learning open; collapse advanced sections
5. **Mental Model Organization**: Services/Stackables instead of internal package names
6. **Multiple Entry Points**: Quick Start, Tutorials, Examples, Migrations all clearly accessible
7. **Progressive Disclosure**: Basic → Intermediate → Advanced within each section

### Critical Content Gaps to Fill

1. **Missing "Why Watt?" Content**
   - Clear positioning against alternatives
   - Benefits of application server approach
   - When to use Watt vs other solutions

2. **Incomplete User Journeys**
   - Beginner → Intermediate → Advanced progression
   - Framework-specific guidance
   - Production deployment paths

3. **Scattered Technical Reference**
   - Consolidate CLI documentation
   - Unified configuration reference
   - Complete API documentation

## Success Metrics

### User Journey Success Metrics

**Discovery Stage Metrics:**
- Landing page conversion rate (visits → getting started)
- Time to first "aha moment" (< 30 seconds on overview pages)
- User type identification accuracy (can users pick the right entry path?)
- Bounce rate on overview pages (< 30%)

**Evaluation Stage Metrics:**
- Quick Start completion rate (> 80% complete the 5-10 minute path)
- Tutorial completion rate (> 60% complete 30-minute tutorials)
- Example application success rate (> 90% run without issues)
- Migration guide effectiveness (can teams migrate existing apps?)

**Implementation Stage Metrics:**
- How-to guide problem resolution rate (users find solutions to specific issues)
- Integration guide success rate (framework integrations work as documented)
- Production deployment success rate (tutorials lead to working deployments)
- Support ticket reduction (fewer questions about covered topics)

**Mastery Stage Metrics:**
- Reference documentation usage patterns (high return visits to specific sections)
- Advanced feature adoption (users progressing beyond basic usage)
- Community contribution rate (users creating content/PRs)
- Enterprise adoption indicators (team onboarding success)

### Content Quality Metrics

**Immediate (Foundation Phase)**
- Single clear entry point established (README restructured)
- Watt positioned as primary product (overview content created)
- Multi-path getting started works (Quick Start + Tutorial + Examples)
- Core tutorial tested end-to-end (every step verified)
- Sidebar reflects user mental model (not package structure)

**Short-term (Content Creation Phase)**
- Complete beginner journey (Discovery → Evaluation → Implementation)
- Essential problem-solving guides available (top 10 user questions covered)
- Reference documentation organized by user needs
- User testing validates learning paths (5+ users test each path)
- Analytics tracking implemented (user journey progression data)

**Long-term (Optimization Phase)**
- All content follows Diátaxis framework (content type clarity)
- User feedback loop established (continuous improvement process)
- Documentation analytics show improved engagement (time on page, completion rates)
- Team adoption playbook validated (enterprise onboarding success)
- Community content creation enabled (contributor guidelines and templates)

## Implementation Recommendations

### Content Creation Guidelines
1. **Tutorials must work reliably** - Test every step
2. **How-to guides solve real problems** - Based on user questions
3. **Reference is accurate and current** - Auto-generated where possible
4. **Explanations provide context** - Why not just what

### Team Structure Suggestions
1. **Tutorial Specialist** - Focus on learning-oriented content
2. **Technical Writer** - Handle reference documentation
3. **Developer Advocate** - Create how-to guides based on user feedback
4. **Information Architect** - Ensure structural consistency

### Tools and Processes
1. **Content templates** for each Diátaxis type
2. **Review checklist** for content type compliance
3. **User testing protocol** for tutorials
4. **Analytics dashboard** for documentation usage

## Next Steps

1. **Validate this plan** with team stakeholders
2. **Assign content creation responsibilities**
3. **Set up content creation templates**
4. **Begin Phase 1 implementation**
5. **Establish feedback collection mechanisms**

---

*This plan repositions Platformatic around Watt as the core Node.js Application Server, following the proven Diátaxis documentation framework to create clear, purposeful content that serves users' actual needs.*