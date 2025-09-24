# Diku MUD AI Player - GitHub Copilot Instructions

**CRITICAL**: Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Project Overview

Diku MUD AI Player is a simple Node.js application that connects an LLM (via Ollama API) directly to Arctic MUD to test if the LLM can autonomously play the game. The architecture is intentionally minimal - the client has no game logic and simply passes data between the telnet connection and the LLM.

## Working Effectively - Essential Commands

**ALWAYS validate changes by running ALL these commands before committing:**

### Bootstrap the repository:
```bash
# Install Node.js dependencies - takes ~2 seconds from clean state
npm install
# TIMEOUT: Set 60+ seconds for fresh installs

# Create configuration (required before running)
cp config.example.json config.json
# Edit config.json if needed for your Ollama setup
```

### Build and validate:
```bash
# Run tests - takes ~1 second, NEVER CANCEL
npm test
# TIMEOUT: Set 30+ seconds to be safe

# Run linting - takes ~0.5 seconds
npm run lint
# Fix linting issues automatically:
npm run lint:fix
```

### Run the application:
```bash
# Dry run mode (safe, no network connections) - takes ~0.1 seconds
npm start -- --dry-run

# Development mode with file watching (for development) - continuous
npm run dev -- --dry-run
# TIMEOUT: This runs continuously until terminated

# Debug mode - same timing as regular run
npm start -- --debug --dry-run

# Real connection (will fail in sandboxed environments)
npm start
# Note: Connection to arctic.org:2700 fails in sandboxed environments due to network restrictions
```

## Critical Validation Requirements

**MANUAL VALIDATION REQUIREMENT**: After making any changes:

1. **ALWAYS run the complete validation sequence**:
   ```bash
   npm install && npm test && npm run lint && npm start -- --dry-run
   ```
   - Total time: ~3-4 seconds
   - TIMEOUT: Set 120+ seconds for safety
   - NEVER CANCEL: All commands must complete successfully

2. **Test configuration scenarios**:
   ```bash
   # Test with config.json (normal case)
   npm start -- --dry-run
   
   # Test fallback to config.example.json
   rm config.json && npm start -- --dry-run
   
   # Restore config
   cp config.example.json config.json
   ```

3. **Validate CLI functionality**:
   ```bash
   # Test all CLI options
   npm start -- --help
   npm start -- --version
   npm start -- --debug --dry-run
   ```

## Timing Expectations and Timeouts

**CRITICAL - NEVER CANCEL THESE OPERATIONS:**

- `npm install` (clean): ~2 seconds - **TIMEOUT: 180+ seconds**
- `npm test`: ~1 second - **TIMEOUT: 60+ seconds** 
- `npm run lint`: ~0.5 seconds - **TIMEOUT: 30+ seconds**
- `npm start -- --dry-run`: ~0.1 seconds - **TIMEOUT: 30+ seconds**
- `npm run dev`: Continuous until terminated - **TIMEOUT: Not applicable (continuous)**

**Real connection attempts**: Will fail with `ENOTFOUND arctic.org` in sandboxed environments - this is expected and normal.

## Repository Structure and Navigation

### Key files and locations:
```
├── src/
│   ├── index.js          # Main entry point and CLI setup
│   └── client.js         # Simple MUD client with LLM integration
├── test/
│   └── simple.test.js    # Unit tests for core functionality
├── config.json           # Runtime configuration (created from example)
├── config.example.json   # Configuration template
├── package.json          # Project dependencies and scripts
├── .eslintrc.json       # Linting rules (single quotes, etc.)
├── README.md            # Project documentation
├── INITIAL_DESIGN.md    # Architecture documentation
├── PROMPTS.md           # Development history tracking
├── Makefile             # Ollama model management (requires ollama CLI)
└── diku-local.ollama    # Custom Ollama model definition
```

### Architecture components:
- **Simple telnet client**: Handles basic connection to Arctic MUD
- **Ollama API integration**: Direct LLM communication via HTTP
- **Message loop**: Passes data between MUD and LLM without complex parsing
- **Minimal state management**: No game logic, all intelligence from LLM

## Configuration and Dependencies

### Node.js Requirements:
- **Node.js version**: 18+ (tested on 20.19.5)
- **NPM version**: 10+ (tested on 10.8.2)
- **Install command**: `npm install` (no additional SDK downloads needed)

### Dependencies:
- `axios` - HTTP client for Ollama API
- `telnet-client` - MUD connection handling  
- `commander` - CLI argument parsing
- `jest` - Testing framework
- `eslint` - Code linting

### Configuration files:
- **config.json**: Runtime configuration (create from config.example.json)
- **config.example.json**: Template with defaults for Ollama at localhost:11434
- **.env.example**: Environment variables template (unused by current implementation)

## Development Workflows

### Making changes to the codebase:
1. **ALWAYS start with validation**: `npm test && npm run lint`
2. **Make minimal changes** to src/ files
3. **Run tests immediately**: `npm test`
4. **Check linting**: `npm run lint` (fix with `npm run lint:fix`)
5. **Test functionality**: `npm start -- --dry-run`
6. **Test CLI options**: Verify --help, --debug, --version work
7. **Commit only after all validations pass**

### Testing network scenarios:
```bash
# Safe testing (no real network connections)
npm start -- --dry-run

# Connection testing (will fail in sandbox - expected)
timeout 10s npm start || echo "Expected timeout/failure"
```

### Development debugging:
```bash
# Watch mode for development
npm run dev -- --dry-run

# Debug mode with verbose output  
npm start -- --debug --dry-run
```

## Common Issues and Troubleshooting

### Network connection failures (Expected in sandbox):
- **Error**: `ENOTFOUND arctic.org` - This is normal in sandboxed environments
- **Solution**: Use `--dry-run` flag for testing
- **Validation**: Dry-run mode should work without errors

### Configuration missing:
- **Error**: `Neither config.json nor config.example.json found`
- **Solution**: `cp config.example.json config.json`
- **Validation**: Application should start successfully with `--dry-run`

### Linting failures:
- **Error**: ESLint quote/formatting errors
- **Solution**: `npm run lint:fix` automatically fixes most issues
- **Validation**: `npm run lint` should pass with no errors

### Test failures:
- **Investigation**: Run `npm test -- --verbose` for detailed output
- **Common cause**: Changes to client.js system prompt or configuration
- **Validation**: All 10 tests should pass consistently

## Advanced Features

### Ollama model management (requires ollama CLI):
```bash
# Build custom model (requires ollama installed)
make all
# TIMEOUT: Variable based on model size - can take 10+ minutes
# NEVER CANCEL: Let model builds complete

# Clean models
make clean
```

### Environment variables support:
- Project includes .env.example but uses config.json by default
- For environment variable configuration, implement env parsing in src/index.js

## Code Style and Standards

### ESLint configuration enforces:
- Single quotes for strings
- Semicolons required
- Node.js/CommonJS module format
- Console logging allowed
- ES2022 features supported

### Testing standards:
- Jest framework with Node.js environment
- Tests cover configuration, parsing, and core client functionality
- Maintain 100% test pass rate
- Add tests for new functionality

## Success Criteria for Changes

Before marking any work complete, verify:

1. **All commands work**: npm install, test, lint, start --dry-run
2. **Configuration handling**: Both config.json and fallback scenarios work  
3. **CLI functionality**: All flags (--help, --debug, --dry-run, --version) work
4. **Code quality**: Linting passes, tests pass
5. **Documentation**: Update README.md if adding new features
6. **Timing**: All operations complete within expected timeframes

**Remember**: The goal is a simple, reliable MUD client that lets the LLM handle all game intelligence. Keep the client minimal and focused on data transport between MUD and LLM.