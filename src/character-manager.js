/**
 * Character Manager
 * Handles character persistence and memory management for the Diku MUD AI Player
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Simple UUID v4 generator using crypto
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = crypto.randomBytes(1)[0] % 16;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class CharacterManager {
  constructor(config) {
    this.config = config;
    this.dataFile = path.resolve(config.characters?.dataFile || "characters.json");
    this.backupOnSave = config.characters?.backupOnSave || true;
    this.characters = {};
    
    this.loadCharacters();
  }

  /**
   * Load characters from storage file
   */
  loadCharacters() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, "utf8");
        const parsed = JSON.parse(data);
        
        // Handle both array and object formats for backwards compatibility
        if (Array.isArray(parsed)) {
          // Convert array to object keyed by characterId
          this.characters = {};
          parsed.forEach(char => {
            if (char.characterId) {
              this.characters[char.characterId] = char;
            }
          });
        } else {
          this.characters = parsed;
        }
      }
    } catch (error) {
      console.error(`Warning: Could not load characters from ${this.dataFile}: ${error.message}`);
      this.characters = {};
    }
  }

  /**
   * Save characters to storage file
   */
  saveCharacters() {
    try {
      if (this.backupOnSave && fs.existsSync(this.dataFile)) {
        const backupFile = `${this.dataFile}.backup.${Date.now()}`;
        fs.copyFileSync(this.dataFile, backupFile);
      }

      fs.writeFileSync(this.dataFile, JSON.stringify(this.characters, null, 2), "utf8");
      return true;
    } catch (error) {
      console.error(`Error saving characters to ${this.dataFile}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get all characters for menu display
   */
  getCharactersList() {
    return Object.values(this.characters).map(char => ({
      id: char.characterId,
      name: char.name,
      level: char.level || 1,
      class: char.class || "unknown",
      race: char.race || "unknown"
    }));
  }

  /**
   * Get character by ID
   */
  getCharacter(characterId) {
    const character = this.characters[characterId];
    if (!character) return null;
    
    // Initialize pathfinding data structures for older characters
    if (!character.roomMap) character.roomMap = {};
    if (!character.movementHistory) character.movementHistory = [];
    if (!character.pathMemory) character.pathMemory = [];
    if (!character.currentRoomId) character.currentRoomId = null;
    
    return character;
  }

  /**
   * Parse new character command from LLM response
   */
  parseNewCharacter(llmResponse) {
    try {
      const match = llmResponse.match(/<new-character>\s*([\s\S]*?)\s*<\/new-character>/i);
      if (!match) {
        return null;
      }

      const characterData = JSON.parse(match[1].trim());
      
      // Validate required fields
      if (!characterData.name || typeof characterData.name !== "string") {
        return { error: "Character name is required and must be a string" };
      }

      // Create character with UUID
      const character = {
        characterId: generateUUID(),
        name: characterData.name,
        password: characterData.password || "",
        class: characterData.class || "unknown",
        race: characterData.race || "unknown",
        level: characterData.level || 1,
        location: characterData.location || "unknown",
        keyMemories: [],
        // Enhanced pathfinding data structures
        roomMap: {},           // Map of room_id -> { name, description, exits, visited_count }
        movementHistory: [],   // Recent movement commands and results
        pathMemory: [],        // Memorable paths between important locations
        currentRoomId: null,   // Current room identifier
        createdAt: new Date().toISOString(),
        lastPlayed: new Date().toISOString()
      };

      // Save character
      this.characters[character.characterId] = character;
      if (this.saveCharacters()) {
        return { success: true, character };
      } else {
        return { error: "Failed to save character data" };
      }

    } catch (error) {
      return { error: `Failed to parse character data: ${error.message}` };
    }
  }

  /**
   * Parse memory record command from LLM response
   */
  parseRecordMemory(llmResponse, characterId) {
    try {
      const match = llmResponse.match(/<record-memory>\s*([\s\S]*?)\s*<\/record-memory>/i);
      if (!match) {
        return null;
      }

      const character = this.characters[characterId];
      if (!character) {
        return { error: "Character not found" };
      }

      const memoryData = JSON.parse(match[1].trim());
      
      // Validate memory data
      if (!memoryData.summary || typeof memoryData.summary !== "string") {
        return { error: "Memory summary is required and must be a string" };
      }

      // Validate memory type
      const validTypes = ["level_up", "social", "combat", "exploration", "quest", "pathfinding"];
      if (memoryData.type && !validTypes.includes(memoryData.type)) {
        return { error: `Invalid memory type. Must be one of: ${validTypes.join(", ")}` };
      }

      // Add memory to character
      const memory = {
        summary: memoryData.summary,
        type: memoryData.type || "exploration",
        details: memoryData.details || {},
        timestamp: new Date().toISOString()
      };

      character.keyMemories.push(memory);
      character.lastPlayed = new Date().toISOString();
      
      // Update character level and location if provided in details
      if (memoryData.details?.newLevel) {
        character.level = memoryData.details.newLevel;
      }
      if (memoryData.details?.location) {
        character.location = memoryData.details.location;
      }

      // Keep only last 20 memories to prevent excessive growth
      if (character.keyMemories.length > 20) {
        character.keyMemories = character.keyMemories.slice(-20);
      }

      if (this.saveCharacters()) {
        return { success: true };
      } else {
        return { error: "Failed to save memory data" };
      }

    } catch (error) {
      return { error: `Failed to parse memory data: ${error.message}` };
    }
  }

  /**
   * Generate character context for system prompts
   */
  generateCharacterContext(characterId) {
    const character = this.characters[characterId];
    if (!character) {
      return null;
    }

    const recentMemories = character.keyMemories
      .slice(-5) // Get last 5 memories
      .map(memory => `- ${memory.summary}`)
      .join("\n");

    // Generate navigation context from room map and movement history
    const navigationContext = this.generateNavigationContext(character);

    return {
      name: character.name,
      password: character.password,
      class: character.class,
      race: character.race,
      level: character.level,
      location: character.location,
      memories: recentMemories,
      navigation: navigationContext
    };
  }

  /**
   * Generate navigation context for pathfinding assistance
   */
  generateNavigationContext(character) {
    const context = [];
    
    // Add current room information if available
    if (character.currentRoomId && character.roomMap[character.currentRoomId]) {
      const currentRoom = character.roomMap[character.currentRoomId];
      context.push(`Current room: ${currentRoom.name}`);
      if (currentRoom.exits && currentRoom.exits.length > 0) {
        context.push(`Available exits: ${currentRoom.exits.join(", ")}`);
      }
    }

    // Add recent movement history
    if (character.movementHistory && character.movementHistory.length > 0) {
      const recentMoves = character.movementHistory
        .slice(-3)  // Last 3 movements
        .map(move => `${move.direction} -> ${move.result}`)
        .join("; ");
      context.push(`Recent movements: ${recentMoves}`);
    }

    // Add known paths to important locations
    if (character.pathMemory && character.pathMemory.length > 0) {
      const paths = character.pathMemory
        .slice(-3)  // Most recent paths
        .map(path => `${path.from} to ${path.to}: ${path.directions.join(" ")}`)
        .join("; ");
      context.push(`Known paths: ${paths}`);
    }

    // Add room exploration summary
    const roomCount = Object.keys(character.roomMap || {}).length;
    if (roomCount > 0) {
      context.push(`Explored ${roomCount} rooms`);
    }

    return context.length > 0 ? context.join("\n") : "No navigation data available";
  }

  /**
   * Process LLM response for character commands
   */
  processLLMResponse(llmResponse, currentCharacterId = null) {
    const responses = [];
    let characterIdForMemory = currentCharacterId;

    // Check for new character creation
    const newCharResult = this.parseNewCharacter(llmResponse);
    if (newCharResult !== null) {
      if (newCharResult.success) {
        responses.push(`OK - Character recorded: ${newCharResult.character.name}`);
        // If we just created a character, use its ID for any memory recording in the same response
        characterIdForMemory = newCharResult.character.characterId;
      } else {
        responses.push(`ERROR - ${newCharResult.error}`);
      }
    }

    // Check for memory recording (if we have a character to record for)
    if (characterIdForMemory) {
      const memoryResult = this.parseRecordMemory(llmResponse, characterIdForMemory);
      if (memoryResult !== null) {
        if (memoryResult.success) {
          responses.push("OK - Memory recorded");
        } else {
          responses.push(`ERROR - ${memoryResult.error}`);
        }
      }
    }

    return responses;
  }

  /**
   * Record movement and update room map
   */
  recordMovement(characterId, direction, mudOutput, success = true) {
    const character = this.characters[characterId];
    if (!character) return false;

    // Initialize pathfinding data structures if they don't exist (for old characters)
    if (!character.movementHistory) character.movementHistory = [];
    if (!character.roomMap) character.roomMap = {};
    if (!character.pathMemory) character.pathMemory = [];

    // Record the movement
    const movement = {
      direction,
      result: success ? "success" : "failed",
      timestamp: new Date().toISOString(),
      mudOutput: mudOutput.substring(0, 200) // Store first 200 chars for context
    };

    character.movementHistory.push(movement);

    // Keep only last 50 movements to prevent excessive memory usage
    if (character.movementHistory.length > 50) {
      character.movementHistory = character.movementHistory.slice(-50);
    }

    // Try to extract room information from MUD output and update room map
    this.updateRoomMap(character, mudOutput);

    this.saveCharacters();
    return true;
  }

  /**
   * Update room map based on MUD output
   */
  updateRoomMap(character, mudOutput) {
    // Simple room detection - look for room names and exits
    const lines = mudOutput.split("\n");
    let roomName = null;
    let exits = [];

    // Try to find room name - typically the first standalone line after movement
    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].trim();
      
      // Skip empty lines and movement messages
      if (!cleanLine || 
          cleanLine.includes("walk") || 
          cleanLine.includes("move") ||
          cleanLine.includes("H ") && cleanLine.includes("V ")) {
        continue;
      }
      
      // Look for a line that looks like a room name (short, no special formatting)
      if (cleanLine.length > 3 && cleanLine.length < 80 && 
          !cleanLine.includes("Exits:") && 
          !cleanLine.includes("You are") &&
          !cleanLine.includes("This is")) {
        roomName = cleanLine;
        break;
      }
    }

    // Extract exits from status line or exit lines
    const exitMatch = mudOutput.match(/Exits:([NSEWUD,\s]+)/);
    if (exitMatch) {
      // Extract individual direction letters, removing commas and spaces
      exits = exitMatch[1].replace(/[,\s]/g, "").split("").filter(exit => "NSEWUD".includes(exit));
    }

    // If we found room information, update the map
    if (roomName) {
      // Generate a simple room ID based on room name
      const roomId = roomName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      
      if (!character.roomMap[roomId]) {
        character.roomMap[roomId] = {
          name: roomName,
          exits: exits,
          visited_count: 1,
          first_visit: new Date().toISOString()
        };
      } else {
        character.roomMap[roomId].visited_count++;
        character.roomMap[roomId].exits = exits; // Update exits in case they changed
      }

      character.currentRoomId = roomId;
      character.location = roomName; // Update location for backward compatibility
    }
  }

  /**
   * Record a memorable path between locations
   */
  recordPath(characterId, fromLocation, toLocation, directions) {
    const character = this.characters[characterId];
    if (!character) return false;

    if (!character.pathMemory) character.pathMemory = [];

    const path = {
      from: fromLocation,
      to: toLocation,
      directions: directions,
      recorded: new Date().toISOString()
    };

    // Remove any existing path between these locations
    character.pathMemory = character.pathMemory.filter(
      p => !(p.from === fromLocation && p.to === toLocation)
    );

    character.pathMemory.push(path);

    // Keep only last 20 paths to prevent excessive memory usage
    if (character.pathMemory.length > 20) {
      character.pathMemory = character.pathMemory.slice(-20);
    }

    this.saveCharacters();
    return true;
  }
}

module.exports = CharacterManager;