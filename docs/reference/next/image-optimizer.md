---
title: Image Optimizer
---

# Next.js Image Optimizer

Platformatic Next provides a standalone Image Optimizer service that can optimize images on-the-fly without running the full Next.js application. This is particularly useful when you want to separate image optimization from your main application or when running in production environments where you need a lightweight image optimization service.

## Overview

The Image Optimizer capability allows you to:
- Run a standalone image optimization service
- Optimize images from external URLs or internal services
- Support all Next.js image optimization features including resizing, quality adjustment, and format conversion
- Integrate with Platformatic's service mesh for internal image fetching

## Configuration

To enable the Image Optimizer, add the following configuration to your `watt.json` or `platformatic.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/2.0.0.json",
  "next": {
    "imageOptimizer": {
      "enabled": true,
      "fallback": "backend"
    }
  }
}
```

### Configuration Options

- **`enabled`**: Boolean flag to enable the image optimizer service. Default is `false`.
- **`fallback`**: The source to fetch original images from. This can be:
  - A full URL (e.g., `https://cdn.example.com`) for external image sources
  - A local service name (e.g., `backend`) which will be resolved to `http://backend.plt.local` within the Platformatic service mesh

The Image Optimizer exposes the standard Next.js image optimization endpoint:

```
GET /_next/image?url={imageUrl}&w={width}&q={quality}
```

### Query Parameters

- **`url`**: The URL of the image to optimize. Can be:
  - An absolute URL for external images (e.g., `https://example.com/image.png`)
  - A relative path for internal images (e.g., `/images/photo.jpg`)
- **`w`**: The desired width of the image in pixels
- **`q`**: The quality of the image (1-100, default is 75)
- Additional Next.js image optimization parameters are also supported

## Usage Examples

### Optimizing External Images

```html
<!-- Optimize an external image -->
<img src="/_next/image?url=https%3A%2F%2Fexample.com%2Fphoto.png&w=640&q=75" />
```

### Optimizing Internal Service Images

If your backend service hosts images at `/api/images/photo.jpg`:

```html
<!-- Optimize an image from the backend service -->
<img src="/_next/image?url=/api/images/photo.jpg&w=320&q=90" />
```

### Using with Next.js Image Component

When using the Next.js Image component, the optimizer will automatically handle requests:

```jsx
import Image from 'next/image'

export default function MyComponent() {
  return (
    <Image
      src="/api/images/hero.jpg"
      width={800}
      height={600}
      alt="Hero image"
    />
  )
}
```

## Error Handling

The Image Optimizer provides detailed error responses:

- **502 Bad Gateway**: When the upstream image cannot be fetched
- **400 Bad Request**: When invalid optimization parameters are provided

Example error response:

```json
{
  "error": "Bad Gateway",
  "message": "An error occurred while optimizing the image.",
  "statusCode": 502,
  "cause": {
    "message": "\"url\" parameter is valid but upstream response is invalid (HTTP 404)",
    "statusCode": 404
  }
}
```
