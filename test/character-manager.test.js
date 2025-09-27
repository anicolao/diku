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

  describe('Backup Rotation System', () => {
    let backupManager;
    
    beforeEach(() => {
      const backupConfig = {
        characters: {
          dataFile: testDataFile,
          backupOnSave: true  // Enable backups for these tests
        }
      };
      backupManager = new CharacterManager(backupConfig);
    });

    afterEach(() => {
      // Clean up numbered backup files (.1, .2, ..., .9)
      for (let i = 1; i <= 9; i++) {
        const backupFile = `${testDataFile}.${i}`;
        if (fs.existsSync(backupFile)) {
          fs.unlinkSync(backupFile);
        }
      }
    });

    test('should create .1 backup on first save', () => {
      // Create initial data file to backup
      const initialData = { existing: 'data' };
      fs.writeFileSync(testDataFile, JSON.stringify(initialData, null, 2));
      
      // Create and save a character (parseNewCharacter calls saveCharacters internally)
      const createResponse = `<new-character>
{
  "name": "BackupTest",
  "class": "warrior", 
  "race": "human",
  "password": "test123"
}
</new-character>`;
      
      backupManager.parseNewCharacter(createResponse);
      
      // Check that .1 backup was created (should contain the initial data)
      const backup1 = `${testDataFile}.1`;
      expect(fs.existsSync(backup1)).toBe(true);
      expect(fs.existsSync(`${testDataFile}.2`)).toBe(false);
      
      // Verify backup contains the initial data that was backed up
      const backupContent = JSON.parse(fs.readFileSync(backup1, 'utf8'));
      expect(backupContent.existing).toBe('data');
    });

    test('should rotate backups correctly (.1 -> .2, new -> .1)', () => {
      // Create initial data file
      const initialData = { test: 'initial' };
      fs.writeFileSync(testDataFile, JSON.stringify(initialData, null, 2));
      
      // First save creates .1
      backupManager.saveCharacters();
      expect(fs.existsSync(`${testDataFile}.1`)).toBe(true);
      
      // Modify data and save again
      backupManager.characters = { test: 'modified' };
      backupManager.saveCharacters();
      
      // Check rotation: old .1 should now be .2, new data backed up as .1
      expect(fs.existsSync(`${testDataFile}.1`)).toBe(true);
      expect(fs.existsSync(`${testDataFile}.2`)).toBe(true);
      
      // Verify contents - .2 should have initial data, .1 should have previous save
      const backup2Content = JSON.parse(fs.readFileSync(`${testDataFile}.2`, 'utf8'));
      expect(backup2Content.test).toBe('initial');
    });

    test('should limit backups to 9 files and discard oldest', () => {
      // Create 10 different data versions and save them
      for (let i = 0; i <= 10; i++) {
        // Write the data file first, then save to create backup
        fs.writeFileSync(testDataFile, JSON.stringify({ version: i }, null, 2));
        backupManager.characters = { version: i };
        backupManager.saveCharacters();
      }
      
      // Should have backups .1 through .9, but not .10
      expect(fs.existsSync(`${testDataFile}.1`)).toBe(true);
      expect(fs.existsSync(`${testDataFile}.9`)).toBe(true);
      expect(fs.existsSync(`${testDataFile}.10`)).toBe(false);
      
      // .1 should have the most recent backup (version 9), .9 should contain version 2
      // (version 0 and 1 were discarded when we hit the 9-backup limit)
      const backup9Content = JSON.parse(fs.readFileSync(`${testDataFile}.9`, 'utf8'));
      expect(backup9Content.version).toBe(2);
    });

    test('should handle missing intermediate backups gracefully', () => {
      // Create .1 and .3 backups manually (skip .2)
      fs.writeFileSync(testDataFile, JSON.stringify({ test: 'original' }, null, 2));
      fs.writeFileSync(`${testDataFile}.1`, JSON.stringify({ test: 'backup1' }, null, 2));
      fs.writeFileSync(`${testDataFile}.3`, JSON.stringify({ test: 'backup3' }, null, 2));
      
      // Save should rotate existing backups correctly
      backupManager.characters = { test: 'new' };
      backupManager.saveCharacters();
      
      // .1 becomes .2, .3 becomes .4, new backup becomes .1
      expect(fs.existsSync(`${testDataFile}.1`)).toBe(true);
      expect(fs.existsSync(`${testDataFile}.2`)).toBe(true);
      expect(fs.existsSync(`${testDataFile}.3`)).toBe(false); // Should be moved to .4
      expect(fs.existsSync(`${testDataFile}.4`)).toBe(true);
      
      const backup2Content = JSON.parse(fs.readFileSync(`${testDataFile}.2`, 'utf8'));
      expect(backup2Content.test).toBe('backup1');
    });

    test('should not create backups when backupOnSave is false', () => {
      const noBackupManager = new CharacterManager(mockConfig); // Uses backupOnSave: false
      
      const createResponse = `<new-character>
{
  "name": "NoBackupTest",
  "class": "mage",
  "race": "elf", 
  "password": "test123"
}
</new-character>`;
      
      noBackupManager.parseNewCharacter(createResponse);
      noBackupManager.saveCharacters();
      
      // No backup files should be created
      expect(fs.existsSync(`${testDataFile}.1`)).toBe(false);
    });

    test('should continue saving even if backup rotation fails', () => {
      // Create a character
      const createResponse = `<new-character>
{
  "name": "FailureTest",
  "class": "warrior",
  "race": "human", 
  "password": "test123"
}
</new-character>`;
      
      const result = backupManager.parseNewCharacter(createResponse);
      
      // Mock fs.renameSync to throw an error during rotation
      const originalRename = fs.renameSync;
      fs.renameSync = jest.fn(() => {
        throw new Error('Mock rotation failure');
      });
      
      // Save should still succeed despite backup rotation failure
      const saveResult = backupManager.saveCharacters();
      expect(saveResult).toBe(true);
      
      // Verify main data file was still created
      expect(fs.existsSync(testDataFile)).toBe(true);
      
      // Restore original function
      fs.renameSync = originalRename;
    });
  });
});