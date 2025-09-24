/**
 * Output Parser - Parses MUD output into structured data
 * This is a basic implementation that will be expanded
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class OutputParser extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = config;
    this.logger = logger.child({ component: 'OutputParser' });
    
    // Compile regex patterns for common MUD elements
    this.patterns = {
      // Basic room detection patterns
      roomName: /^([A-Z][^.!?]*[.!?]?)\s*$/m,
      roomDescription: /^([a-z].*[.!?])\s*$/m,
      
      // Player status patterns
      health: /HP:\s*(\d+)\/(\d+)/i,
      mana: /MP:\s*(\d+)\/(\d+)/i,
      moves: /MV:\s*(\d+)\/(\d+)/i,
      
      // Combat patterns
      combatStart: /You (attack|engage|fight)/i,
      combatDamage: /(\w+) (hits?|misses?) (\w+)/i,
      combatEnd: /(dies?|is dead|flees?)/i,
      
      // Basic prompts
      prompt: /^<?(\d+)hp\s+(\d+)m\s+(\d+)mv>/,
      
      // Common messages
      cantGo: /You can't go that way/i,
      cantSee: /You (can't see|don't see)/i,
      inventory: /You are carrying:/i,
      
      // ANSI escape codes
      ansi: /\x1b\[[0-9;]*m/g
    };
  }

  /**
   * Parse MUD output into structured data
   */
  async parse(rawText) {
    try {
      // Clean ANSI codes
      const cleanText = this.stripAnsiCodes(rawText);
      
      // Split into lines
      const lines = cleanText.split(/\r?\n/).filter(line => line.trim());
      
      const parsedData = [];
      
      for (const line of lines) {
        const parsed = this.parseLine(line);
        if (parsed) {
          parsedData.push(parsed);
        }
      }
      
      return parsedData;
      
    } catch (error) {
      this.logger.error('Error parsing output:', error);
      return [];
    }
  }

  /**
   * Parse a single line of output
   */
  parseLine(line) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      return null;
    }

    // Check for prompt
    const promptMatch = trimmedLine.match(this.patterns.prompt);
    if (promptMatch) {
      return {
        type: 'prompt',
        health: parseInt(promptMatch[1]),
        mana: parseInt(promptMatch[2]),
        moves: parseInt(promptMatch[3]),
        raw: trimmedLine
      };
    }

    // Check for room name (capitalized line)
    const roomMatch = trimmedLine.match(this.patterns.roomName);
    if (roomMatch && trimmedLine.length < 80 && /^[A-Z]/.test(trimmedLine)) {
      return {
        type: 'room_name',
        name: roomMatch[1].trim(),
        raw: trimmedLine
      };
    }

    // Check for combat messages
    if (this.patterns.combatDamage.test(trimmedLine)) {
      return {
        type: 'combat',
        subtype: 'damage',
        raw: trimmedLine
      };
    }

    // Check for movement failures
    if (this.patterns.cantGo.test(trimmedLine)) {
      return {
        type: 'movement',
        subtype: 'failed',
        reason: 'invalid_direction',
        raw: trimmedLine
      };
    }

    // Generic message
    return {
      type: 'message',
      content: trimmedLine,
      raw: trimmedLine
    };
  }

  /**
   * Strip ANSI color codes from text
   */
  stripAnsiCodes(text) {
    return text.replace(this.patterns.ansi, '');
  }

  /**
   * Extract room information from multiple lines
   */
  extractRoomInfo(lines) {
    const roomInfo = {
      name: null,
      description: null,
      exits: [],
      objects: [],
      characters: []
    };

    // This is a simplified implementation
    // A full implementation would be much more sophisticated
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for room name (usually first line)
      if (i === 0 && /^[A-Z]/.test(line)) {
        roomInfo.name = line.trim();
      }
      
      // Look for obvious exits
      if (/exits?:/i.test(line) || /obvious exits?/i.test(line)) {
        const exitMatch = line.match(/\b(north|south|east|west|up|down|northeast|northwest|southeast|southwest)\b/gi);
        if (exitMatch) {
          roomInfo.exits = exitMatch.map(exit => exit.toLowerCase());
        }
      }
    }

    return roomInfo;
  }

  /**
   * Check if text contains a prompt
   */
  containsPrompt(text) {
    return this.patterns.prompt.test(text);
  }

  /**
   * Extract player stats from text
   */
  extractPlayerStats(text) {
    const stats = {};
    
    const healthMatch = text.match(this.patterns.health);
    if (healthMatch) {
      stats.health = {
        current: parseInt(healthMatch[1]),
        max: parseInt(healthMatch[2])
      };
    }

    const manaMatch = text.match(this.patterns.mana);
    if (manaMatch) {
      stats.mana = {
        current: parseInt(manaMatch[1]),
        max: parseInt(manaMatch[2])
      };
    }

    const movesMatch = text.match(this.patterns.moves);
    if (movesMatch) {
      stats.moves = {
        current: parseInt(movesMatch[1]),
        max: parseInt(movesMatch[2])
      };
    }

    return Object.keys(stats).length > 0 ? stats : null;
  }
}

module.exports = OutputParser;