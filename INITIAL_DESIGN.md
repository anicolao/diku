# Diku MUD AI Player - Initial Design Document (Simplified)

## Project Goals

Create a simple MUD client that connects an LLM (via Ollama API) directly to Arctic MUD to test if the LLM can autonomously play the game without assistance. The system should be:

1. **Simple and Minimal**: The client has no game logic, just passes data between telnet and LLM
2. **LLM-Driven**: All intelligence comes from the LLM with a specific system prompt
3. **Experimental**: Test if modern LLMs can navigate MUD gameplay without specialized parsing or state management

## System Architecture

### Simplified Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Arctic MUD    │◄──►│  Simple Client  │◄──►│   Ollama LLM    │
│   (Telnet)      │    │  (Pass-through) │    │ (All Logic)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Components

#### 1. Simple MUD Client (`src/client.js`)
**Purpose**: Minimal client that passes data between MUD and LLM
- **TelnetConnection**: Basic telnet connection to Arctic MUD
- **OllamaClient**: Send/receive messages to/from Ollama API
- **MessageLoop**: Simple loop that passes MUD output to LLM and sends LLM commands to MUD

**No complex parsing, no state management, no decision logic**

#### 2. LLM System Prompt
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

## Implementation Details

### Technology Stack
- **Runtime**: Node.js 18+
- **Language**: JavaScript (ES2022)
- **Dependencies**: 
  - `axios` for Ollama API
  - `telnet-client` for MUD connection
  - `winston` for basic logging

### Core Files
- `src/index.js` - Main entry point and CLI
- `src/client.js` - Simple MUD client
- `src/ollama.js` - Ollama API interface
- `config.json` - Configuration (Ollama URL, MUD host/port)

### Data Flow

1. **MUD → Client**: Raw telnet output received
2. **Client → LLM**: Send MUD output + system prompt to Ollama
3. **LLM → Client**: Receive response with command in ```telnet block
4. **Client → MUD**: Extract command from code block and send to MUD
5. **Repeat**: Continue the loop

### Error Handling

- Basic connection error handling and reconnection
- Simple logging of all interactions
- Graceful shutdown on errors

### Testing Strategy

- Test basic telnet connection to Arctic MUD
- Test Ollama API communication
- Manual testing with actual MUD interaction
- No complex unit tests needed for this simple approach

## Key Differences from Complex Design

**Removed Components:**
- Complex output parser with pattern matching
- Game state management and world mapping
- AI decision engine with behavioral parameters
- Action executor with command queuing
- Database for state persistence
- Complex event-driven architecture

**Simplified Components:**
- Single file MUD client that just passes data
- Basic configuration (host, port, Ollama URL)
- Simple logging for debugging
- Minimal error handling

## Success Criteria

The system is successful if:
1. It can establish telnet connection to Arctic MUD
2. It can send MUD output to Ollama LLM
3. It can extract commands from LLM responses
4. It can send commands back to the MUD
5. The LLM demonstrates ability to:
   - Create a character
   - Navigate the game world
   - Interact with other players
   - Make progress toward level 10

This design focuses on testing the core hypothesis: can an LLM with just a system prompt successfully play a Diku MUD without specialized game logic in the client?