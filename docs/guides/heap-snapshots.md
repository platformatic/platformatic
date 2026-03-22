# Capturing Heap Snapshots with Watt

Heap snapshots are essential for diagnosing memory leaks, understanding memory usage patterns, and optimizing the memory footprint of your Node.js applications. Watt provides a built-in `heap-snapshot` command that captures V8 heap snapshots from running applications and streams them directly to disk.

## Overview

A V8 heap snapshot is a complete picture of all objects in your application's memory at a specific point in time. It records every object, its size, the references between objects, and where each object was allocated. This information makes it possible to find objects that should have been garbage collected but were not (memory leaks), understand which parts of your code allocate the most memory, and compare memory state across different points in time.

Watt captures heap snapshots using the V8 inspector protocol (`HeapProfiler.takeHeapSnapshot`). The snapshot data is streamed from the worker thread through the runtime and directly to disk, so even large snapshots do not require buffering the entire snapshot in memory.

### Key Features

- **No additional dependencies**: Uses the built-in Node.js inspector module
- **Streaming to disk**: Snapshot data flows directly to the output file without accumulating in memory
- **Per-application snapshots**: Capture snapshots of individual applications or all applications at once
- **Chrome DevTools compatible**: Output files load directly in Chrome DevTools Memory tab
- **Remote capture**: Take snapshots from applications running in any environment

## Prerequisites

Before capturing heap snapshots, ensure that:

1. **Watt is installed**: You need `wattpm` CLI installed globally or in your project
2. **Application is running**: Your Watt application must be running in development or production mode

```bash
# Install wattpm globally
npm install -g wattpm

# Verify installation
wattpm version
```

## Basic Usage

### Taking a Heap Snapshot

To take a heap snapshot of a specific application:

```bash
# Snapshot a specific application (auto-detect runtime)
wattpm heap-snapshot api-application

# Snapshot a specific application in a named runtime
wattpm heap-snapshot my-app api-application

# Snapshot all applications
wattpm heap-snapshot my-app
```

The snapshot is saved in the current working directory with the naming pattern `heap-{application}-{timestamp}.heapsnapshot`:

```
heap-api-application-2025-03-20T14-30-45-123Z.heapsnapshot
```

### Specifying an Output Directory

Use the `--dir` option to save snapshots to a specific location:

```bash
wattpm heap-snapshot --dir /tmp/snapshots my-app api-application
```

## Analyzing Heap Snapshots in Chrome DevTools

### Loading a Snapshot

1. Open Chrome and navigate to `chrome://inspect` or open Chrome DevTools (F12)
2. Go to the **Memory** tab
3. Click **Load** and select your `.heapsnapshot` file

### What to Look For

The Chrome DevTools Memory panel provides several views:

**Summary view** groups objects by their constructor name. Sort by **Retained Size** to find the object types consuming the most memory. Objects with unexpectedly large retained sizes are often the source of memory leaks.

**Comparison view** compares two snapshots taken at different times. This is the most effective way to find memory leaks: take a snapshot before and after the operation you suspect is leaking, and the comparison view shows which objects were added.

**Containment view** shows the object graph from the GC roots. This helps trace why a specific object is being retained in memory by showing the chain of references keeping it alive.

**Statistics view** provides a high-level breakdown of memory usage by object type (code, strings, arrays, typed arrays, etc.).

## Diagnostic Workflows

### Diagnosing a Memory Leak

The most effective way to identify a memory leak is to compare two snapshots:

```bash
# Start your application
wattpm start

# Take a baseline snapshot
wattpm heap-snapshot my-app api-application --dir /tmp/snapshots

# Exercise the suspected leaking functionality
curl http://localhost:3000/api/endpoint-that-leaks
# Repeat several times to amplify the leak

# Take a second snapshot
wattpm heap-snapshot my-app api-application --dir /tmp/snapshots

# Load both snapshots in Chrome DevTools and use Comparison view
```

In the Comparison view, sort by **Size Delta** or **# New** to find object types that are growing. Objects that accumulate between snapshots without being released are likely leaks.

### Understanding Memory Composition

To understand what your application stores in memory at rest:

```bash
# Start your application and let it reach a stable state
wattpm start

# Wait for initial startup to complete and serve some requests
# ...

# Take a snapshot
wattpm heap-snapshot my-app api-application
```

Load the snapshot in Chrome DevTools Summary view. The **Shallow Size** column shows the memory directly held by objects of each type, while **Retained Size** shows the total memory that would be freed if the object were garbage collected.

### Comparing Before and After an Optimization

```bash
# Snapshot before optimization
wattpm heap-snapshot my-app api-application --dir /tmp/before

# Apply code changes and restart
wattpm restart

# Snapshot after optimization
wattpm heap-snapshot my-app api-application --dir /tmp/after

# Compare the two snapshots in Chrome DevTools
```

## Tips

- **Trigger garbage collection before snapshots** if possible. You can send a request to your application that triggers heavy processing, then wait a few seconds before taking the snapshot to let the GC run.
- **Take snapshots under load** to see memory usage patterns during typical operation, not just at idle.
- **Name your snapshots clearly** using the `--dir` option to organize before/after comparisons.
- **Heap snapshots pause the application** briefly while V8 serializes the heap. For production systems, take snapshots during low-traffic periods.
- **Snapshot file sizes** vary based on heap size. A typical Node.js application produces snapshots between 10 MB and 500 MB.

## Next Steps

After analyzing heap snapshots:

1. **Identify retained objects** that should have been garbage collected
2. **Trace retention paths** in the Containment view to find the root cause
3. **Fix the leak** by removing the reference keeping objects alive
4. **Take another snapshot** to verify the fix
5. **Set up monitoring** to catch memory regressions early

For related diagnostic tools:

- [Profiling Applications with Watt](profiling-with-watt.md) for CPU and heap allocation profiling
- [Debugging with REPL](debugging-with-repl.md) for interactive runtime inspection
- [Metrics and Monitoring](metrics.md) for ongoing memory monitoring
