# Theia Openspace

<!-- Working with user via OpenCode MCP -->

A customized Theia IDE environment for OpenSpace collaboration.

## Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.7.0 and < 2.0.0

## Setup

```bash
# Install dependencies
yarn install

# Build all extensions and the browser app
yarn build
```

## Development

```bash
# Build only extensions
yarn build:extensions

# Build only browser app
yarn build:browser

# Watch mode for development
yarn watch

# Clean all build outputs
yarn clean
```

## Running

```bash
# Start browser app on port 3000
yarn start:browser
```

Then open http://localhost:3000 in your browser.

## Extensions

- **openspace-core** - Core extension with common services
- **openspace-chat** - Chat functionality
- **openspace-presentation** - Presentation mode support
- **openspace-whiteboard** - Whiteboard/collaboration features
- **openspace-layout** - Custom layout management
- **openspace-settings** - Settings and preferences

## License

MIT
