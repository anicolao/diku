# Diku MUD AI Player

An intelligent MUD (Multi-User Dungeon) client that uses the Ollama API to create an AI-powered player capable of autonomously playing Diku MUDs, specifically targeting Arctic MUD.

## Overview

This project combines classic MUD gaming with modern AI technology to create an autonomous player that can:
- Connect to Diku-style MUDs (initially Arctic MUD)
- Parse and understand MUD output and game state
- Make intelligent decisions using Large Language Models via Ollama API
- Execute commands and interact with the game world
- Learn and adapt gameplay strategies over time

## Features

- **Ollama Integration**: Leverages local LLM models through Ollama API for decision-making
- **MUD Protocol Support**: Full support for Diku MUD protocols and Arctic MUD specifics
- **Intelligent Parsing**: Advanced text parsing to understand game state, rooms, objects, and NPCs
- **Strategic AI**: Context-aware decision making for combat, exploration, and quest completion
- **Logging & Analytics**: Comprehensive logging of all interactions and AI decisions
- **Configurable Behavior**: Adjustable AI personality and gameplay strategies

## Target MUD

**Arctic MUD** (telnet://arctic.org:2700)
- Classic Diku-based MUD with rich fantasy setting
- Complex class/race system with extensive skill trees
- Large world with quests, dungeons, and PvP areas
- Active player base and continuous development

## Quick Start

```bash
# Clone the repository
git clone https://github.com/anicolao/diku.git
cd diku

# Install dependencies
npm install

# Configure Ollama connection
cp config.example.json config.json
# Edit config.json with your Ollama API settings

# Start the AI player
npm start
```

## Requirements

- Node.js 18+ 
- Ollama server running locally or accessible remotely
- Compatible LLM model (recommended: llama2, codellama, or mistral)
- Network access to Arctic MUD (telnet://arctic.org:2700)

## Configuration

The AI player can be configured through `config.json`:

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "llama2",
    "temperature": 0.7
  },
  "mud": {
    "host": "arctic.org",
    "port": 2700,
    "characterName": "AIPlayer",
    "autoLogin": true
  },
  "behavior": {
    "aggressiveness": 0.5,
    "exploration": 0.8,
    "caution": 0.6
  }
}
```

## Architecture

The system consists of several key components:

- **MUD Client**: Handles telnet connection and protocol communication
- **State Manager**: Maintains current game state and context
- **AI Engine**: Interfaces with Ollama API for decision-making
- **Command Parser**: Interprets MUD output and extracts meaningful information
- **Action Executor**: Translates AI decisions into MUD commands
- **Logger**: Records all interactions for analysis and debugging

## Development

```bash
# Install development dependencies
npm install --dev

# Run tests
npm test

# Run with debug logging
DEBUG=* npm start

# Lint code
npm run lint
```

## Documentation

- [Initial Design Document](INITIAL_DESIGN.md) - Detailed architecture and implementation plan
- [Prompt Tracking](PROMPTS.md) - Complete record of all AI prompts and development iterations
- [API Documentation](docs/api.md) - Technical API reference
- [Configuration Guide](docs/config.md) - Detailed configuration options

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with appropriate tests
4. Update documentation as needed
5. Submit a pull request

## License

MIT License - See [LICENSE](LICENSE) file for details

## Acknowledgments

- Arctic MUD development team for maintaining an excellent gaming environment
- Ollama project for providing accessible LLM API infrastructure
- Diku MUD codebase contributors for the foundational MUD architecture
