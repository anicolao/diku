# Character Memory System Design Document

## Problem
The LLM bot cannot remember character usernames or details between sessions, forcing it to create new characters each time.

## Solution
A minimal character memory system with user-controlled character selection and LLM-controlled information storage.

## Character Data Model

Store characters in `characters.json`:
```json
{
  "characterId": "unique-uuid",
  "name": "CharacterName", 
  "password": "character_password",
  "class": "warrior",
  "race": "human",
  "level": 3,
  "location": "Temple of Midgaard",
  "keyMemories": [
    "Reached level 3 by killing rabbits in the park",
    "Met helpful player 'Gandalf' who gave directions"
  ]
}
```

## User Interface Flow

**Startup Menu:**
```
=== Diku MUD AI Player ===
Available characters:
1. Thorin (Level 3 Warrior)
2. Elara (Level 1 Mage) 
3. Create new character
Choose option (1-3): _
```

## LLM Communication Protocol

**Commands use XML-style delimiters for easy parsing:**

**New Character Creation:**
```
<new-character>
{
  "name": "CharacterName",
  "class": "warrior",
  "race": "human", 
  "password": "chosen_password",
  "level": 1,
  "location": "Starting location"
}
</new-character>
```

**Memory Recording:**
```
<record-memory>
{
  "summary": "Reached level 4 after defeating goblins",
  "type": "level_up",
  "details": {
    "newLevel": 4,
    "location": "Dark Forest"
  }
}
</record-memory>
```

**Bot Responses:**
- Success: "OK - Character recorded" or "OK - Memory recorded"
- Failure: "ERROR - Invalid character name" or specific error message
- LLM can retry with corrections

## System Prompts

**For New Character Creation:**
```
You are an expert Diku MUD player creating a new character on arctic diku.
Goal: Create character and advance to level 10 efficiently while making friends.

First Command: Send ```telnet
start
```

After creating your character, record it:
<new-character>
{
  "name": "YourCharacterName",
  "class": "chosen_class",
  "race": "chosen_race", 
  "password": "your_password",
  "level": 1,
  "location": "current_location"
}
</new-character>

Record significant experiences:
<record-memory>
{
  "summary": "Brief description",
  "type": "level_up|social|combat|exploration|quest",
  "details": { "key": "value" }
}
</record-memory>

System responds with "OK" or "ERROR - message". Use these tools when appropriate.
```

**For Existing Character Login:**
```
Continuing as: Thorin (Level 3 Warrior, Human)

Character password: password123
Last location: Temple of Midgaard
Recent memories:
- Reached level 3 by killing rabbits in the park
- Met helpful player 'Gandalf' who gave directions

Login: Send your character name as the first command.

Record experiences:
<record-memory>
{
  "summary": "Brief description",
  "type": "level_up|social|combat|exploration|quest", 
  "details": { "key": "value" }
}
</record-memory>

Continue with this character's established goals and relationships.
```

## Implementation

**CharacterManager** (`src/character-manager.js`):
- Load/save characters from characters.json
- Parse `<new-character>` and `<record-memory>` from LLM responses
- Return "OK" or "ERROR - message" 
- Generate character context for system prompts

**Modified MudClient** (`src/client.js`):
- Present character selection menu at startup
- Monitor LLM responses for XML-delimited commands
- Execute commands and send responses back to LLM
- Include character context in system prompts

**Memory Types:**
- `level_up`: Character advancement
- `social`: Player interactions 
- `combat`: Battles, deaths
- `exploration`: New locations
- `quest`: Quest progress

## Configuration

Add to `config.json`:
```json
{
  "characters": {
    "dataFile": "characters.json",
    "backupOnSave": true
  }
}
```