/**
 * Tests for navigation helper commands (/point and /wayfind)
 */

const CharacterManager = require("../src/character-manager");
const MudClient = require("../src/client");
const fs = require("fs");
const path = require("path");

describe("Navigation Helper Commands", () => {
  let characterManager;
  let testDataFile;
  let testCharacterId;
  const mockConfig = {
    characters: {
      dataFile: "test-nav-characters.json",
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

    // Create test character with room connections
    const character = {
      characterId: "test-nav-char",
      name: "Navigator",
      class: "warrior",
      race: "human",
      level: 5,
      location: "Temple of Midgaard",
      keyMemories: [],
      roomMap: {
        "temple_of_midgaard": {
          name: "Temple of Midgaard",
          exits: ["N", "S", "E", "W"],
          connections: {
            "N": "market_square",
            "S": "southern_gate",
            "E": "training_room",
            "W": "guild_hall"
          },
          visited_count: 3
        },
        "market_square": {
          name: "Market Square",
          exits: ["N", "S", "E", "W"],
          connections: {
            "S": "temple_of_midgaard",
            "N": "northern_road",
            "E": "shops_district",
            "W": "residential_area"
          },
          visited_count: 2
        },
        "solace": {
          name: "Solace",
          exits: ["N", "S", "E"],
          connections: {
            "S": "northern_road",
            "E": "eastern_path"
          },
          visited_count: 1
        },
        "northern_road": {
          name: "Northern Road",
          exits: ["N", "S"],
          connections: {
            "N": "solace",
            "S": "market_square"
          },
          visited_count: 1
        }
      },
      movementHistory: [],
      pathMemory: [],
      currentRoomId: "temple_of_midgaard"
    };

    characterManager.characters["test-nav-char"] = character;
    testCharacterId = "test-nav-char";
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testDataFile)) {
      fs.unlinkSync(testDataFile);
    }
  });

  describe("findNextStep", () => {
    test("should find next step to destination", () => {
      const result = characterManager.findNextStep(testCharacterId, "solace");
      expect(result).toBe("Next step to reach \"solace\": N");
    });

    test("should handle partial destination names", () => {
      const result = characterManager.findNextStep(testCharacterId, "market");
      expect(result).toBe("Next step to reach \"market\": N");
    });

    test("should handle destination not found", () => {
      const result = characterManager.findNextStep(testCharacterId, "unknown place");
      expect(result).toContain("No path found");
    });

    test("should handle already at destination", () => {
      const result = characterManager.findNextStep(testCharacterId, "temple of midgaard");
      expect(result).toContain("already at");
    });

    test("should handle invalid character", () => {
      const result = characterManager.findNextStep("invalid-id", "solace");
      expect(result).toBe("Error: Character not found.");
    });
  });

  describe("findFullPath", () => {
    test("should find full path to destination", () => {
      const result = characterManager.findFullPath(testCharacterId, "solace");
      expect(result).toBe("Full path to \"solace\": N N (2 steps)");
    });

    test("should handle single step path", () => {
      const result = characterManager.findFullPath(testCharacterId, "market square");
      expect(result).toBe("Full path to \"market square\": N (1 steps)");
    });

    test("should handle no path found", () => {
      const result = characterManager.findFullPath(testCharacterId, "nonexistent");
      expect(result).toContain("No path found");
    });
  });

  describe("BFS pathfinding algorithm", () => {
    test("should find shortest path using room connections", () => {
      const character = characterManager.getCharacter(testCharacterId);
      const path = characterManager.findShortestPath(character, "solace");
      
      expect(path).toEqual(["N", "N"]); // Temple -> Market -> Northern Road -> Solace
    });

    test("should return null for unreachable destination", () => {
      const character = characterManager.getCharacter(testCharacterId);
      // Add isolated room
      character.roomMap["isolated_room"] = {
        name: "Isolated Room",
        exits: [],
        connections: {},
        visited_count: 1
      };

      const path = characterManager.findShortestPath(character, "isolated");
      expect(path).toBeNull();
    });

    test("should handle no current room", () => {
      const character = characterManager.getCharacter(testCharacterId);
      character.currentRoomId = null;

      const path = characterManager.findShortestPath(character, "solace");
      expect(path).toBeNull();
    });
  });

  describe("Room connection tracking", () => {
    test("should track connections when recording movement", () => {
      const mudOutput = `
You walk north.

Market Square
The bustling market square is filled with merchants and travelers.

67H 200V 2500X 15.3% 50C T:45 Exits:N,S,E,W
      `;

      // Simulate movement from temple to market
      characterManager.recordMovement(testCharacterId, "N", mudOutput, true);

      const character = characterManager.getCharacter(testCharacterId);
      
      // Check connections were updated
      expect(character.roomMap["temple_of_midgaard"].connections["N"]).toBe("market_square");
      expect(character.roomMap["market_square"].connections["S"]).toBe("temple_of_midgaard");
    });

    test("should get opposite directions correctly", () => {
      expect(characterManager.getOppositeDirection("N")).toBe("S");
      expect(characterManager.getOppositeDirection("S")).toBe("N");
      expect(characterManager.getOppositeDirection("E")).toBe("W");
      expect(characterManager.getOppositeDirection("W")).toBe("E");
      expect(characterManager.getOppositeDirection("U")).toBe("D");
      expect(characterManager.getOppositeDirection("D")).toBe("U");
      expect(characterManager.getOppositeDirection("X")).toBeNull();
    });
  });

  describe("MudClient integration", () => {
    let client;
    let mockSendToLLM;

    beforeEach(() => {
      client = new MudClient(mockConfig, { characterId: testCharacterId });
      client.characterManager = characterManager; // Use our test character manager
      
      // Mock the sendToLLM method
      mockSendToLLM = jest.fn().mockResolvedValue();
      client.sendToLLM = mockSendToLLM;
      
      // Mock TUI methods
      client.tui = {
        showMudOutput: jest.fn(),
        showDebug: jest.fn()
      };
    });

    test("should handle /point command", async () => {
      await client.handleNavigationCommand("/point solace");
      
      expect(client.tui.showMudOutput).toHaveBeenCalledWith("Next step to reach \"solace\": N");
      expect(mockSendToLLM).toHaveBeenCalledWith("Next step to reach \"solace\": N");
    });

    test("should handle /wayfind command", async () => {
      await client.handleNavigationCommand("/wayfind market");
      
      expect(client.tui.showMudOutput).toHaveBeenCalledWith("Full path to \"market\": N (1 steps)");
      expect(mockSendToLLM).toHaveBeenCalledWith("Full path to \"market\": N (1 steps)");
    });

    test("should handle invalid command format", async () => {
      await client.handleNavigationCommand("/point");
      
      expect(client.tui.showMudOutput).toHaveBeenCalledWith("Usage: /point <destination>");
    });

    test("should handle no character selected", async () => {
      client.currentCharacterId = null;
      await client.handleNavigationCommand("/point solace");
      
      expect(client.tui.showMudOutput).toHaveBeenCalledWith("Navigation commands require a character to be selected.");
    });

    test("should include navigation commands in system prompt", () => {
      const systemPrompt = client.generateSystemPrompt();
      
      expect(systemPrompt).toContain("Navigation Helper Commands");
      expect(systemPrompt).toContain("/point <destination>");
      expect(systemPrompt).toContain("/wayfind <destination>");
      expect(systemPrompt).toContain("partial room names");
    });
  });
});