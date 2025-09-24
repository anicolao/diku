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

After creating your character, record it using:
```record-character
{
  "name": "CharacterName",
  "class": "warrior", 
  "race": "human",
  "basicInfo": {
    "level": 1,
    "location": "Starting location"
  }
}
```
```

**For Existing Character Login:**
The LLM receives character context and login credentials:

```
You are continuing as an existing character: Thorin (Level 3 Warrior, Human)

**Character Context**
Last location: Temple of Midgaard
Recent memories:
- Reached level 3 by killing rabbits in the park
- Met helpful player 'Gandalf' who gave directions  
- Currently exploring Temple area for advancement opportunities

**Login Instructions**: Send ```telnet
Thorin
password123
```

Continue your session with this character's established goals and relationships.
```

## Memory Management System

### 1. LLM-Controlled Memory Recording

**Memory recording is entirely under LLM control**. The LLM decides when to record memories and what information is significant. No automatic triggers or parsing by the client.

**Character Creation Recording:**
When the LLM creates a new character, it records the character using:

```
```record-character
{
  "name": "Thorin",
  "class": "warrior", 
  "race": "human",
  "basicInfo": {
    "level": 1,
    "location": "Temple of Midgaard"
  },
  "password": "chosen_password"
}
```
```

**Memory Recording:**
When the LLM experiences something significant, it records memories using:

```
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
```

**Character Update:**
The LLM can update character information (location, level, etc.) using:

```
```update-character
{
  "level": 4,
  "location": "Dark Forest",
  "lastActivity": "Exploring new hunting grounds"
}
```
```

### 2. Memory Types Under LLM Control

The LLM determines what constitutes significant memories:

- **Progress Memories**: Level ups, skill improvements, achievements
- **Social Memories**: Important player interactions, friendships, conflicts
- **World Memories**: New location discoveries, quest information
- **Combat Memories**: Significant battles, deaths, resurrections
- **Strategic Memories**: Effective hunting spots, useful NPCs, gameplay insights

### 3. Memory Context in System Prompt

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
  async updateCharacter(characterId, updates) { /* ... */ }
  async recordMemory(characterId, memory) { /* ... */ }
  generateContextPrompt(character) { /* ... */ }
  parseLLMCommand(response) { /* Parse record-character/record-memory/update-character */ }
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
- Parse LLM record-character/record-memory/update-character commands
- Include character context in system prompt for existing characters
- Handle both "start" and login command scenarios

**Enhanced System Prompt**:
- User-controlled character selection
- Context loading for existing characters
- LLM-controlled memory and character recording

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