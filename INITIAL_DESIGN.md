# Diku MUD AI Player - Initial Design Document

## Project Goals

Create an autonomous AI player that can successfully play Diku MUDs (specifically Arctic MUD) using the Ollama API for intelligent decision-making. The system should be capable of:

1. **Autonomous Gameplay**: Play the game without human intervention
2. **Intelligent Decision Making**: Use LLM reasoning for strategic choices
3. **Adaptive Learning**: Improve performance through experience
4. **Robust Error Handling**: Gracefully handle network issues and game state changes

## System Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MUD Client    │◄──►│   State Manager  │◄──►│   AI Engine     │
│  (Telnet/TCP)   │    │   (Game State)   │    │ (Ollama API)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Protocol Parser │    │  Context Store   │    │ Prompt Manager  │
│ (Text Analysis) │    │  (Memory/DB)     │    │ (Template Sys)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                         ┌──────────────────┐
                         │  Action Executor │
                         │ (Command Queue)  │
                         └──────────────────┘
```

### Core Components

#### 1. MUD Client (`src/client/`)
**Purpose**: Handle low-level MUD connection and communication
- **TelnetClient**: TCP/Telnet connection management
- **ConnectionManager**: Reconnection logic and connection pooling
- **ProtocolHandler**: Handle MUD-specific protocols (ANSI, MCCP, etc.)

**Key Files**:
- `client.js` - Main client class
- `connection.js` - Connection management
- `protocols.js` - Protocol implementations

#### 2. State Manager (`src/state/`)
**Purpose**: Maintain comprehensive game state
- **GameState**: Current room, inventory, stats, etc.
- **WorldMap**: Spatial understanding of the game world
- **CharacterState**: Player stats, skills, equipment
- **CombatState**: Active combat tracking

**Key Files**:
- `gameState.js` - Core state management
- `worldMap.js` - World mapping and navigation
- `character.js` - Character state tracking
- `combat.js` - Combat state management

#### 3. AI Engine (`src/ai/`)
**Purpose**: Interface with Ollama and manage AI decision-making
- **OllamaClient**: API communication with Ollama server
- **DecisionEngine**: Core AI decision-making logic
- **ContextBuilder**: Build prompts with relevant context
- **ActionPlanner**: Plan sequences of actions

**Key Files**:
- `ollamaClient.js` - Ollama API integration
- `decisionEngine.js` - Main AI logic
- `contextBuilder.js` - Prompt construction
- `actionPlanner.js` - Multi-step planning

#### 4. Protocol Parser (`src/parser/`)
**Purpose**: Parse and interpret MUD output
- **OutputParser**: Parse raw MUD text into structured data
- **CommandParser**: Understand available commands and syntax
- **StateExtractor**: Extract game state from text output
- **EventDetector**: Detect important game events

**Key Files**:
- `outputParser.js` - Main parsing logic
- `patterns.js` - Regex patterns for parsing
- `stateExtractor.js` - State extraction logic
- `events.js` - Event detection and handling

#### 5. Action Executor (`src/executor/`)
**Purpose**: Execute AI decisions as MUD commands
- **CommandQueue**: Queue and throttle commands
- **CommandValidator**: Validate commands before execution
- **ResponseTracker**: Track command results
- **MacroSystem**: Execute complex command sequences

**Key Files**:
- `commandQueue.js` - Command queuing system
- `validator.js` - Command validation
- `executor.js` - Main execution logic

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [x] Set up project structure and documentation
- [ ] Implement basic MUD client with telnet connection
- [ ] Create simple output parsing for basic room information
- [ ] Establish Ollama API integration
- [ ] Basic logging and configuration system

### Phase 2: Core Functionality (Weeks 3-4)
- [ ] Implement comprehensive state management
- [ ] Advanced parsing for combat, inventory, and character stats
- [ ] Basic AI decision-making for movement and exploration
- [ ] Command queue and execution system
- [ ] Error handling and reconnection logic

### Phase 3: Intelligence Layer (Weeks 5-6)
- [ ] Context-aware prompt construction
- [ ] Multi-step action planning
- [ ] Combat strategy implementation
- [ ] Quest and goal tracking
- [ ] Learning from gameplay experience

### Phase 4: Advanced Features (Weeks 7-8)
- [ ] World mapping and navigation
- [ ] Social interaction capabilities
- [ ] Economic decision-making (buying/selling)
- [ ] PvP awareness and strategies
- [ ] Performance optimization

### Phase 5: Testing & Refinement (Weeks 9-10)
- [ ] Comprehensive testing with Arctic MUD
- [ ] Performance tuning and optimization
- [ ] Documentation completion
- [ ] Bug fixes and edge case handling
- [ ] Deployment and monitoring setup

## Technical Specifications

### Technology Stack
- **Runtime**: Node.js 18+
- **Language**: JavaScript (ES2022)
- **AI API**: Ollama REST API
- **Database**: SQLite for state persistence
- **Testing**: Jest for unit tests
- **Logging**: Winston for structured logging
- **Configuration**: JSON-based with environment overrides

### Key Dependencies
```json
{
  "axios": "^1.6.0",         // HTTP client for Ollama API
  "telnet-client": "^1.4.0", // Telnet protocol support
  "sqlite3": "^5.1.0",       // Database for state persistence
  "winston": "^3.11.0",      // Structured logging
  "lodash": "^4.17.0",       // Utility functions
  "ansi-regex": "^6.0.0",    // ANSI code parsing
  "commander": "^11.0.0",    // CLI interface
  "dotenv": "^16.3.0"        // Environment configuration
}
```

### Data Flow

1. **Input Flow**: MUD → Client → Parser → State Manager
2. **Decision Flow**: State Manager → AI Engine → Ollama API → Decision
3. **Output Flow**: Decision → Action Executor → Command Queue → MUD

### State Persistence

Game state will be persisted in SQLite with the following key tables:
- `game_sessions`: Track individual play sessions
- `world_rooms`: Store discovered rooms and connections
- `character_history`: Track character progression over time
- `ai_decisions`: Log AI decisions for analysis
- `performance_metrics`: Store performance data

### Configuration Management

Configuration hierarchy (highest priority first):
1. Command-line arguments
2. Environment variables
3. config.json file
4. Default values

### Error Handling Strategy

- **Connection Errors**: Automatic reconnection with exponential backoff
- **Parse Errors**: Graceful degradation with error logging
- **AI API Errors**: Fallback to basic rule-based decisions
- **State Corruption**: Automatic state recovery from checkpoints

### Performance Considerations

- **Response Time**: Target <2 second decision time for normal actions
- **Memory Usage**: Limit world map to 10,000 rooms maximum
- **API Calls**: Batch decisions where possible to reduce Ollama calls
- **Database**: Use connection pooling and prepared statements

### Security Considerations

- **Credentials**: Store MUD passwords securely (encrypted)
- **API Keys**: Use environment variables for sensitive data
- **Network**: Validate all incoming data from MUD
- **Logging**: Avoid logging sensitive information

## Testing Strategy

### Unit Tests
- Parser functions with known input/output pairs
- State management operations
- AI decision logic with mocked Ollama responses
- Command validation and execution

### Integration Tests
- Full parsing pipeline with real MUD output samples
- AI engine with actual Ollama API calls
- End-to-end command execution flow

### System Tests
- Full gameplay sessions with Arctic MUD
- Extended runtime stability testing
- Performance benchmarking under load

### Test Data
- Captured MUD output samples for various scenarios
- Known good game states for validation
- Performance benchmarks and regression detection

## Monitoring and Analytics

### Metrics to Track
- Commands per minute (CPM)
- Decision accuracy (successful vs failed actions)
- Experience gained per hour
- API response times
- Connection stability

### Logging Strategy
- Structured JSON logging with Winston
- Separate log levels for different components
- Automatic log rotation and archival
- Performance metrics logging

### Debugging Features
- Real-time state inspection web interface
- Command replay system for debugging
- AI decision reasoning logs
- Visual world map representation

## Future Enhancements

### Short-term (Next 6 months)
- Multiple MUD support (other Diku derivatives)
- Web-based monitoring dashboard
- Multi-character management
- Guild/group coordination features

### Long-term (6+ months)
- Machine learning integration for pattern recognition
- Advanced combat AI with predictive modeling
- Economic trading bot capabilities
- Social interaction and roleplay features
- Mobile app for monitoring and control

This design document will be updated as the project evolves and new requirements emerge.