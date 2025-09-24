/**
 * Logging utility using Winston
 * Provides structured logging with multiple transports
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
  constructor() {
    this.logger = null;
    this.initialized = false;
  }

  /**
   * Initialize the logger with configuration
   */
  init(config = {}) {
    // Ensure logs directory exists
    const logFile = config.file || 'logs/diku-ai.log';
    const logDir = path.dirname(logFile);
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Create custom format
    const customFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let output = `${timestamp} [${level}] ${message}`;
        if (Object.keys(meta).length > 0) {
          output += ' ' + JSON.stringify(meta, null, 2);
        }
        return output;
      })
    );

    // Configure transports
    const transports = [
      new winston.transports.File({
        filename: logFile,
        level: config.level || 'info',
        maxsize: this.parseSize(config.maxFileSize || '50MB'),
        maxFiles: config.maxFiles || 5,
        tailable: true,
        format: customFormat
      })
    ];

    // Add console transport if enabled
    if (config.console !== false) {
      transports.push(
        new winston.transports.Console({
          level: config.level || 'info',
          format: consoleFormat
        })
      );
    }

    // Create the logger
    this.logger = winston.createLogger({
      level: config.level || 'info',
      format: customFormat,
      transports,
      exitOnError: false
    });

    this.initialized = true;
  }

  /**
   * Parse size string to bytes
   */
  parseSize(sizeStr) {
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
    if (!match) {
      throw new Error(`Invalid size format: ${sizeStr}`);
    }

    const size = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();
    
    return size * units[unit];
  }

  /**
   * Get the underlying Winston logger instance
   */
  getLogger() {
    if (!this.initialized) {
      // Initialize with default config if not already done
      this.init();
    }
    return this.logger;
  }

  // Convenience methods
  debug(message, meta = {}) {
    this.getLogger().debug(message, meta);
  }

  info(message, meta = {}) {
    this.getLogger().info(message, meta);
  }

  warn(message, meta = {}) {
    this.getLogger().warn(message, meta);
  }

  error(message, meta = {}) {
    this.getLogger().error(message, meta);
  }

  /**
   * Log AI decision with structured metadata
   */
  logAIDecision(decision, context = {}) {
    this.info('AI Decision', {
      type: 'ai_decision',
      decision,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log MUD communication
   */
  logMudCommunication(direction, data, meta = {}) {
    this.debug(`MUD ${direction}`, {
      type: 'mud_communication',
      direction,
      data: data.toString().trim(),
      ...meta
    });
  }

  /**
   * Log performance metrics
   */
  logMetrics(metrics) {
    this.info('Performance Metrics', {
      type: 'metrics',
      ...metrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log game state changes
   */
  logStateChange(component, oldState, newState) {
    this.debug('State Change', {
      type: 'state_change',
      component,
      oldState,
      newState,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(context) {
    return {
      debug: (message, meta = {}) => this.debug(message, { ...context, ...meta }),
      info: (message, meta = {}) => this.info(message, { ...context, ...meta }),
      warn: (message, meta = {}) => this.warn(message, { ...context, ...meta }),
      error: (message, meta = {}) => this.error(message, { ...context, ...meta }),
      logAIDecision: (decision, additionalContext = {}) => 
        this.logAIDecision(decision, { ...context, ...additionalContext }),
      logMudCommunication: (direction, data, meta = {}) => 
        this.logMudCommunication(direction, data, { ...context, ...meta }),
      logMetrics: (metrics) => this.logMetrics({ ...context, ...metrics }),
      logStateChange: (component, oldState, newState) => 
        this.logStateChange(component, oldState, newState)
    };
  }
}

// Export singleton instance
module.exports = new Logger();