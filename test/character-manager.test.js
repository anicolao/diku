/**
 * Tests for character memory system
 */

const fs = require('fs');
const path = require('path');
const CharacterManager = require('../src/character-manager');

// Clean up test files
const testDataFile = 'test-characters.json';

describe('Character Memory System', () => {
  let manager;
  let mockConfig;

  beforeEach(() => {
    // Clean up test file before each test
    if (fs.existsSync(testDataFile)) {
      fs.unlinkSync(testDataFile);
    }

    mockConfig = {
      characters: {
        dataFile: testDataFile,
        backupOnSave: false
      }
    };
    
    manager = new CharacterManager(mockConfig);
  });

  afterEach(() => {
    // Clean up test file after each test
    if (fs.existsSync(testDataFile)) {
      fs.unlinkSync(testDataFile);
    }
    // Clean up backup files
    const backups = fs.readdirSync('.').filter(f => f.startsWith(testDataFile + '.backup'));
    backups.forEach(backup => fs.unlinkSync(backup));
  });

  describe('CharacterManager', () => {
    test('should initialize with empty character list', () => {
      const characters = manager.getCharactersList();
      expect(characters).toEqual([]);
    });

    test('should parse new character command correctly', () => {
      const llmResponse = `I'll create my character now.

<new-character>
{
  "name": "Thorin",
  "class": "warrior",
  "race": "dwarf",
  "password": "mypassword",
  "level": 1,
  "location": "Temple of Midgaard"
}
</new-character>

Now I'll start exploring.`;

      const result = manager.parseNewCharacter(llmResponse);
      expect(result.success).toBe(true);
      expect(result.character.name).toBe('Thorin');
      expect(result.character.class).toBe('warrior');
      expect(result.character.race).toBe('dwarf');
      expect(result.character.characterId).toBeDefined();
    });

    test('should handle invalid character data', () => {
      const llmResponse = `<new-character>
{
  "class": "warrior"
}
</new-character>`;

      const result = manager.parseNewCharacter(llmResponse);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Character name is required');
    });

    test('should parse memory record command correctly', () => {
      // First create a character
      const createResponse = `<new-character>
{
  "name": "TestChar",
  "class": "warrior",
  "race": "human",
  "password": "test123",
  "level": 1,
  "location": "Starting area"
}
</new-character>`;
      
      const createResult = manager.parseNewCharacter(createResponse);
      const characterId = createResult.character.characterId;

      // Then record a memory
      const memoryResponse = `I just leveled up!

<record-memory>
{
  "summary": "Reached level 2 after defeating goblins",
  "type": "level_up",
  "details": {
    "newLevel": 2,
    "location": "Dark Forest"
  }
}
</record-memory>

Great progress!`;

      const result = manager.parseRecordMemory(memoryResponse, characterId);
      expect(result.success).toBe(true);
      
      const character = manager.getCharacter(characterId);
      expect(character.keyMemories).toHaveLength(1);
      expect(character.keyMemories[0].summary).toBe('Reached level 2 after defeating goblins');
      expect(character.level).toBe(2);
      expect(character.location).toBe('Dark Forest');
    });

    test('should generate character context correctly', () => {
      // Create a character with some memories
      const createResponse = `<new-character>
{
  "name": "Elara",
  "class": "mage",
  "race": "elf",
  "password": "magic123",
  "level": 3,
  "location": "Magic Academy"
}
</new-character>`;
      
      const createResult = manager.parseNewCharacter(createResponse);
      const characterId = createResult.character.characterId;
      
      // Add a memory
      const memoryResponse = `<record-memory>
{
  "summary": "Learned new spell from master wizard",
  "type": "social",
  "details": {}
}
</record-memory>`;
      
      manager.parseRecordMemory(memoryResponse, characterId);
      
      const context = manager.generateCharacterContext(characterId);
      expect(context.name).toBe('Elara');
      expect(context.class).toBe('mage');
      expect(context.level).toBe(3);
      expect(context.memories).toContain('Learned new spell');
    });

    test('should process LLM response for commands', () => {
      const llmResponse = `I'll create a character and record progress.

<new-character>
{
  "name": "TestHero",
  "class": "warrior", 
  "race": "human",
  "password": "test123",
  "level": 1,
  "location": "Starting area"
}
</new-character>

<record-memory>
{
  "summary": "Started adventure",
  "type": "exploration",
  "details": {}
}
</record-memory>

Let me continue exploring.`;

      const responses = manager.processLLMResponse(llmResponse);
      expect(responses).toHaveLength(2);
      expect(responses[0]).toContain('OK - Character recorded');
      expect(responses[1]).toContain('OK - Memory recorded');
    });

    test('should handle persistence correctly', () => {
      // Create a character
      const createResponse = `<new-character>
{
  "name": "Persistent",
  "class": "warrior",
  "race": "human",
  "password": "test123",
  "level": 1,
  "location": "Starting area"
}
</new-character>`;
      
      const createResult = manager.parseNewCharacter(createResponse);
      expect(createResult.success).toBe(true);
      
      // Create new manager instance to test loading
      const manager2 = new CharacterManager(mockConfig);
      const characters = manager2.getCharactersList();
      expect(characters).toHaveLength(1);
      expect(characters[0].name).toBe('Persistent');
    });

    test('should validate memory types', () => {
      // Create a character first
      const createResponse = `<new-character>
{
  "name": "TestChar",
  "class": "warrior",
  "race": "human",
  "password": "test123"
}
</new-character>`;
      
      const createResult = manager.parseNewCharacter(createResponse);
      const characterId = createResult.character.characterId;

      // Try invalid memory type
      const invalidMemoryResponse = `<record-memory>
{
  "summary": "Something happened",
  "type": "invalid_type",
  "details": {}
}
</record-memory>`;

      const result = manager.parseRecordMemory(invalidMemoryResponse, characterId);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid memory type');
    });
  });
});