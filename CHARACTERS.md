# Character Memory System Design Document

## Overview

The Diku MUD AI Player currently operates as a stateless LLM-driven client that creates characters but has no persistent memory of them between sessions. This design document outlines a lightweight character memory system that preserves the minimal, LLM-centric architecture while adding basic character persistence and selection capabilities.

## Problem Statement

**Current Limitation**: The LLM bot cannot remember usernames or character details from previous sessions, forcing it to create new characters each time it connects to the MUD.

**Solution Goal**: Implement a minimal character memory system that:
- Stores basic character information locally
- Allows character selection at startup  
- Provides character context to the LLM
- Maintains the existing simple, LLM-driven architecture

## Design Principles

1. **Preserve Simplicity**: Character memory should not add complex game logic or state management
2. **LLM-Driven**: Character selection and management decisions handled by LLM with enhanced prompts
3. **Minimal Storage**: Store only essential character data needed for session continuity
4. **Optional Feature**: System should gracefully handle missing or corrupted character data
5. **Privacy-Conscious**: Store character data locally, never transmitted to external services

## Character Data Model

### Character Information Structure

```json
{
  "characterId": "unique-uuid-v4",
  "name": "CharacterName",
  "password": "character_password",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "lastPlayedAt": "2024-01-15T12:45:00.000Z",
  "totalPlaytime": 5400000,
  "basicInfo": {
    "class": "warrior",
    "race": "human", 
    "level": 3,
    "location": "Temple of Midgaard"
  },
  "keyMemories": [
    "Created character and chose warrior class",
    "Met helpful player 'Gandalf' who gave me directions",
    "Reached level 3 by killing rabbits in the park",
    "Currently exploring the Temple area"
  ],
  "importantNPCs": [
    "Midgaard Cityguard",
    "The Temple Healer"
  ],
  "gameplayNotes": "Character is focused on reaching level 10. Prefers social interaction and efficient leveling."
}
```

### Character Storage Location

- **File**: `characters.json` in the application root directory
- **Format**: JSON array of character objects
- **Backup**: Optional `.backup` file created before modifications
- **Access**: Read/write through simple file operations, no database required

## Character Selection Workflow

### 1. User-Controlled Startup Flow

```
Application Startup
       ↓
Load characters.json
       ↓
Available characters? 
       ↓
   Yes → Present list to USER    No → Start new character flow
       ↓                              ↓
USER selects character             USER chooses new character
       ↓                              ↓
Load character context         LLM receives "start" command
       ↓                              ↓
   Start session with selected character context
```

### 2. User Character Selection Interface

The application presents available characters to the user for selection:

```
=== Diku MUD AI Player ===
Available characters:

1. Thorin (Level 3 Warrior) - Last played 2 hours ago
   Location: Temple of Midgaard
   
2. Elara (Level 1 Mage) - Last played yesterday  
   Location: Midgaard Square

3. Create new character

Choose option (1-3): _
```

### 3. LLM Prompting Based on User Choice

**For New Character Creation:**
The LLM receives a system prompt directing it to start character creation:

```
You are an expert Diku MUD player about to create a new character on arctic diku by telnet.
Your goal is to create a character and advance to level 10 as efficiently as possible, 
while making friends within the Diku environment.

**First Command**: Send ```telnet
start
```

**Character Recording Tool**: After creating your character, record it using:
```new-character
{
  "name": "CharacterName",
  "class": "warrior", 
  "race": "human",
  "password": "chosen_password",
  "basicInfo": {
    "level": 1,
    "location": "Starting location"
  }
}
```

**Memory Recording Tool**: Record significant experiences using:
```record-memory
{
  "summary": "Brief description of the experience",
  "type": "level_up|social|combat|exploration|quest",
  "details": {
    "relevant": "context information"
  }
}
```

The system will respond with "OK" if recording succeeded, or an error message if it failed.
Use these tools whenever you create a character or experience something significant.
```

**For Existing Character Login:**
The LLM receives character context and login credentials:

```
You are continuing as an existing character: Thorin (Level 3 Warrior, Human)

**Character Context**
Last location: Temple of Midgaard
Character password: password123
Recent memories:
- Reached level 3 by killing rabbits in the park
- Met helpful player 'Gandalf' who gave directions  
- Currently exploring Temple area for advancement opportunities

**Login Instructions**: Initiate login by sending your name as the first command.

**Memory Recording Tool**: Record significant experiences using:
```record-memory
{
  "summary": "Brief description of the experience",
  "type": "level_up|social|combat|exploration|quest", 
  "details": {
    "relevant": "context information"
  }
}
```

The system will respond with "OK" if recording succeeded, or an error message if it failed.
Continue your session with this character's established goals and relationships.
```

## Memory Management System

### 1. LLM-Bot Communication Protocol

The system uses a clear command-response protocol between the LLM and bot code:

**Command Format**: LLM issues commands in code blocks
**Response Format**: Bot responds with "OK" or error message  
**Error Handling**: LLM can retry failed commands with corrections

### 2. LLM Command Specification

**Character Creation Command:**
```new-character
{
  "name": "CharacterName",
  "class": "warrior", 
  "race": "human",
  "password": "chosen_password",
  "basicInfo": {
    "level": 1,
    "location": "Starting location"
  }
}
```

**Bot Response:**
- Success: "OK - Character 'CharacterName' recorded"
- Failure: "ERROR - [specific error message]"

**Memory Recording Command:**
```record-memory
{
  "summary": "Reached level 3 after defeating rabbits in the park",
  "type": "level_up",
  "details": {
    "newLevel": 3,
    "location": "Midgaard Park",
    "experience": "Efficient grinding session"
  }
}
```

**Bot Response:**
- Success: "OK - Memory recorded"
- Failure: "ERROR - [specific error message]"

### 3. System Prompt Integration

**All system prompts include the memory recording tool:**

```
**Memory Recording Tool**: Record significant experiences using:
```record-memory
{
  "summary": "Brief description of the experience",
  "type": "level_up|social|combat|exploration|quest",
  "details": {
    "relevant": "context information"
  }
}
```

The system will respond with "OK" if recording succeeded, or an error message if it failed.
Use this tool whenever you experience something significant that should be remembered.
```

**New character system prompts also include:**

```
**Character Recording Tool**: After creating your character, record it using:
```new-character
{
  "name": "CharacterName",
  "class": "class_chosen", 
  "race": "race_chosen",
  "password": "password_you_set",
  "basicInfo": {
    "level": 1,
    "location": "current_location"
  }
}
```

The system will respond with "OK" if recording succeeded, or an error message if it failed.
```

### 4. Memory Types and Command Usage

The LLM uses predefined memory types in the ```record-memory command:

- **level_up**: Character advancement, experience gains
- **social**: Player interactions, friendships, conflicts  
- **combat**: Significant battles, deaths, resurrections
- **exploration**: New location discoveries, area knowledge
- **quest**: Quest progress, NPC information, objectives

**Example Usage:**
```record-memory
{
  "summary": "Died to goblin but learned valuable lesson about combat",
  "type": "combat",
  "details": {
    "location": "Dark Forest", 
    "lesson": "Need better equipment before fighting groups"
  }
}
```

### 5. Memory Context in System Prompt

Character memories are loaded into the LLM's context as natural language:

```
**Character Background & Memories**
Recent experiences:
- "Reached level 3 after defeating rabbits in the park"
- "Met helpful player 'Gandalf' who gave directions to Dark Forest"
- "Discovered Temple Healer provides affordable healing"

Important relationships:
- Gandalf: High-level player, helpful with directions
- Temple Healer: Reliable NPC for healing services

Current objectives:
- Continue efficient leveling toward level 10
- Explore Dark Forest for better experience opportunities
- Maintain positive relationships with helpful players
```

## Implementation Architecture

### 1. New Components

**CharacterManager class** (`src/character-manager.js`):
```javascript
class CharacterManager {
  constructor(dataPath = './characters.json') { /* ... */ }
  async loadCharacters() { /* ... */ }
  async saveCharacter(character) { /* ... */ }
  async recordMemory(characterId, memory) { /* ... */ }
  generateContextPrompt(character) { /* ... */ }
  parseLLMCommand(response) { /* Parse new-character and record-memory commands */ }
  executeCommand(command) { /* Execute command and return "OK" or "ERROR - message" */ }
}
```

**UserInterface class** (`src/user-interface.js`):
```javascript
class UserInterface {
  presentCharacterSelection(characters) { /* Show character menu to user */ }
  getUserChoice() { /* Get user's character selection */ }
  confirmCharacterChoice(character) { /* Confirm selected character */ }
}
```

### 2. Integration Points

**Modified MudClient** (`src/client.js`):
- Present user with character selection interface at startup
- Parse LLM ```new-character and ```record-memory commands from responses
- Respond to LLM commands with "OK" or "ERROR - message"  
- Include character context in system prompt for existing characters
- Handle both "start" command and character name login scenarios

**Enhanced System Prompt**:
- User-controlled character selection
- Context loading for existing characters  
- Built-in tool specifications for ```new-character and ```record-memory
- Clear command-response protocol explanation

### 3. Configuration Changes

**config.json additions**:
```json
{
  "characters": {
    "dataFile": "characters.json",
    "backupOnSave": true
  }
}
```

## User Experience Flow

### First Time Usage
1. Application starts with no characters.json
2. User sees "Create new character" as only option
3. User selects new character creation
4. LLM receives prompt to send "start" command for character creation
5. LLM creates character and records it using ```record-character command
6. Session begins with fresh character

### Returning User
1. Application loads existing characters from characters.json
2. User presented with character selection interface
3. User chooses existing character or creates new character
4. For existing character: LLM receives login credentials and character context
5. For new character: LLM receives "start" command prompt
6. Session begins with appropriate character context

### Long-term Usage
1. Multiple characters accumulate over time through user choices
2. Each character maintains independent memory through LLM recording
3. User can switch between different character archetypes/playstyles
4. LLM decides what memories to preserve for each character

## Error Handling

### File System Errors
- **Missing characters.json**: Create new file, proceed with character creation
- **Corrupted file**: Log error, use backup if available, otherwise start fresh
- **Write failures**: Log error, continue session without saving (graceful degradation)

### Data Validation
- **Invalid character data**: Skip corrupted entries, load valid characters
- **Missing required fields**: Fill with defaults, flag for user attention
- **LLM command parsing**: Validate record-character/record-memory/update-character commands

### Recovery Scenarios
- **Backup restoration**: Automatic fallback to .backup file if main file corrupted
- **Manual recovery**: Export character data to human-readable format for debugging
- **Fresh start option**: CLI flag to ignore existing characters and start clean

## Security and Privacy

### Data Protection
- **Local storage only**: Character data never transmitted to LLM or external services
- **No sensitive data**: Store only game-related information, no personal details
- **User control**: Users can delete characters.json to reset all character memory

### LLM Context Isolation  
- **Character-specific prompts**: Each character gets isolated context
- **No cross-character data**: Prevent accidental information leakage between characters
- **Memory boundaries**: Clear separation between system memory and character memory

## Future Considerations

### Potential Enhancements
1. **Character sharing**: Export/import character files for sharing between installations
2. **Advanced memory**: Relationship tracking, quest progress, world knowledge
3. **Analytics**: Play pattern analysis, character progression insights
4. **Cloud sync**: Optional cloud storage for character data backup

### Limitations
- **No real-time MUD parsing**: Relies on LLM to identify and report significant events
- **Memory accuracy**: Depends on LLM's ability to accurately summarize experiences  
- **Storage growth**: Character files will grow over time without aggressive pruning

## Implementation Priority

### Phase 1: Core Functionality
1. Character data structure and storage
2. Basic character selection at startup
3. Simple memory recording (manual LLM reporting)
4. Character context in system prompt

### Phase 2: Enhanced Features
1. Automatic memory detection from MUD output
2. Memory pruning and summarization
3. Error handling and recovery
4. Configuration options

### Phase 3: Polish and Optimization
1. Memory search and retrieval
2. Character statistics and reporting
3. Performance optimization
4. Advanced error recovery

## Success Metrics

The character memory system will be considered successful if:

1. **Character Continuity**: LLM can successfully resume play with existing characters
2. **Memory Relevance**: Character memories provide useful context for decision making
3. **System Stability**: Character data persists reliably across sessions
4. **User Experience**: Character selection process is smooth and intuitive
5. **Performance Impact**: Memory system adds minimal overhead to existing functionality

This design maintains the project's core philosophy of LLM-driven simplicity while addressing the specific need for character persistence and continuity.