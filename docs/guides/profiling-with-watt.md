# Profiling Applications with Watt

Performance profiling is essential for understanding how your Node.js applications use CPU resources, identifying bottlenecks, and optimizing performance. Watt provides built-in CPU profiling capabilities that make it easy to profile individual applications or entire applications.

The typical workflow for performance analysis involves collecting profiling data and then visualizing it using flame graphs - interactive visualizations that show where your application spends its CPU time. This guide will walk you through the entire process: from collecting profile data with Watt's built-in profiling commands to generating flame graphs for analysis.

## Overview

Watt's profiling feature uses the native Node.js CPU profiler to collect performance data from running applications. The profiler samples the JavaScript call stack at regular intervals (1000 microseconds by default) to build a statistical picture of where your application spends its CPU time.

### Key Features

- **Application-level profiling**: Profile individual applications or all applications at once
- **Zero-configuration**: Built-in profiler requires no additional setup
- **Standard format**: Outputs pprof-compatible profile files
- **Non-intrusive**: Minimal performance impact during profiling
- **Remote profiling**: Profile applications running in any environment

## Prerequisites

Before profiling your application, ensure that:

1. **Watt is installed**: You need `wattpm` CLI installed globally or in your project
2. **Profiling capture package**: Install `@platformatic/wattpm-pprof-capture` in your application
3. **Application is running**: Your Watt application must be running in development or production mode
4. **Applications are operational**: The applications you want to profile should be actively handling requests

```bash
# Install wattpm globally
npm install -g wattpm

# Install the profiling capture package in your application
npm install @platformatic/wattpm-pprof-capture

# Verify wattpm installation
wattpm version
```

## Basic Usage

### Starting Profiling

To start profiling all applications in your application:

```bash
# Start profiling all applications (auto-detect runtime)
wattpm pprof start

# Start profiling a specific application (auto-detect runtime)
wattpm pprof start api-application

# Start profiling all applications in a specific application
wattpm pprof start my-app-name

# Start profiling a specific application in a specific application
wattpm pprof start my-app-name api-application

# Start profiling using explicit PID
wattpm pprof start 12345 api-application
```

When profiling starts successfully, you'll see output like:

```
Profiling started for application api-application
Profiling started for application database-application
Profiling started for application auth-application
```

### Stopping Profiling and Collecting Data

To stop profiling and save profile data:

```bash
# Stop profiling all applications (auto-detect runtime)
wattpm pprof stop

# Stop profiling a specific application (auto-detect runtime)
wattpm pprof stop api-application

# Stop profiling all applications in a specific application
wattpm pprof stop my-app-name

# Stop profiling a specific application in a specific application
wattpm pprof stop my-app-name api-application

# Stop profiling using explicit PID
wattpm pprof stop 12345 api-application
```

Profile files are saved in your current directory with names like:

```
pprof-api-application-2024-01-15T10-30-45-123Z.pb
pprof-database-application-2024-01-15T10-30-45-124Z.pb
pprof-auth-application-2024-01-15T10-30-45-125Z.pb
```

### Generating Flame Graphs

Once you have profile files, the most effective way to analyze them is by generating flame graphs:

```bash
# Generate a flame graph from your profile file
flame generate pprof-api-application-2024-01-15T10-30-45-123Z.pb

# This opens an interactive flame graph visualization in your browser
# showing exactly where your application spends CPU time
```

The flame graph provides an intuitive visual representation where:

- **Width represents time**: Wider sections indicate functions that used more CPU time
- **Height shows call depth**: The call stack hierarchy from top-level functions down to specific operations
- **Interactive navigation**: Click on sections to zoom in and examine specific code paths
- **Performance hotspots**: Quickly identify the most expensive operations for optimization

## Profiling Workflows

### 1. Full Application Profiling

This approach profiles all applications simultaneously, useful for understanding overall application performance:

```bash
# Start your application
wattpm start

# In another terminal, start profiling
wattpm pprof start

# Generate load on your application
# (using your application's endpoints, load testing tools, etc.)
curl http://localhost:3000/api/users
curl http://localhost:3000/api/orders
# ... continue using your application ...

# Stop profiling after collecting sufficient data (usually 30-60 seconds)
wattpm pprof stop
```

### 2. Targeted Application Profiling

Focus on a specific application that you suspect has performance issues:

```bash
# Start profiling only the problematic application (auto-detect runtime)
wattpm pprof start api-application

# Or with explicit application name
wattpm pprof start my-app api-application

# Exercise the specific functionality
curl http://localhost:3000/api/slow-endpoint
ab -n 1000 -c 10 http://localhost:3000/api/users

# Stop profiling (matching the start command)
wattpm pprof stop api-application
# Or: wattpm pprof stop my-app api-application
```

### 3. Comparative Profiling

Profile before and after optimizations to measure improvements:

```bash
# Profile before optimization
wattpm pprof start api-application
# ... generate load ...
wattpm pprof stop api-application

# Apply your optimizations
# ... make code changes ...

# Restart your application
wattpm restart

# Profile after optimization
wattpm pprof start api-application
# ... generate the same load ...
wattpm pprof stop api-application

# Compare the profile files
```

## Analyzing Profile Data

### Installing Flame

First, install the flame tool for profile visualization:

```bash
npm install -g @platformatic/flame
```

### Using Flame for Visualization

The recommended way to analyze profile data is with the `flame` tool for generating flame graphs:

```bash
# Generate a flame graph from your profile file
flame generate pprof-api-application-2024-01-15T10-30-45-123Z.pb

# This will create an interactive flame graph visualization
# showing your application's CPU usage patterns
```

The flame graph provides:

- **Interactive visualization**: Click to zoom into specific function calls
- **CPU time representation**: Width shows time spent in functions
- **Call stack hierarchy**: Visual representation of function call relationships
- **Performance hotspots**: Easy identification of the most expensive code paths

### Understanding Flame Graphs

When viewing your flame graph:

1. **Width indicates time**: Wider sections represent functions that consumed more CPU time
2. **Height shows call depth**: Taller stacks indicate deeper function call chains
3. **Colors indicate relative cost**: More red frames indicate higher CPU time usage at a given stack level to visually guide to the most expensive stacks
4. **Interactive exploration**: Click on sections to zoom in and examine specific code paths

### Key Analysis Patterns

- **Wide plateaus**: Functions that directly consume significant CPU time - prime candidates for optimization
- **Tall spires**: Deep call stacks may indicate recursive functions or complex logic
- **Multiple peaks**: Different execution paths or phases in your application
- **No dominant width frames**: Indicates balanced CPU usage, may not need optimization
- **Flat profiles**: Simple and straightforward code paths without excessive complexity

## Best Practices

### Profiling Duration

- **Minimum duration**: 10-30 seconds for meaningful data
- **Typical duration**: 30-60 seconds for most analyses
- **Extended profiling**: 2-5 minutes for catching intermittent issues
- **Avoid very short profiles**: Less than 10 seconds often lack statistical significance

### Production Profiling

```bash
wattpm pprof start my-app api-application
# ... wait for sufficient representation of normal traffic ...
wattpm pprof stop my-app api-application
```

**Production considerations:**

- Profile during representative load periods
- Consider profiling replicas rather than all instances

## Performance Impact

Profiling has minimal impact on application performance:

- **CPU overhead**: ~1-5% during profiling
- **Memory overhead**: Small amount for storing samples
- **I/O impact**: None during profiling, only when saving files

## Next Steps

After profiling your application:

1. **Identify bottlenecks** from the profile analysis
2. **Optimize code** based on findings (algorithm improvements, caching, etc.)
3. **Re-profile** to verify improvements
4. **Set up monitoring** to catch performance regressions
5. **Document findings** for your team

For more advanced performance optimization techniques, consider:

- [Monitoring and Observability Guide](monitoring-and-observability.md)
- [Caching with Watt Guide](cache-with-platformatic-watt.md)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)

---

Performance profiling is an iterative process. Regular profiling helps maintain optimal application performance and catch issues before they impact users.
