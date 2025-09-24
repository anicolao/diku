/**
 * Game State Manager - Maintains current game state
 * This is a basic implementation that will be expanded
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class GameState extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = config;
    this.logger = logger.child({ component: 'GameState' });
    
    // Initialize default state
    this.state = {
      player: {
        name: null,
        level: 1,
        health: { current: 100, max: 100 },
        mana: { current: 100, max: 100 },
        moves: { current: 100, max: 100 },
        position: { x: 0, y: 0, z: 0 }
      },
      room: {
        name: null,
        description: null,
        exits: [],
        objects: [],
        characters: []
      },
      combat: {
        inCombat: false,
        target: null,
        enemies: []
      },
      inventory: [],
      objectives: [],
      world: {
        rooms: new Map(),
        connections: new Map()
      },
      session: {
        startTime: new Date(),
        commandCount: 0,
        roomsVisited: 0
      }
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the state manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing game state manager...');
      
      // In a full implementation, this would:
      // - Connect to SQLite database
      // - Load saved state if available
      // - Initialize world map data structures
      
      this.initialized = true;
      this.logger.info('Game state manager initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize game state manager:', error);
      throw error;
    }
  }

  /**
   * Update state from parsed MUD output
   */
  async updateFromParsedOutput(parsedData) {
    try {
      switch (parsedData.type) {
        case 'prompt':
          this.updatePlayerStats({
            health: { current: parsedData.health, max: this.state.player.health.max },
            mana: { current: parsedData.mana, max: this.state.player.mana.max },
            moves: { current: parsedData.moves, max: this.state.player.moves.max }
          });
          break;
          
        case 'room_name':
          this.updateCurrentRoom({ name: parsedData.name });
          break;
          
        case 'combat':
          this.updateCombatState(parsedData);
          break;
          
        case 'movement':
          this.handleMovementResult(parsedData);
          break;
          
        default:
          // Generic message handling
          this.logger.debug('Unhandled parsed data type:', parsedData.type);
      }
      
    } catch (error) {
      this.logger.error('Error updating state from parsed output:', error);
    }
  }

  /**
   * Update player statistics
   */
  updatePlayerStats(newStats) {
    const oldStats = { ...this.state.player };
    
    if (newStats.health) {
      this.state.player.health = newStats.health;
    }
    if (newStats.mana) {
      this.state.player.mana = newStats.mana;
    }
    if (newStats.moves) {
      this.state.player.moves = newStats.moves;
    }

    this.emit('stateChange', 'player', this.state.player);
    this.logger.debug('Player stats updated', { oldStats, newStats });
  }

  /**
   * Update current room information
   */
  updateCurrentRoom(roomData) {
    const oldRoom = { ...this.state.room };
    
    if (roomData.name && roomData.name !== this.state.room.name) {
      this.state.room.name = roomData.name;
      this.state.session.roomsVisited++;
      
      // In full implementation, update world map here
      this.logger.info(`Entered room: ${roomData.name}`);
    }
    
    if (roomData.description) {
      this.state.room.description = roomData.description;
    }
    
    if (roomData.exits) {
      this.state.room.exits = roomData.exits;
    }
    
    if (roomData.objects) {
      this.state.room.objects = roomData.objects;
    }
    
    if (roomData.characters) {
      this.state.room.characters = roomData.characters;
    }

    this.emit('stateChange', 'room', this.state.room);
  }

  /**
   * Update combat state
   */
  updateCombatState(combatData) {
    const wasInCombat = this.state.combat.inCombat;
    
    switch (combatData.subtype) {
      case 'damage':
        this.state.combat.inCombat = true;
        break;
        
      case 'end':
        this.state.combat.inCombat = false;
        this.state.combat.target = null;
        this.state.combat.enemies = [];
        break;
    }
    
    if (wasInCombat !== this.state.combat.inCombat) {
      this.logger.info(`Combat state changed: ${this.state.combat.inCombat ? 'entered' : 'left'} combat`);
      this.emit('stateChange', 'combat', this.state.combat);
    }
  }

  /**
   * Handle movement result
   */
  handleMovementResult(movementData) {
    if (movementData.subtype === 'failed') {
      this.logger.debug('Movement failed:', movementData.reason);
      // In full implementation, update world map with blocked paths
    }
  }

  /**
   * Get current game state
   */
  getCurrentState() {
    return JSON.parse(JSON.stringify(this.state)); // Deep copy
  }

  /**
   * Get player health percentage
   */
  getHealthPercentage() {
    return this.state.player.health.current / this.state.player.health.max;
  }

  /**
   * Get player mana percentage
   */
  getManaPercentage() {
    return this.state.player.mana.current / this.state.player.mana.max;
  }

  /**
   * Check if player needs healing
   */
  needsHealing(threshold = 0.5) {
    return this.getHealthPercentage() < threshold;
  }

  /**
   * Check if player needs mana
   */
  needsMana(threshold = 0.3) {
    return this.getManaPercentage() < threshold;
  }

  /**
   * Get available exits from current room
   */
  getAvailableExits() {
    return [...this.state.room.exits];
  }

  /**
   * Check if currently in combat
   */
  isInCombat() {
    return this.state.combat.inCombat;
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const now = new Date();
    const uptime = now.getTime() - this.state.session.startTime.getTime();
    
    return {
      uptime,
      commandCount: this.state.session.commandCount,
      roomsVisited: this.state.session.roomsVisited,
      startTime: this.state.session.startTime
    };
  }

  /**
   * Increment command counter
   */
  incrementCommandCount() {
    this.state.session.commandCount++;
  }

  /**
   * Get contextual information for AI decision making
   */
  getContextForAI() {
    const context = {
      player: this.state.player,
      room: {
        name: this.state.room.name,
        exits: this.state.room.exits,
        hasObjects: this.state.room.objects.length > 0,
        hasCharacters: this.state.room.characters.length > 0
      },
      combat: this.state.combat,
      health: {
        percentage: this.getHealthPercentage(),
        needsHealing: this.needsHealing()
      },
      mana: {
        percentage: this.getManaPercentage(),
        needsMana: this.needsMana()
      },
      session: this.getSessionStats()
    };

    return context;
  }
}

module.exports = GameState;