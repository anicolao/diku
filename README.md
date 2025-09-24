# Diku MUD AI Player

A simple MUD client that connects an LLM (via Ollama API) directly to Arctic MUD to test if the LLM can autonomously play the game without specialized parsing or game logic in the client.

## Overview

This project tests whether modern Large Language Models can successfully navigate and play Diku MUDs using only a system prompt and raw game output. The client is intentionally minimal - it simply passes data between the MUD and the LLM without any game-specific intelligence.

## Features

- **Simple Telnet Client**: Basic connection to Arctic MUD
- **Ollama Integration**: Direct LLM communication for all game decisions
- **LLM-Driven Gameplay**: All intelligence comes from the LLM's system prompt
- **Minimal Processing**: No parsing, state management, or game logic in the client
- **Experimental Design**: Tests pure LLM capability for MUD gameplay

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

The client can be configured through `config.json`:

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "llama2",
    "temperature": 0.7
  },
  "mud": {
    "host": "arctic.org",
    "port": 2700
  },
  "behavior": {
    "commandDelayMs": 2000
  }
}
```

## How It Works

1. **Connect**: Client establishes telnet connection to Arctic MUD
2. **Receive**: Raw MUD output is captured
3. **Send to LLM**: MUD output is sent to Ollama with system prompt
4. **Extract Command**: LLM response is parsed for telnet commands
5. **Execute**: Commands are sent back to the MUD
6. **Repeat**: Loop continues until session ends

## LLM System Prompt

The LLM receives this system prompt to guide its behavior:

```
You are an expert Diku MUD player connected to arctic diku by telnet. Your goal is to create a character and advance to level 10 as efficiently as possible, while making friends within the Diku environment. In each session, you will play for one hour before returning to a safe exit and disconnecting.

**Environment**
You can send text commands over the telnet connection and receive output from the server.

**Workflow**
1. **Plan**: Create a short term plan of what you want to accomplish
2. **Command**: Display commands in a ```telnet code block which contains the text to be transmitted to the server

**Rules**
- Your first response must contain a ```telnet code block with your first command
- Always respond with exactly one command in a ```telnet block
- Read the MUD output carefully and respond appropriately
- Focus on character creation, leveling, and social interaction
```

## Architecture

The system consists of three simple components:

- **MUD Client**: Handles telnet connection and basic I/O
- **Ollama Interface**: Communicates with LLM API
- **Message Loop**: Passes data between MUD and LLM

No complex parsing, state management, or game logic - the LLM handles everything.

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

## Success Criteria

The experiment is successful if the LLM can:
- Create a character in Arctic MUD
- Navigate the game world using basic commands
- Interact with other players and NPCs
- Make progress toward level 10
- Demonstrate understanding of MUD mechanics

## Documentation

- [Initial Design Document](INITIAL_DESIGN.md) - Simplified architecture and implementation plan
- [Prompt Tracking](PROMPTS.md) - Complete record of all development prompts

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
