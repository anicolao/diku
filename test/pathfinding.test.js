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

    test("should parse 'Obvious exits:' format from exits command", () => {
      const character = characterManager.getCharacter(testCharacterId);
      const exitsOutput = `
On a Vallenwood Tree Above Solace Square
    The sturdy boughs of this particularly huge vallenwood tree extend to
both the north and south. 

46H 91V 1499X 0.00% 0C T:9 Exits:NESWUD> exits
Obvious exits:
North - On a Vallenwood Bough
East  - A Solace Canopy Walk
South - On a Vallenwood Bough
West  - On a Canopy Walk Between Two Vallenwood Trees
Up    - Climbing a Huge Vallenwood Tree
Down  - Solace Square
      `;

      characterManager.updateRoomMap(character, exitsOutput);

      const roomId = "on_a_vallenwood_tree_above_solace_square_the_sturdy_boughs_of_this_particularly_huge_vallenwood_tree_extend_to_DENSUW";
      const room = character.roomMap[roomId];
      
      expect(room).toBeDefined();
      expect(room.name).toBe("On a Vallenwood Tree Above Solace Square");
      expect(room.exits).toEqual(["N", "E", "S", "W", "U", "D"]);
      
      // Check connections were created
      expect(room.connections).toEqual({
        "N": "on_a_vallenwood_bough",
        "E": "a_solace_canopy_walk",
        "S": "on_a_vallenwood_bough",
        "W": "on_a_canopy_walk_between_two_vallenwood_trees",
        "U": "climbing_a_huge_vallenwood_tree",
        "D": "solace_square"
      });

      // Check that destination rooms were created
      expect(character.roomMap["solace_square"]).toBeDefined();
      expect(character.roomMap["solace_square"].name).toBe("Solace Square");
      expect(character.roomMap["solace_square"].connections["U"]).toBe(roomId);
    });

    test("should correct room IDs when actual name doesn't match expected", () => {
      const character = characterManager.getCharacter(testCharacterId);
      
      // Set up initial state with incorrect room name
      character.currentRoomId = "starting_room";
      character.roomMap["starting_room"] = {
        name: "Starting Room",
        exits: ["D"],
        connections: { "D": "short_tree" },
        visited_count: 1
      };
      character.roomMap["short_tree"] = {
        name: "Short Tree",
        exits: [],
        connections: {},
        visited_count: 0
      };
      
      // Simulate successful movement
      character.movementHistory = [
        { direction: "D", result: "success", timestamp: new Date().toISOString() }
      ];

      const correctionOutput = `
Climbing a Huge Vallenwood Tree
    You are climbing up this massive vallenwood tree.

45H 89V 1499X 0.00% 0C T:12 Exits:UD> exits
Obvious exits:
Up    - On a Vallenwood Tree Above Solace Square
Down  - Solace Square
      `;

      characterManager.updateRoomMap(character, correctionOutput);

      // The old "short_tree" should be removed and connections updated
      expect(character.roomMap["short_tree"]).toBeUndefined();
      expect(character.roomMap["starting_room"].connections["D"]).toBe("climbing_a_huge_vallenwood_tree_you_are_climbing_up_this_massive_vallenwood_tree_DU");
      expect(character.roomMap["climbing_a_huge_vallenwood_tree_you_are_climbing_up_this_massive_vallenwood_tree_DU"]).toBeDefined();
      expect(character.roomMap["climbing_a_huge_vallenwood_tree_you_are_climbing_up_this_massive_vallenwood_tree_DU"].name).toBe("Climbing a Huge Vallenwood Tree");
    });

    test("should handle doors in exit format correctly", () => {
      const character = characterManager.getCharacter(testCharacterId);
      const mudOutputWithDoors = `
Sample Room
   This would be a boring sample room. There is more description.
An NPC is standing here.
A pile of coins is on the floor.

67H 200V 2500X 15.3% 50C T:45 Exits:N(E)W
      `;

      characterManager.updateRoomMap(character, mudOutputWithDoors);

      expect(Object.keys(character.roomMap).length).toBe(1);
      const roomId = Object.keys(character.roomMap)[0];
      const room = character.roomMap[roomId];
      
      // Should strip doors from room ID exits abbreviation
      expect(roomId).toBe("sample_room_this_would_be_a_boring_sample_room_ENW");
      expect(room.name).toBe("Sample Room");
      // Exits array should contain N, E, W (doors stripped)
      expect(room.exits).toEqual(["N", "E", "W"]);
    });

    test("should handle 'Too dark to tell' exits without creating connections", () => {
      const character = characterManager.getCharacter(testCharacterId);
      const darkExitsOutput = `
Mysterious Room
    This room is dimly lit with shadows in every corner.

42H 85V 1200X 2.1% 15C T:20 Exits:NESW> exits
Obvious exits:
North - Bright Corridor
East  - The Eastern Chamber
South - Too dark to tell
West  - Western Hallway
      `;

      characterManager.updateRoomMap(character, darkExitsOutput);

      const roomId = "mysterious_room_this_room_is_dimly_lit_with_shadows_in_every_corner_ENSW";
      const room = character.roomMap[roomId];
      
      expect(room).toBeDefined();
      expect(room.name).toBe("Mysterious Room");
      expect(room.exits).toEqual(["N", "E", "S", "W"]);
      
      // Check that South exit exists but has no connection due to darkness
      expect(room.exits).toContain("S");
      expect(room.connections["S"]).toBeUndefined();
      
      // Check that other exits have proper connections
      expect(room.connections["N"]).toBe("bright_corridor");
      expect(room.connections["E"]).toBe("the_eastern_chamber");
      expect(room.connections["W"]).toBe("western_hallway");
      
      // Verify no "too_dark_to_tell" room was created
      expect(character.roomMap["too_dark_to_tell"]).toBeUndefined();
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