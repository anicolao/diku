/**
 * Action Executor - Executes AI decisions as MUD commands
 * This is a basic implementation that will be expanded
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class ActionExecutor extends EventEmitter {
  constructor(behaviorConfig) {
    super();
    
    this.behaviorConfig = behaviorConfig;
    this.logger = logger.child({ component: 'ActionExecutor' });
    
    // Command queue and throttling
    this.commandQueue = [];
    this.isExecuting = false;
    this.lastExecutionTime = null;
    this.commandDelay = behaviorConfig.commandDelayMs || 1000;
    
    // Direction mapping for exploration
    this.directions = ['north', 'south', 'east', 'west', 'up', 'down'];
    this.lastDirection = null;
  }

  /**
   * Execute an AI decision
   */
  async execute(action, connection) {
    try {
      this.logger.debug(`Executing action: ${action}`);
      
      // Convert action to MUD command(s)
      const commands = this.actionToCommands(action);
      
      if (commands.length === 0) {
        this.logger.warn(`No commands generated for action: ${action}`);
        return;
      }

      // Add commands to queue
      for (const command of commands) {
        this.commandQueue.push(command);
      }

      // Process queue if not already processing
      if (!this.isExecuting) {
        this.processCommandQueue(connection);
      }
      
    } catch (error) {
      this.logger.error('Error executing action:', error);
      throw error;
    }
  }

  /**
   * Convert action to MUD commands
   */
  actionToCommands(action) {
    const commands = [];

    switch (action.toLowerCase()) {
      case 'explore':
        commands.push(this.getExploreCommand());
        break;
        
      case 'look':
        commands.push('look');
        break;
        
      case 'rest':
        commands.push('rest');
        break;
        
      case 'inventory':
        commands.push('inventory');
        break;
        
      case 'wait':
        // No command needed, just wait
        break;
        
      case 'flee':
        commands.push('flee');
        break;
        
      case 'attack':
        // In a full implementation, this would identify targets
        // For now, just attack the first available target
        commands.push('kill'); // Generic attack command
        break;
        
      case 'cast':
        // In a full implementation, this would choose appropriate spells
        commands.push('cast heal'); // Basic healing spell
        break;
        
      case 'get':
        commands.push('get all');
        break;
        
      case 'quit':
        commands.push('quit');
        break;
        
      default:
        this.logger.warn(`Unknown action: ${action}`);
    }

    return commands;
  }

  /**
   * Get exploration command (choose direction to move)
   */
  getExploreCommand() {
    // Simple exploration strategy: try different directions
    // In a full implementation, this would use world map data
    
    const availableDirections = [...this.directions];
    
    // Try not to immediately reverse direction
    if (this.lastDirection) {
      const opposite = this.getOppositeDirection(this.lastDirection);
      const oppositeIndex = availableDirections.indexOf(opposite);
      if (oppositeIndex > -1) {
        availableDirections.splice(oppositeIndex, 1);
        availableDirections.push(opposite); // Put it at the end
      }
    }

    // Choose a direction based on exploration preference
    const direction = availableDirections[0]; // For now, just take first available
    this.lastDirection = direction;
    
    return direction;
  }

  /**
   * Get opposite direction for movement
   */
  getOppositeDirection(direction) {
    const opposites = {
      'north': 'south',
      'south': 'north',
      'east': 'west',
      'west': 'east',
      'up': 'down',
      'down': 'up'
    };
    
    return opposites[direction] || null;
  }

  /**
   * Process the command queue
   */
  async processCommandQueue(connection) {
    if (this.isExecuting || this.commandQueue.length === 0) {
      return;
    }

    this.isExecuting = true;

    try {
      while (this.commandQueue.length > 0) {
        // Throttle commands
        if (this.lastExecutionTime) {
          const timeSinceLastCommand = Date.now() - this.lastExecutionTime;
          if (timeSinceLastCommand < this.commandDelay) {
            const waitTime = this.commandDelay - timeSinceLastCommand;
            await this.sleep(waitTime);
          }
        }

        const command = this.commandQueue.shift();
        
        if (command && connection) {
          await connection.send(command);
          this.lastExecutionTime = Date.now();
          
          this.logger.info(`Executed command: ${command}`);
          this.emit('commandExecuted', command);
        }
      }
    } catch (error) {
      this.logger.error('Error processing command queue:', error);
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Get current queue length
   */
  getQueueLength() {
    return this.commandQueue.length;
  }

  /**
   * Clear the command queue
   */
  clearQueue() {
    this.commandQueue = [];
    this.logger.info('Command queue cleared');
  }

  /**
   * Add emergency command (bypasses queue)
   */
  async executeImmediate(command, connection) {
    try {
      if (connection) {
        await connection.send(command);
        this.logger.info(`Executed immediate command: ${command}`);
        this.emit('immediateCommandExecuted', command);
      }
    } catch (error) {
      this.logger.error('Error executing immediate command:', error);
      throw error;
    }
  }

  /**
   * Check if executor is busy
   */
  isBusy() {
    return this.isExecuting || this.commandQueue.length > 0;
  }

  /**
   * Get executor statistics
   */
  getStats() {
    return {
      queueLength: this.commandQueue.length,
      isExecuting: this.isExecuting,
      lastExecutionTime: this.lastExecutionTime,
      commandDelay: this.commandDelay
    };
  }

  /**
   * Sleep utility function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate command before execution
   */
  validateCommand(command) {
    if (!command || typeof command !== 'string') {
      return false;
    }

    // Basic validation - no dangerous commands
    const dangerousCommands = ['delete', 'rm', 'format'];
    const lowerCommand = command.toLowerCase();
    
    return !dangerousCommands.some(dangerous => lowerCommand.includes(dangerous));
  }

  /**
   * Set command delay
   */
  setCommandDelay(delayMs) {
    this.commandDelay = Math.max(delayMs, 100); // Minimum 100ms delay
    this.logger.info(`Command delay set to ${this.commandDelay}ms`);
  }

  /**
   * Get pending commands
   */
  getPendingCommands() {
    return [...this.commandQueue];
  }
}

module.exports = ActionExecutor;