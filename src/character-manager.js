/**
 * Character Manager
 * Handles character persistence and memory management for the Diku MUD AI Player
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Simple UUID v4 generator using crypto
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = crypto.randomBytes(1)[0] % 16;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class CharacterManager {
  constructor(config) {
    this.config = config;
    this.dataFile = path.resolve(config.characters?.dataFile || 'characters.json');
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
        const data = fs.readFileSync(this.dataFile, 'utf8');
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

      fs.writeFileSync(this.dataFile, JSON.stringify(this.characters, null, 2), 'utf8');
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
      class: char.class || 'unknown',
      race: char.race || 'unknown'
    }));
  }

  /**
   * Get character by ID
   */
  getCharacter(characterId) {
    return this.characters[characterId] || null;
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
      if (!characterData.name || typeof characterData.name !== 'string') {
        return { error: 'Character name is required and must be a string' };
      }

      // Create character with UUID
      const character = {
        characterId: generateUUID(),
        name: characterData.name,
        password: characterData.password || '',
        class: characterData.class || 'warrior',
        race: characterData.race || 'human',
        level: characterData.level || 1,
        location: characterData.location || 'starting area',
        keyMemories: [],
        createdAt: new Date().toISOString(),
        lastPlayed: new Date().toISOString()
      };

      // Save character
      this.characters[character.characterId] = character;
      if (this.saveCharacters()) {
        return { success: true, character };
      } else {
        return { error: 'Failed to save character data' };
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
        return { error: 'Character not found' };
      }

      const memoryData = JSON.parse(match[1].trim());
      
      // Validate memory data
      if (!memoryData.summary || typeof memoryData.summary !== 'string') {
        return { error: 'Memory summary is required and must be a string' };
      }

      // Validate memory type
      const validTypes = ['level_up', 'social', 'combat', 'exploration', 'quest'];
      if (memoryData.type && !validTypes.includes(memoryData.type)) {
        return { error: `Invalid memory type. Must be one of: ${validTypes.join(', ')}` };
      }

      // Add memory to character
      const memory = {
        summary: memoryData.summary,
        type: memoryData.type || 'exploration',
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
        return { error: 'Failed to save memory data' };
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
      .join('\n');

    return {
      name: character.name,
      password: character.password,
      class: character.class,
      race: character.race,
      level: character.level,
      location: character.location,
      memories: recentMemories
    };
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
          responses.push('OK - Memory recorded');
        } else {
          responses.push(`ERROR - ${memoryResult.error}`);
        }
      }
    }

    return responses;
  }
}

module.exports = CharacterManager;