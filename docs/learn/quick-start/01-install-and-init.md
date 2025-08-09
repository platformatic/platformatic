# Install and Initialize Watt

Get up and running with Platformatic Watt in under 5 minutes.

## What You'll Learn

By the end of this guide, you'll have:
- Installed Platformatic Watt globally
- Created your first Watt application
- Understood the basic project structure
- Started your development server

## Prerequisites

- **Node.js** 18.8.0 or higher
- **npm** (comes with Node.js)

Check your versions:
```bash
node --version
npm --version
```

## Step 1: Install Watt

Install Platformatic Watt globally using npm:

```bash
npm install -g wattpm
```

Verify the installation:
```bash
watt --version
```

You should see the version number printed to your terminal.

## Step 2: Initialize Your First Application

Create a new Watt application:

```bash
watt init my-app
```

This command:
- Creates a new directory called `my-app`
- Sets up the basic project structure
- Installs necessary dependencies
- Configures default settings

## Step 3: Explore the Project Structure

Navigate to your new application:

```bash
cd my-app
```

Your project structure should look like this:

```
my-app/
├── watt.json           # Main configuration file
├── package.json        # Node.js package configuration
├── web/               # Default application folder
│   ├── package.json   # Application-specific dependencies
│   └── index.js       # Main application entry point
└── node_modules/      # Dependencies
```

### Key Files Explained

- **`watt.json`**: The main configuration file that defines your application structure and runtime settings
- **`web/`**: The default folder containing your application code
- **`web/index.js`**: Your application's entry point where you define routes and business logic

## Step 4: Start Your Application

Start the development server:

```bash
watt start
```

You should see output similar to:
```
[15:30:45.123] INFO: Server listening at http://127.0.0.1:3042
[15:30:45.125] INFO: Web application started
```

## Step 5: Test Your Application

Open your browser and visit `http://localhost:3042` (or the URL shown in your terminal).

You can also test it with curl:
```bash
curl http://localhost:3042
```

You should see a response from your new Watt application!

## What's Next?

Congratulations! You've successfully:
✅ Installed Watt globally  
✅ Created your first application  
✅ Started the development server  
✅ Made your first request  

In the next guide, you'll learn how to:
- Add custom routes to your application
- Handle different HTTP methods
- Work with request and response data
- Structure your application code

## Troubleshooting

### Port Already in Use
If port 3042 is already in use, Watt will automatically find the next available port. Check your terminal output for the actual URL.

### Permission Errors on Global Install
If you encounter permission errors when installing globally, you can either:
- Use `sudo npm install -g wattpm` (not recommended)
- Configure npm to use a different directory for global packages
- Use a Node.js version manager like `nvm`

### Command Not Found
If `watt` command is not found after installation:
1. Restart your terminal
2. Check that npm's global bin directory is in your PATH
3. Try `npx wattpm` instead of `watt`

## Summary

You now have a working Watt application running locally. The `web` folder contains your application code, and the `watt.json` file configures how everything runs together.

Ready to build something amazing? Let's move on to creating your first custom routes!