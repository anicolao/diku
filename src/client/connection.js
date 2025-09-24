/**
 * Telnet connection handler for MUD communication
 */

const EventEmitter = require('events');
const { TelnetSocket } = require('telnet-client');
const logger = require('../utils/logger');

class TelnetConnection extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.logger = logger.child({ component: 'TelnetConnection' });
    
    this.socket = null;
    this.isConnected = false;
    this.connectionParams = {
      host: config.host,
      port: config.port,
      timeout: config.timeout || 10000,
      negotiationMandatory: false,
      irs: '\r\n',
      ors: '\r\n',
      stripShellPrompt: false
    };
  }

  /**
   * Connect to the MUD server
   */
  async connect() {
    if (this.isConnected) {
      throw new Error('Already connected');
    }

    try {
      this.logger.info(`Connecting to ${this.config.host}:${this.config.port}`);
      
      this.socket = new TelnetSocket();
      
      // Set up event handlers
      this.socket.on('data', (data) => {
        this.emit('data', data);
      });
      
      this.socket.on('close', () => {
        this.isConnected = false;
        this.logger.info('Connection closed');
        this.emit('close');
      });
      
      this.socket.on('error', (error) => {
        this.logger.error('Socket error:', error);
        this.emit('error', error);
      });
      
      // Connect to the server
      await this.socket.connect(this.connectionParams);
      this.isConnected = true;
      
      this.logger.info('Connected successfully');
      this.emit('connected');
      
    } catch (error) {
      this.logger.error('Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the MUD server
   */
  async disconnect() {
    if (!this.isConnected || !this.socket) {
      return;
    }

    try {
      this.logger.info('Disconnecting...');
      await this.socket.end();
      this.isConnected = false;
      this.socket = null;
      
    } catch (error) {
      this.logger.error('Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Send a command to the MUD
   */
  async send(command) {
    if (!this.isConnected || !this.socket) {
      throw new Error('Not connected to MUD');
    }

    try {
      const commandWithNewline = command.toString().trim() + '\r\n';
      await this.socket.write(commandWithNewline);
      
      this.logger.logMudCommunication('sent', command);
      
    } catch (error) {
      this.logger.error('Failed to send command:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      host: this.config.host,
      port: this.config.port
    };
  }
}

module.exports = TelnetConnection;