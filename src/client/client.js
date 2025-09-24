/**
 * Main MUD Client class
 * Orchestrates all components of the AI MUD player
 */

const EventEmitter = require('events');
const TelnetConnection = require('./connection');
const OutputParser = require('../parser/outputParser');
const StateManager = require('../state/gameState');
const AIEngine = require('../ai/decisionEngine');
const ActionExecutor = require('../executor/executor');
const logger = require('../utils/logger');

class MudClient extends EventEmitter {
  constructor(config, options = {}) {
    super();
    
    this.config = config;
    this.options = options;
    this.logger = logger.child({ component: 'MudClient' });
    
    // Component instances
    this.connection = null;
    this.parser = null;
    this.stateManager = null;
    this.aiEngine = null;
    this.executor = null;
    
    // Client state
    this.isInitialized = false;
    this.isConnected = false;
    this.isRunning = false;
    
    // Statistics
    this.stats = {
      startTime: null,
      commandsSent: 0,
      messagesReceived: 0,
      decisionsRequested: 0,
      reconnectAttempts: 0
    };
  }

  /**
   * Initialize all components
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('Client already initialized');
      return;
    }

    try {
      this.logger.info('Initializing MUD client components...');

      // Initialize connection
      this.connection = new TelnetConnection(this.config.mud);
      
      // Initialize parser
      this.parser = new OutputParser(this.config.parser || {});
      
      // Initialize state manager
      this.stateManager = new StateManager(this.config.database);
      await this.stateManager.initialize();
      
      // Initialize AI engine
      this.aiEngine = new AIEngine(this.config.ollama, this.config.behavior);
      await this.aiEngine.initialize();
      
      // Initialize action executor
      this.executor = new ActionExecutor(this.config.behavior);

      // Set up event handlers
      this.setupEventHandlers();
      
      this.isInitialized = true;
      this.stats.startTime = new Date();
      
      this.logger.info('MUD client initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize MUD client:', error);
      throw error;
    }
  }

  /**
   * Connect to the MUD server
   */
  async connect() {
    if (!this.isInitialized) {
      throw new Error('Client must be initialized before connecting');
    }

    if (this.isConnected) {
      this.logger.warn('Client already connected');
      return;
    }

    if (this.options.dryRun) {
      this.logger.info('DRY RUN: Simulating MUD connection');
      this.isConnected = true;
      this.isRunning = true;
      this.emit('connected');
      return;
    }

    try {
      this.logger.info(`Connecting to ${this.config.mud.host}:${this.config.mud.port}`);
      
      await this.connection.connect();
      this.isConnected = true;
      this.isRunning = true;
      
      this.logger.info('Connected to MUD successfully');
      this.emit('connected');
      
      // Start the main game loop
      this.startGameLoop();
      
    } catch (error) {
      this.logger.error('Failed to connect to MUD:', error);
      this.emit('connectionError', error);
      throw error;
    }
  }

  /**
   * Disconnect from the MUD server
   */
  async disconnect() {
    if (!this.isConnected) {
      this.logger.debug('Client not connected, nothing to disconnect');
      return;
    }

    try {
      this.logger.info('Disconnecting from MUD...');
      
      this.isRunning = false;
      
      if (this.connection && !this.options.dryRun) {
        await this.connection.disconnect();
      }
      
      this.isConnected = false;
      
      this.logger.info('Disconnected from MUD');
      this.emit('disconnected');
      
    } catch (error) {
      this.logger.error('Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers for all components
   */
  setupEventHandlers() {
    // Connection events
    if (this.connection) {
      this.connection.on('data', (data) => {
        this.handleMudOutput(data);
      });
      
      this.connection.on('close', () => {
        this.logger.warn('MUD connection closed');
        this.handleConnectionLost();
      });
      
      this.connection.on('error', (error) => {
        this.logger.error('Connection error:', error);
        this.emit('connectionError', error);
      });
    }

    // State manager events
    if (this.stateManager) {
      this.stateManager.on('stateChange', (component, newState) => {
        this.logger.logStateChange(component, null, newState);
        this.emit('stateChange', component, newState);
      });
    }

    // AI engine events
    if (this.aiEngine) {
      this.aiEngine.on('decision', (decision) => {
        this.logger.logAIDecision(decision.action, decision.reasoning);
        this.handleAIDecision(decision);
      });
      
      this.aiEngine.on('error', (error) => {
        this.logger.error('AI engine error:', error);
        this.emit('aiError', error);
      });
    }
  }

  /**
   * Handle incoming data from MUD
   */
  async handleMudOutput(data) {
    try {
      this.stats.messagesReceived++;
      this.logger.logMudCommunication('received', data);
      
      // Parse the output
      const parsedOutput = await this.parser.parse(data.toString());
      
      if (parsedOutput.length > 0) {
        // Update game state
        for (const parsed of parsedOutput) {
          await this.stateManager.updateFromParsedOutput(parsed);
        }
        
        // Request AI decision if needed
        if (this.shouldRequestDecision()) {
          this.requestAIDecision();
        }
      }
      
    } catch (error) {
      this.logger.error('Error handling MUD output:', error);
    }
  }

  /**
   * Handle AI decision
   */
  async handleAIDecision(decision) {
    try {
      if (decision.action && decision.action !== 'wait') {
        await this.executor.execute(decision.action, this.connection);
        this.stats.commandsSent++;
      }
    } catch (error) {
      this.logger.error('Error executing AI decision:', error);
    }
  }

  /**
   * Request a decision from the AI engine
   */
  async requestAIDecision() {
    try {
      this.stats.decisionsRequested++;
      
      const currentState = this.stateManager.getCurrentState();
      await this.aiEngine.makeDecision(currentState);
      
    } catch (error) {
      this.logger.error('Error requesting AI decision:', error);
    }
  }

  /**
   * Determine if we should request a new AI decision
   */
  shouldRequestDecision() {
    const state = this.stateManager.getCurrentState();
    
    // Always request decision if we're not in combat and have no pending commands
    if (!state.combat.inCombat && this.executor.getQueueLength() === 0) {
      return true;
    }
    
    // Request decision in combat if we don't have immediate actions queued
    if (state.combat.inCombat && this.executor.getQueueLength() < 2) {
      return true;
    }
    
    return false;
  }

  /**
   * Handle connection loss and attempt reconnection
   */
  async handleConnectionLost() {
    if (!this.isRunning) {
      return; // Intentional disconnect
    }

    this.isConnected = false;
    this.stats.reconnectAttempts++;
    
    if (this.stats.reconnectAttempts < this.config.mud.maxReconnectAttempts) {
      this.logger.info(`Attempting to reconnect (${this.stats.reconnectAttempts}/${this.config.mud.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch((error) => {
          this.logger.error('Reconnection failed:', error);
        });
      }, this.config.mud.reconnectDelay);
      
    } else {
      this.logger.error('Max reconnection attempts reached, giving up');
      this.isRunning = false;
      this.emit('maxReconnectAttemptsReached');
    }
  }

  /**
   * Start the main game loop
   */
  startGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
    }

    // Run game loop every 5 seconds
    this.gameLoopInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(this.gameLoopInterval);
        return;
      }

      this.gameLoopTick();
    }, 5000);
  }

  /**
   * Game loop tick - periodic maintenance and decision making
   */
  async gameLoopTick() {
    try {
      // Log periodic metrics
      this.logger.logMetrics({
        commandsSent: this.stats.commandsSent,
        messagesReceived: this.stats.messagesReceived,
        decisionsRequested: this.stats.decisionsRequested,
        uptime: Date.now() - this.stats.startTime.getTime(),
        queueLength: this.executor.getQueueLength()
      });

      // Check if we need to make a decision
      if (this.shouldRequestDecision()) {
        this.requestAIDecision();
      }

    } catch (error) {
      this.logger.error('Error in game loop tick:', error);
    }
  }

  /**
   * Get current client statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0,
      isConnected: this.isConnected,
      isRunning: this.isRunning
    };
  }
}

module.exports = MudClient;