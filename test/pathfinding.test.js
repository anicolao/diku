/**
 * Tests for pathfinding and navigation enhancements
 */

const CharacterManager = require("../src/character-manager");
const MudClient = require("../src/client");
const fs = require("fs");
const path = require("path");

describe("Pathfinding Enhancements", () => {
  let characterManager;
  let testDataFile;
  const mockConfig = {
    characters: {
      dataFile: "test-characters.json",
      backupOnSave: false
    },
    mud: {
      host: "test.host",
      port: 2700
    },
    ollama: {
      baseUrl: "http://localhost:11434",
      model: "test-model"
    }
  };

  beforeEach(() => {
    testDataFile = path.resolve(mockConfig.characters.dataFile);
    // Remove test file if it exists
    if (fs.existsSync(testDataFile)) {
      fs.unlinkSync(testDataFile);
    }
    characterManager = new CharacterManager(mockConfig);
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testDataFile)) {
      fs.unlinkSync(testDataFile);
    }
  });

  describe("Character Data Model Enhancement", () => {
    test("should create new characters with pathfinding data structures", () => {
      const llmResponse = `
<new-character>
{
  "name": "TestExplorer",
  "class": "warrior",
  "race": "human",
  "password": "testpass",
  "level": 1,
  "location": "Town Square"
}
</new-character>
      `;

      const result = characterManager.parseNewCharacter(llmResponse);
      expect(result.success).toBe(true);
      
      const character = result.character;
      expect(character.roomMap).toEqual({});
      expect(character.movementHistory).toEqual([]);
      expect(character.pathMemory).toEqual([]);
      expect(character.currentRoomId).toBeNull();
    });

    test("should initialize pathfinding structures for old characters", () => {
      // Create an old character without pathfinding data
      const oldCharacter = {
        characterId: "old-char-id",
        name: "OldChar",
        level: 5,
        keyMemories: []
      };
      
      characterManager.characters["old-char-id"] = oldCharacter;
      
      const retrievedChar = characterManager.getCharacter("old-char-id");
      expect(retrievedChar.roomMap).toEqual({});
      expect(retrievedChar.movementHistory).toEqual([]);
      expect(retrievedChar.pathMemory).toEqual([]);
      expect(retrievedChar.currentRoomId).toBeNull();
    });
  });

  describe("Movement Tracking", () => {
    let testCharacterId;

    beforeEach(() => {
      const llmResponse = `
<new-character>
{
  "name": "Navigator",
  "class": "warrior", 
  "race": "human",
  "password": "test",
  "level": 1,
  "location": "Starting Room"
}
</new-character>
      `;
      
      const result = characterManager.parseNewCharacter(llmResponse);
      testCharacterId = result.character.characterId;
    });

    test("should record successful movement", () => {
      const mudOutput = `
You walk north.

Temple of Midgaard
You are in the southern entrance of the Temple of Midgaard.

56H 118V 1499X 0.00% 0C T:60 Exits:N,S,E,W
      `;

      const success = characterManager.recordMovement(testCharacterId, "N", mudOutput, true);
      expect(success).toBe(true);

      const character = characterManager.getCharacter(testCharacterId);
      expect(character.movementHistory.length).toBe(1);
      expect(character.movementHistory[0].direction).toBe("N");
      expect(character.movementHistory[0].result).toBe("success");
      
      // Check if room was mapped
      expect(Object.keys(character.roomMap).length).toBe(1);
      const roomId = Object.keys(character.roomMap)[0];
      expect(character.roomMap[roomId].name).toBe("Temple of Midgaard");
      expect(character.roomMap[roomId].exits).toEqual(["N", "S", "E", "W"]);
    });

    test("should record failed movement", () => {
      const mudOutput = "You can't go that way!";

      const success = characterManager.recordMovement(testCharacterId, "UP", mudOutput, false);
      expect(success).toBe(true);

      const character = characterManager.getCharacter(testCharacterId);
      expect(character.movementHistory.length).toBe(1);
      expect(character.movementHistory[0].direction).toBe("UP");
      expect(character.movementHistory[0].result).toBe("failed");
    });

    test("should limit movement history to 50 entries", () => {
      // Add 55 movements
      for (let i = 0; i < 55; i++) {
        characterManager.recordMovement(testCharacterId, "N", "You walk north.", true);
      }

      const character = characterManager.getCharacter(testCharacterId);
      expect(character.movementHistory.length).toBe(50);
    });
  });

  describe("Room Mapping", () => {
    let testCharacterId;

    beforeEach(() => {
      const llmResponse = `
<new-character>
{
  "name": "Mapper",
  "class": "thief",
  "race": "elf", 
  "password": "map123",
  "level": 2,
  "location": "City Center"
}
</new-character>
      `;
      
      const result = characterManager.parseNewCharacter(llmResponse);
      testCharacterId = result.character.characterId;
    });

    test("should extract room information from MUD output", () => {
      const character = characterManager.getCharacter(testCharacterId);
      const mudOutput = `
Market Square
This is the bustling market square in the center of town.
Merchants hawk their wares from colorful stalls.

67H 200V 2500X 15.3% 50C T:45 Exits:N,S,E,W,U
      `;

      characterManager.updateRoomMap(character, mudOutput);

      expect(Object.keys(character.roomMap).length).toBe(1);
      const roomId = Object.keys(character.roomMap)[0];
      expect(character.roomMap[roomId].name).toBe("Market Square");
      expect(character.roomMap[roomId].exits).toEqual(["N", "S", "E", "W", "U"]);
      expect(character.currentRoomId).toBe(roomId);
    });

    test("should track visit count for rooms", () => {
      const character = characterManager.getCharacter(testCharacterId);
      const mudOutput = `
Temple Entrance  
The holy entrance to the temple glows with divine light.

60H 150V 1800X 5.2% 25C T:30 Exits:N,S
      `;

      // Visit the room twice
      characterManager.updateRoomMap(character, mudOutput);
      characterManager.updateRoomMap(character, mudOutput);

      const roomId = Object.keys(character.roomMap)[0];
      expect(character.roomMap[roomId].visited_count).toBe(2);
    });
  });

  describe("Path Memory", () => {
    let testCharacterId;

    beforeEach(() => {
      const llmResponse = `
<new-character>
{
  "name": "Pathfinder",
  "class": "ranger",
  "race": "human",
  "password": "paths",
  "level": 3,
  "location": "Forest"
}
</new-character>
      `;
      
      const result = characterManager.parseNewCharacter(llmResponse);
      testCharacterId = result.character.characterId;
    });

    test("should record memorable paths", () => {
      const success = characterManager.recordPath(
        testCharacterId, 
        "Town Square", 
        "Temple", 
        ["N", "N", "E"]
      );
      
      expect(success).toBe(true);

      const character = characterManager.getCharacter(testCharacterId);
      expect(character.pathMemory.length).toBe(1);
      expect(character.pathMemory[0].from).toBe("Town Square");
      expect(character.pathMemory[0].to).toBe("Temple");
      expect(character.pathMemory[0].directions).toEqual(["N", "N", "E"]);
    });

    test("should replace existing path between same locations", () => {
      // Record initial path
      characterManager.recordPath(testCharacterId, "A", "B", ["N", "E"]);
      // Record new path between same locations
      characterManager.recordPath(testCharacterId, "A", "B", ["S", "W", "N"]);

      const character = characterManager.getCharacter(testCharacterId);
      expect(character.pathMemory.length).toBe(1);
      expect(character.pathMemory[0].directions).toEqual(["S", "W", "N"]);
    });

    test("should limit path memory to 20 entries", () => {
      // Add 25 paths
      for (let i = 0; i < 25; i++) {
        characterManager.recordPath(testCharacterId, `Location${i}`, `Destination${i}`, ["N"]);
      }

      const character = characterManager.getCharacter(testCharacterId);
      expect(character.pathMemory.length).toBe(20);
    });
  });

  describe("Navigation Context Generation", () => {
    let testCharacterId;

    beforeEach(() => {
      const llmResponse = `
<new-character>
{
  "name": "ContextTester",
  "class": "mage",
  "race": "human",
  "password": "context",
  "level": 1,
  "location": "Magic Academy"
}
</new-character>
      `;
      
      const result = characterManager.parseNewCharacter(llmResponse);
      testCharacterId = result.character.characterId;
    });

    test("should generate navigation context with room and movement data", () => {
      const character = characterManager.getCharacter(testCharacterId);
      
      // Set up test data
      character.currentRoomId = "test_room";
      character.roomMap["test_room"] = {
        name: "Test Room",
        exits: ["N", "S", "E"]
      };
      character.movementHistory = [
        { direction: "N", result: "success" },
        { direction: "E", result: "failed" },
        { direction: "S", result: "success" }
      ];
      character.pathMemory = [
        { from: "Start", to: "End", directions: ["N", "E", "S"] }
      ];

      const context = characterManager.generateNavigationContext(character);
      
      expect(context).toContain("Current room: Test Room");
      expect(context).toContain("Available exits: N, S, E");
      expect(context).toContain("Recent movements: N -> success; E -> failed; S -> success");
      expect(context).toContain("Known paths: Start to End: N E S");
      expect(context).toContain("Explored 1 rooms");
    });

    test("should handle empty navigation data gracefully", () => {
      const character = characterManager.getCharacter(testCharacterId);
      const context = characterManager.generateNavigationContext(character);
      
      expect(context).toBe("No navigation data available");
    });
  });

  describe("Memory Type Validation", () => {
    let testCharacterId;

    beforeEach(() => {
      const llmResponse = `
<new-character>
{
  "name": "MemoryTester",
  "class": "cleric",
  "race": "dwarf",
  "password": "memory",
  "level": 1,
  "location": "Mountain Hall"
}
</new-character>
      `;
      
      const result = characterManager.parseNewCharacter(llmResponse);
      testCharacterId = result.character.characterId;
    });

    test("should accept pathfinding memory type", () => {
      const llmResponse = `
<record-memory>
{
  "summary": "Found secret passage from tavern to castle",
  "type": "pathfinding",
  "details": { "path": ["N", "E", "hidden", "U"], "landmark": "tavern" }
}
</record-memory>
      `;

      const result = characterManager.parseRecordMemory(llmResponse, testCharacterId);
      expect(result.success).toBe(true);

      const character = characterManager.getCharacter(testCharacterId);
      expect(character.keyMemories.length).toBe(1);
      expect(character.keyMemories[0].type).toBe("pathfinding");
      expect(character.keyMemories[0].summary).toBe("Found secret passage from tavern to castle");
    });

    test("should reject invalid memory types", () => {
      const llmResponse = `
<record-memory>
{
  "summary": "Invalid memory type test",
  "type": "invalid_type"
}
</record-memory>
      `;

      const result = characterManager.parseRecordMemory(llmResponse, testCharacterId);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Invalid memory type");
    });
  });

  describe("MudClient Integration", () => {
    let client;

    beforeEach(() => {
      client = new MudClient(mockConfig, { characterId: null });
    });

    test("should identify movement commands correctly", () => {
      expect(client.isMovementCommand("N")).toBe(true);
      expect(client.isMovementCommand("north")).toBe(true);
      expect(client.isMovementCommand("SOUTH")).toBe(true);
      expect(client.isMovementCommand("u")).toBe(true);
      expect(client.isMovementCommand("look")).toBe(false);
      expect(client.isMovementCommand("say hello")).toBe(false);
      expect(client.isMovementCommand("ne")).toBe(false); // Should not accept diagonal directions
    });

    test("should include pathfinding tips in system prompt", () => {
      const systemPrompt = client.generateSystemPrompt();
      
      expect(systemPrompt).toContain("Pathfinding and Navigation");
      expect(systemPrompt).toContain("Always use 'look' after moving");
      expect(systemPrompt).toContain("Pay attention to room names");
      expect(systemPrompt).toContain("Use cardinal directions only");
      expect(systemPrompt).toContain("Record important paths");
    });

    test("should include navigation context for existing characters", () => {
      // Create a character with navigation data
      const characterId = "test-char-with-nav";
      client.characterManager.characters[characterId] = {
        characterId: characterId,
        name: "NavTester",
        class: "warrior",
        race: "human",
        level: 5,
        location: "Test Location",
        keyMemories: [],
        roomMap: {
          "test_room": {
            name: "Test Room",
            exits: ["N", "S"]
          }
        },
        movementHistory: [
          { direction: "N", result: "success" }
        ],
        pathMemory: [],
        currentRoomId: "test_room"
      };
      
      client.currentCharacterId = characterId;
      const systemPrompt = client.generateSystemPrompt();
      
      expect(systemPrompt).toContain("Navigation Context");
      expect(systemPrompt).toContain("Current room: Test Room");
      expect(systemPrompt).toContain("Pathfinding Tips");
    });
  });
});