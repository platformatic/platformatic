# Profiling Applications with Watt

Performance profiling is essential for understanding how your Node.js applications use resources, identifying bottlenecks, and optimizing performance. Watt provides built-in profiling capabilities for both CPU and heap usage that make it easy to profile individual applications or entire applications.

The typical workflow for performance analysis involves collecting profiling data and then visualizing it using flame graphs - interactive visualizations that show where your application spends its resources. This guide will walk you through the entire process: from collecting profile data with Watt's built-in profiling commands to generating flame graphs for analysis.

## Overview

Watt's profiling feature supports two types of profiling:

- **CPU profiling**: Samples the JavaScript call stack at regular intervals (1000 microseconds by default) to build a statistical picture of where your application spends its CPU time
- **Heap profiling**: Tracks memory allocations to help identify memory leaks and optimize memory usage

### Key Features

- **Application-level profiling**: Profile individual applications or all applications at once
- **Multiple profile types**: Support for both CPU and heap profiling
- **Concurrent profiling**: Profile CPU and heap simultaneously
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
# Start CPU profiling all applications (default, auto-detect runtime)
wattpm pprof start

# Start heap profiling all applications
wattpm pprof start --type=heap

# Start CPU profiling a specific application (auto-detect runtime)
wattpm pprof start api-application

# Start heap profiling a specific application
wattpm pprof start --type=heap api-application

# Start profiling all applications in a specific application
wattpm pprof start my-app-name

# Start profiling a specific application in a specific application
wattpm pprof start my-app-name api-application

# Start profiling using explicit PID
wattpm pprof start 12345 api-application

# Using short option syntax
wattpm pprof start -t heap api-application
```

When profiling starts successfully, you'll see output like:

```
CPU profiling started for application api-application
CPU profiling started for application database-application
CPU profiling started for application auth-application
```

Or for heap profiling:

```
HEAP profiling started for application api-application
```

### Stopping Profiling and Collecting Data

To stop profiling and save profile data:

```bash
# Stop CPU profiling all applications (default, auto-detect runtime)
wattpm pprof stop

# Stop heap profiling all applications
wattpm pprof stop --type=heap

# Stop profiling a specific application (auto-detect runtime)
wattpm pprof stop api-application

# Stop heap profiling a specific application
wattpm pprof stop --type=heap api-application

# Stop profiling all applications in a specific application
wattpm pprof stop my-app-name

# Stop profiling a specific application in a specific application
wattpm pprof stop my-app-name api-application

# Stop profiling using explicit PID
wattpm pprof stop 12345 api-application

# Using short option syntax
wattpm pprof stop -t heap api-application
```

Profile files are saved in your current directory with names that include the profile type:

```
pprof-cpu-api-application-2024-01-15T10-30-45-123Z.pb
pprof-heap-api-application-2024-01-15T10-30-45-124Z.pb
pprof-cpu-database-application-2024-01-15T10-30-45-125Z.pb
```

### Generating Flame Graphs

Once you have profile files, the most effective way to analyze them is by generating flame graphs:

```bash
# Generate a flame graph from your CPU profile file
flame generate pprof-cpu-api-application-2024-01-15T10-30-45-123Z.pb

# Generate a flame graph from your heap profile file
flame generate pprof-heap-api-application-2024-01-15T10-30-45-124Z.pb

# This opens an interactive flame graph visualization in your browser
# showing exactly where your application spends resources
```

The flame graph provides an intuitive visual representation where:

- **Width represents resource usage**:
  - For CPU profiles: Wider sections indicate functions that used more CPU time
  - For heap profiles: Wider sections indicate functions that allocated more memory
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

### 3. Heap Profiling for Memory Analysis

Profile memory usage to identify memory leaks or excessive allocations:

```bash
# Start heap profiling
wattpm pprof start --type=heap api-application

# Exercise your application to trigger memory allocations
curl http://localhost:3000/api/users
# ... continue using your application ...

# Stop heap profiling after sufficient data (usually 30-60 seconds)
wattpm pprof stop --type=heap api-application

# Analyze the heap profile
flame generate pprof-heap-api-application-2024-01-15T10-30-45-123Z.pb
```

Heap profiles help identify:
- Memory leaks (objects not being garbage collected)
- Excessive allocations (functions creating too many objects)
- Memory-intensive operations

### 4. Concurrent CPU and Heap Profiling

Profile both CPU and heap simultaneously for comprehensive analysis:

```bash
# Start both CPU and heap profiling
wattpm pprof start --type=cpu api-application
wattpm pprof start --type=heap api-application

# Generate load on your application
# ... exercise your application ...

# Stop both profiles
wattpm pprof stop --type=cpu api-application
wattpm pprof stop --type=heap api-application

# You now have both CPU and heap profiles for the same time period
```

### 5. Comparative Profiling

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

1. **Width indicates resource usage**:
   - **CPU profiles**: Wider sections represent functions that consumed more CPU time
   - **Heap profiles**: Wider sections represent functions that allocated more memory
2. **Height shows call depth**: Taller stacks indicate deeper function call chains
3. **Colors indicate relative cost**: More red frames indicate higher resource usage at a given stack level to visually guide to the most expensive stacks
4. **Interactive exploration**: Click on sections to zoom in and examine specific code paths

### Key Analysis Patterns

**For CPU Profiles:**
- **Wide plateaus**: Functions that directly consume significant CPU time - prime candidates for optimization
- **Tall spires**: Deep call stacks may indicate recursive functions or complex logic
- **Multiple peaks**: Different execution paths or phases in your application
- **No dominant width frames**: Indicates balanced CPU usage, may not need optimization
- **Flat profiles**: Simple and straightforward code paths without excessive complexity

**For Heap Profiles:**
- **Wide sections**: Functions allocating significant memory - candidates for memory optimization
- **Repeated patterns**: May indicate memory leaks or unnecessary allocations in loops
- **Large object allocations**: Look for functions creating large buffers or data structures
- **Growing over time**: If heap usage continuously grows, investigate for memory leaks

## Best Practices

### Profiling Duration

- **Minimum duration**: 10-30 seconds for meaningful data
- **Typical duration**: 30-60 seconds for most analyses
- **Extended profiling**: 2-5 minutes for catching intermittent issues
- **Avoid very short profiles**: Less than 10 seconds often lack statistical significance

### Choosing Profile Type

**Use CPU profiling when:**
- Your application is slow or has high CPU usage
- You want to optimize algorithm performance
- You're investigating slow endpoints or operations
- You need to understand execution time distribution

**Use heap profiling when:**
- Your application has memory issues or leaks
- You see increasing memory usage over time
- You want to reduce memory footprint
- You're investigating out-of-memory errors

### Production Profiling

```bash
# CPU profiling in production
wattpm pprof start my-app api-application
# ... wait for sufficient representation of normal traffic ...
wattpm pprof stop my-app api-application

# Heap profiling in production
wattpm pprof start --type=heap my-app api-application
# ... wait for memory patterns to emerge ...
wattpm pprof stop --type=heap my-app api-application
```

**Production considerations:**

- Profile during representative load periods
- Consider profiling replicas rather than all instances
- Heap profiling may have slightly higher overhead than CPU profiling

## Performance Impact

Profiling has minimal impact on application performance:

- **CPU profiling overhead**: ~1-5% during profiling
- **Heap profiling overhead**: ~5-10% during profiling (slightly higher than CPU)
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

- [Monitoring](monitoring.md)
- [Caching with Watt Guide](cache-with-platformatic-watt.md)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)

---

Performance profiling is an iterative process. Regular profiling helps maintain optimal application performance and catch issues before they impact users.
