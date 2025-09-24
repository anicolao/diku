/**
 * Configuration management utility
 * Handles loading and merging configuration from multiple sources
 */

const fs = require('fs').promises;
const path = require('path');
const lodash = require('lodash');

class Config {
  constructor() {
    this.config = {};
    this.initialized = false;
  }

  /**
   * Initialize configuration from file and environment variables
   */
  async initialize(configPath = 'config.json') {
    // Start with default configuration
    this.config = this.getDefaultConfig();

    // Load from config file if it exists
    try {
      const configFile = await fs.readFile(configPath, 'utf8');
      const fileConfig = JSON.parse(configFile);
      this.config = lodash.merge(this.config, fileConfig);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to load config file ${configPath}: ${error.message}`);
      }
      // Config file doesn't exist, use defaults and environment variables
    }

    // Override with environment variables
    this.loadEnvironmentVariables();
    
    this.initialized = true;
  }

  /**
   * Get default configuration values
   */
  getDefaultConfig() {
    return {
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'llama2',
        temperature: 0.7,
        timeout: 30000
      },
      mud: {
        host: 'arctic.org',
        port: 2700,
        characterName: 'AIPlayer',
        autoLogin: false,
        reconnectDelay: 5000,
        maxReconnectAttempts: 5
      },
      behavior: {
        aggressiveness: 0.5,
        exploration: 0.8,
        caution: 0.6,
        commandDelayMs: 1000,
        maxActionsPerMinute: 30
      },
      logging: {
        level: 'info',
        file: 'logs/diku-ai.log',
        maxFileSize: '50MB',
        maxFiles: 5,
        console: true
      },
      database: {
        path: 'data/gamestate.db',
        backupInterval: 300000
      },
      advanced: {
        debugMode: false,
        enableMetrics: true,
        metricsPort: 8080,
        webInterface: false,
        webInterfacePort: 3000
      }
    };
  }

  /**
   * Load configuration from environment variables
   */
  loadEnvironmentVariables() {
    const envMappings = {
      'OLLAMA_BASE_URL': 'ollama.baseUrl',
      'OLLAMA_MODEL': 'ollama.model',
      'OLLAMA_TEMPERATURE': 'ollama.temperature',
      'MUD_HOST': 'mud.host',
      'MUD_PORT': 'mud.port',
      'MUD_CHARACTER_NAME': 'mud.characterName',
      'MUD_AUTO_LOGIN': 'mud.autoLogin',
      'BEHAVIOR_AGGRESSIVENESS': 'behavior.aggressiveness',
      'BEHAVIOR_EXPLORATION': 'behavior.exploration',
      'BEHAVIOR_CAUTION': 'behavior.caution',
      'LOG_LEVEL': 'logging.level',
      'LOG_FILE': 'logging.file',
      'DB_PATH': 'database.path',
      'DEBUG_MODE': 'advanced.debugMode',
      'COMMAND_DELAY_MS': 'behavior.commandDelayMs',
      'MAX_RECONNECT_ATTEMPTS': 'mud.maxReconnectAttempts'
    };

    for (const [envVar, configPath] of Object.entries(envMappings)) {
      const envValue = process.env[envVar];
      if (envValue !== undefined) {
        // Convert string values to appropriate types
        let convertedValue = envValue;
        
        // Convert numeric values
        if (!isNaN(envValue) && envValue !== '') {
          convertedValue = parseFloat(envValue);
        }
        
        // Convert boolean values
        if (envValue.toLowerCase() === 'true') {
          convertedValue = true;
        } else if (envValue.toLowerCase() === 'false') {
          convertedValue = false;
        }

        lodash.set(this.config, configPath, convertedValue);
      }
    }
  }

  /**
   * Get a configuration value by dot notation path
   */
  get(path, defaultValue = undefined) {
    if (!this.initialized) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return lodash.get(this.config, path, defaultValue);
  }

  /**
   * Set a configuration value by dot notation path
   */
  set(path, value) {
    if (!this.initialized) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    lodash.set(this.config, path, value);
  }

  /**
   * Get the entire configuration object
   */
  getAll() {
    if (!this.initialized) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return lodash.cloneDeep(this.config);
  }

  /**
   * Validate configuration values
   */
  validate() {
    const errors = [];

    // Validate Ollama configuration
    if (!this.get('ollama.baseUrl')) {
      errors.push('ollama.baseUrl is required');
    }
    if (!this.get('ollama.model')) {
      errors.push('ollama.model is required');
    }

    // Validate MUD configuration
    if (!this.get('mud.host')) {
      errors.push('mud.host is required');
    }
    if (!this.get('mud.port') || this.get('mud.port') <= 0) {
      errors.push('mud.port must be a positive number');
    }

    // Validate behavior values are between 0 and 1
    const behaviorKeys = ['aggressiveness', 'exploration', 'caution'];
    for (const key of behaviorKeys) {
      const value = this.get(`behavior.${key}`);
      if (value < 0 || value > 1) {
        errors.push(`behavior.${key} must be between 0 and 1`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    return true;
  }
}

// Export singleton instance
module.exports = new Config();