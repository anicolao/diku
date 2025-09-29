/**
 * Character Manager
 * Handles character persistence and memory management for the Diku MUD AI Player
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Simple UUID v4 generator using crypto
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = crypto.randomBytes(1)[0] % 16;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class CharacterManager {
  constructor(config, debugCallback = null) {
    this.config = config;
    this.dataFile = path.resolve(
      config.characters?.dataFile || "characters.json",
    );
    this.backupOnSave = config.characters?.backupOnSave ?? true;
    this.characters = {};
    this.debug = debugCallback || (() => {}); // Default to no-op if no callback provided

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
          parsed.forEach((char) => {
            if (char.characterId) {
              this.characters[char.characterId] = char;
            }
          });
        } else {
          this.characters = parsed;
        }
      }
    } catch (error) {
      this.debug(
        `Warning: Could not load characters from ${this.dataFile}: ${error.message}`,
      );
      this.characters = {};
    }
  }

  /**
   * Rotate backup files (.1, .2, .3, ..., .9)
   * .1 is the latest backup, .9 is the oldest and gets discarded
   */
  rotateBackups() {
    try {
      // Remove .9 backup if it exists (oldest backup gets discarded)
      const backup9 = `${this.dataFile}.9`;
      if (fs.existsSync(backup9)) {
        fs.unlinkSync(backup9);
      }

      // Shift all backups up by one (.8 -> .9, .7 -> .8, ..., .1 -> .2)
      for (let i = 8; i >= 1; i--) {
        const currentBackup = `${this.dataFile}.${i}`;
        const nextBackup = `${this.dataFile}.${i + 1}`;
        
        if (fs.existsSync(currentBackup)) {
          fs.renameSync(currentBackup, nextBackup);
        }
      }
    } catch (error) {
      this.debug(
        `Warning: Failed to rotate backups for ${this.dataFile}: ${error.message}`,
      );
      // Continue with save even if backup rotation fails
    }
  }

  /**
   * Save characters to storage file
   */
  saveCharacters() {
    try {
      if (this.backupOnSave && fs.existsSync(this.dataFile)) {
        // Rotate existing backups
        this.rotateBackups();
        
        // Create new .1 backup (latest backup)
        const backupFile = `${this.dataFile}.1`;
        fs.copyFileSync(this.dataFile, backupFile);
      }

      fs.writeFileSync(
        this.dataFile,
        JSON.stringify(this.characters, null, 2),
        "utf8",
      );
      return true;
    } catch (error) {
      this.debug(
        `Error saving characters to ${this.dataFile}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get all characters for menu display
   */
  getCharactersList() {
    return Object.values(this.characters).map((char) => ({
      id: char.characterId,
      name: char.name,
      level: char.level || 1,
      class: char.class || "unknown",
      race: char.race || "unknown",
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
      const match = llmResponse.match(
        /<new-character>\s*([\s\S]*?)\s*<\/new-character>/i,
      );
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
        roomMap: {}, // Map of room_id -> { name, description, exits, visited_count }
        movementHistory: [], // Recent movement commands and results
        pathMemory: [], // Memorable paths between important locations
        currentRoomId: null, // Current room identifier
        createdAt: new Date().toISOString(),
        lastPlayed: new Date().toISOString(),
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
      const match = llmResponse.match(
        /<record-memory>\s*([\s\S]*?)\s*<\/record-memory>/i,
      );
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
      const validTypes = [
        "level_up",
        "social",
        "combat",
        "exploration",
        "quest",
        "pathfinding",
      ];
      if (memoryData.type && !validTypes.includes(memoryData.type)) {
        return {
          error: `Invalid memory type. Must be one of: ${validTypes.join(", ")}`,
        };
      }

      // Add memory to character
      const memory = {
        summary: memoryData.summary,
        type: memoryData.type || "exploration",
        details: memoryData.details || {},
        timestamp: new Date().toISOString(),
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
      .map((memory) => `- ${memory.summary}`)
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
      navigation: navigationContext,
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
        .slice(-3) // Last 3 movements
        .map((move) => `${move.direction} -> ${move.result}`)
        .join("; ");
      context.push(`Recent movements: ${recentMoves}`);
    }

    // Add known paths to important locations
    if (character.pathMemory && character.pathMemory.length > 0) {
      const paths = character.pathMemory
        .slice(-3) // Most recent paths
        .map(
          (path) => `${path.from} to ${path.to}: ${path.directions.join(" ")}`,
        )
        .join("; ");
      context.push(`Known paths: ${paths}`);
    }

    // Add room exploration summary
    const roomCount = Object.keys(character.roomMap || {}).length;
    if (roomCount > 0) {
      context.push(`Explored ${roomCount} rooms`);
    }

    return context.length > 0
      ? context.join("\n")
      : "No navigation data available";
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
        responses.push(
          `OK - Character recorded: ${newCharResult.character.name}`,
        );
        // If we just created a character, use its ID for any memory recording in the same response
        characterIdForMemory = newCharResult.character.characterId;
      } else {
        responses.push(`ERROR - ${newCharResult.error}`);
      }
    }

    // Check for memory recording (if we have a character to record for)
    if (characterIdForMemory) {
      const memoryResult = this.parseRecordMemory(
        llmResponse,
        characterIdForMemory,
      );
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
      mudOutput: mudOutput.substring(0, 200), // Store first 200 chars for context
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
   * Get opposite direction for pathfinding
   */
  getOppositeDirection(direction) {
    const opposites = {
      N: "S",
      S: "N",
      E: "W",
      W: "E",
      U: "D",
      D: "U",
    };
    return opposites[direction] || null;
  }

  /**
   * Normalize text by splitting on whitespace and replacing each block with single underscore
   */
  normalizeTextForId(text) {
    if (!text) return "";
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => /[a-z0-9]/.test(word))
      .join("_");
  }

  /**
   * Generate enhanced room ID from room name, first sentence of description, and exits
   */
  generateRoomId(roomName, firstSentence, exits) {
    const titlePart = this.normalizeTextForId(roomName);
    const sentencePart = this.normalizeTextForId(firstSentence);
    
    // Create exits abbreviation by sorting exits and removing door indicators
    const exitsAbbrev = [...exits].sort().join("").replace(/[()]/g, "");
    
    return [titlePart, sentencePart, exitsAbbrev].filter(part => part).join("_");
  }

  /**
   * Update room map based on MUD output
   */
  updateRoomMap(character, mudOutput) {
    // Simple room detection - look for room names and exits
    const lines = mudOutput.split("\n");
    let roomName = null;
    let roomFirstSentence = null;
    let exits = [];
    let exitConnections = {}; // Store connections from exits command

    // Try to find room name - typically the first standalone line after movement
    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].trim();

      // Skip empty lines and movement messages
      if (
        !cleanLine ||
        cleanLine.includes("walk") ||
        cleanLine.includes("move") ||
        cleanLine.includes("climb") ||
        (cleanLine.includes("H ") && cleanLine.includes("V ")) ||
        cleanLine.startsWith("You ")
      ) {
        continue;
      }

      // Look for a line that looks like a room name (short, no special formatting)
      if (
        cleanLine.length > 3 &&
        cleanLine.length < 80 &&
        !cleanLine.includes("Exits:") &&
        !cleanLine.includes("Obvious exits:") &&
        !cleanLine.includes("You are") &&
        !cleanLine.includes("arrives") &&
        !cleanLine.includes("This is") &&
        !cleanLine.includes(" - ") && // Skip exit listing lines
        !cleanLine.includes("    ") && // Skip description lines that start with indentation
        !cleanLine.includes(".") // Skip sentences/descriptions
      ) {
        roomName = cleanLine;
        
        // Look for first sentence in subsequent lines - collect all text until first period
        let accumulatedText = "";
        for (let j = i + 1; j < lines.length; j++) {
          const descLine = lines[j].trim();
          
          // Skip empty lines
          if (!descLine) continue;
          
          // Stop if we hit the status line
          if (descLine.includes("H ") && descLine.includes("V ")) break;
          
          // Stop if we hit "Obvious exits:" 
          if (descLine.includes("Obvious exits:")) break;
          
          // Skip command prompts (like "> exits")
          if (descLine.includes(">")) continue;
          
          // Accumulate text and check for period
          accumulatedText += (accumulatedText ? " " : "") + descLine;
          
          // Check if we found the end of the first sentence
          const periodIndex = accumulatedText.indexOf(".");
          if (periodIndex !== -1) {
            roomFirstSentence = accumulatedText.substring(0, periodIndex).trim();
            break;
          }
        }
        
        // If no period found but we have accumulated text, use it
        if (!roomFirstSentence && accumulatedText && accumulatedText.length > 10) {
          roomFirstSentence = accumulatedText.trim();
        }
        break;
      }
    }

    // First try to parse "Obvious exits:" format (from exits command)
    const obviousExitsMatch = mudOutput.match(/Obvious exits:\s*\n(.*?)(?:\n\n|\n$|$)/s);
    if (obviousExitsMatch) {
      const exitLines = obviousExitsMatch[1].split("\n");
      for (const line of exitLines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        
        // Parse format like: "North - On a Vallenwood Bough"
        const exitMatch = cleanLine.match(/^(North|South|East|West|Up|Down)\s*-\s*(.+)$/);
        if (exitMatch) {
          const direction = exitMatch[1];
          const destinationName = exitMatch[2].trim();
          
          // Convert full direction name to single letter
          const directionMap = {
            "North": "N",
            "South": "S", 
            "East": "E",
            "West": "W",
            "Up": "U",
            "Down": "D"
          };
          
          const shortDir = directionMap[direction];
          if (shortDir) {
            exits.push(shortDir);
            
            // Skip creating connections for dark rooms - handle them with fallback movement tracking
            if (destinationName !== "Too dark to tell") {
              // Generate destination room ID from name (simplified, no description/exits available)
              const destinationId = destinationName.toLowerCase().replace(/[^a-z0-9]/g, "_");
              exitConnections[shortDir] = {
                roomId: destinationId,
                roomName: destinationName
              };
            }
          }
        }
      }
    } else {
      // Fallback: Extract exits from status line
      const exitMatch = mudOutput.match(/Exits:([NSEWUD(),\s]+)/);
      if (exitMatch) {
        // Extract individual direction letters, removing commas, spaces, and door indicators
        const exitStr = exitMatch[1].replace(/[(),\s]/g, "");
        exits = exitStr
          .split("")
          .filter((exit) => "NSEWUD".includes(exit));
      }
    }

    // If we found room information, update the map
    if (roomName) {
      // Generate enhanced room ID using room name, first sentence, and exits
      const roomId = this.generateRoomId(roomName, roomFirstSentence, exits);

      // Check if this is a new room
      const isNewRoom = !character.roomMap[roomId];

      if (isNewRoom) {
        this.debug(`🗺️  DEBUG: New room encountered: "${roomName}" (ID: ${roomId})`);
        character.roomMap[roomId] = {
          name: roomName,
          exits: exits,
          connections: {}, // Track actual connections to other rooms
          visited_count: 1,
          first_visit: new Date().toISOString(),
        };
      } else {
        character.roomMap[roomId].visited_count++;
        character.roomMap[roomId].exits = exits; // Update exits in case they changed
      }

      // Update connections based on exits command output (preferred method)
      if (Object.keys(exitConnections).length > 0) {
        if (!character.roomMap[roomId].connections) {
          character.roomMap[roomId].connections = {};
        }
        
        for (const [direction, connectionInfo] of Object.entries(exitConnections)) {
          character.roomMap[roomId].connections[direction] = connectionInfo.roomId;
          
          // Create or update the destination room entry if we have the name
          if (!character.roomMap[connectionInfo.roomId]) {
            character.roomMap[connectionInfo.roomId] = {
              name: connectionInfo.roomName,
              exits: [],
              connections: {},
              visited_count: 0, // Not actually visited yet
              first_seen: new Date().toISOString(),
            };
          }
          
          // Set up bidirectional connection
          if (!character.roomMap[connectionInfo.roomId].connections) {
            character.roomMap[connectionInfo.roomId].connections = {};
          }
          const oppositeDir = this.getOppositeDirection(direction);
          if (oppositeDir) {
            character.roomMap[connectionInfo.roomId].connections[oppositeDir] = roomId;
          }
        }
      } else {
        // Fallback: Create basic connections based on successful movement (deprecated, but for backward compatibility)
        if (character.currentRoomId && character.currentRoomId !== roomId && character.movementHistory.length > 0) {
          const lastMove = character.movementHistory[character.movementHistory.length - 1];
          if (lastMove.result === "success") {
            const prevRoom = character.roomMap[character.currentRoomId];
            if (prevRoom) {
              if (!prevRoom.connections) prevRoom.connections = {};
              if (!character.roomMap[roomId].connections) character.roomMap[roomId].connections = {};
              
              prevRoom.connections[lastMove.direction] = roomId;
              const oppositeDir = this.getOppositeDirection(lastMove.direction);
              if (oppositeDir) {
                character.roomMap[roomId].connections[oppositeDir] = character.currentRoomId;
              }
            }
          }
        }
      }

      // Check if we need to correct a previous room's name based on where we came from
      if (character.currentRoomId && character.currentRoomId !== roomId && character.movementHistory.length > 0) {
        const lastMove = character.movementHistory[character.movementHistory.length - 1];
        if (lastMove.result === "success") {
          // Check if the previous room has the current room listed as a connection in the direction we moved
          const prevRoom = character.roomMap[character.currentRoomId];
          if (prevRoom && prevRoom.connections && prevRoom.connections[lastMove.direction]) {
            const expectedDestination = prevRoom.connections[lastMove.direction];
            const expectedRoom = character.roomMap[expectedDestination];
            
            // Only attempt correction if the expected destination is different from the actual room ID
            if (expectedRoom && expectedRoom.name && expectedDestination !== roomId) {
              // Check if either name contains key words from the other (more flexible matching)
              const currentWords = roomName.toLowerCase().split(/\s+/);
              const expectedWords = expectedRoom.name.toLowerCase().split(/\s+/);
              
              // Look for common significant words (ignore common words like "a", "the", "of")
              const ignoreWords = ["a", "an", "the", "of", "to", "in", "on", "at", "by", "for", "with", "from"];
              const significantExpected = expectedWords.filter(word => 
                word.length > 2 && !ignoreWords.includes(word)
              );
              const significantCurrent = currentWords.filter(word => 
                word.length > 2 && !ignoreWords.includes(word)
              );
              
              // If there's at least one significant word match, consider it a correction
              const hasMatch = significantExpected.some(word => 
                significantCurrent.includes(word)
              );
              
              if (hasMatch) {
                this.debug(`🔧 DEBUG: Room ID corrected from "${expectedDestination}" to "${roomId}" (name match: "${expectedRoom.name}" -> "${roomName}")`);
                
                // Update all connections pointing to the old room ID
                for (const [, otherRoom] of Object.entries(character.roomMap)) {
                  if (otherRoom.connections) {
                    for (const [dir, connectedId] of Object.entries(otherRoom.connections)) {
                      if (connectedId === expectedDestination) {
                        otherRoom.connections[dir] = roomId;
                      }
                    }
                  }
                }
                // Remove the old incorrect room entry
                delete character.roomMap[expectedDestination];
              }
            }
          }
        }
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
      recorded: new Date().toISOString(),
    };

    // Remove any existing path between these locations
    character.pathMemory = character.pathMemory.filter(
      (p) => !(p.from === fromLocation && p.to === toLocation),
    );

    character.pathMemory.push(path);

    // Note: No limit on path memory to allow full exploration tracking

    this.saveCharacters();
    return true;
  }

  /**
   * Find the next step to reach a destination using BFS
   */
  findNextStep(characterId, destination) {
    const character = this.getCharacter(characterId);
    if (!character) {
      return "Error: Character not found.";
    }

    const path = this.findShortestPath(character, destination);
    if (path === null) {
      return `No path found to "${destination}". Make sure you've explored the area and the destination exists.`;
    }

    if (path.length === 0) {
      return `You are already at or very close to "${destination}".`;
    }

    const nextDirection = path[0]; // First direction in path
    return `Next step to reach "${destination}": ${nextDirection}`;
  }

  /**
   * Find the full path to reach a destination using BFS
   */
  findFullPath(characterId, destination) {
    const character = this.getCharacter(characterId);
    if (!character) {
      return "Error: Character not found.";
    }

    const path = this.findShortestPath(character, destination);
    if (path === null) {
      return `No path found to "${destination}". Make sure you've explored the area and the destination exists.`;
    }

    if (path.length === 0) {
      return `You are already at or very close to "${destination}".`;
    }

    return `Full path to "${destination}": ${path.join(" ")} (${path.length} steps)`;
  }

  /**
   * Find shortest path using BFS algorithm
   */
  findShortestPath(character, destination) {
    const roomMap = character.roomMap || {};
    const currentRoomId = character.currentRoomId;

    if (!currentRoomId) {
      return null;
    }

    // Find destination room(s) by partial name match
    const destinationRooms = Object.keys(roomMap).filter((roomId) => {
      const room = roomMap[roomId];
      return (
        room.name && room.name.toLowerCase().includes(destination.toLowerCase())
      );
    });

    if (destinationRooms.length === 0) {
      return null;
    }

    // If current room matches destination, return empty path
    if (destinationRooms.includes(currentRoomId)) {
      return [];
    }

    // BFS to find shortest path to any matching destination
    const queue = [{ roomId: currentRoomId, path: [] }];
    const visited = new Set([currentRoomId]);

    while (queue.length > 0) {
      const { roomId, path } = queue.shift();

      // Add adjacent rooms to queue using actual connections
      const room = roomMap[roomId];
      if (room && room.connections) {
        for (const [direction, connectedRoomId] of Object.entries(
          room.connections,
        )) {
          if (connectedRoomId && !visited.has(connectedRoomId)) {
            const newPath = [...path, direction];

            // Check if this connected room is our destination
            if (destinationRooms.includes(connectedRoomId)) {
              return newPath;
            }

            visited.add(connectedRoomId);
            queue.push({
              roomId: connectedRoomId,
              path: newPath,
            });
          }
        }
      }
    }

    return null; // No path found
  }

  /**
   * Find which room is in a given direction from current room
   */
  findRoomInDirection(fromRoomId, direction, roomMap) {
    const room = roomMap[fromRoomId];
    if (room && room.connections) {
      return room.connections[direction] || null;
    }
    return null;
  }

  /**
   * Find what direction leads from one room to another
   */
  findDirectionToRoom(fromRoom, toRoomId, _roomMap) {
    if (!fromRoom || !fromRoom.connections) return null;

    // Look for direct connection
    for (const [direction, connectedRoomId] of Object.entries(
      fromRoom.connections,
    )) {
      if (connectedRoomId === toRoomId) {
        return direction;
      }
    }

    return null;
  }
}

module.exports = CharacterManager;
