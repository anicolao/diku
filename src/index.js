#!/usr/bin/env node

/**
 * Diku MUD AI Player
 * Entry point for the AI-driven MUD client
 */

const { Command } = require('commander');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const MudClient = require('./client/client');
const logger = require('./utils/logger');
const config = require('./utils/config');

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('diku-ai')
  .description('AI-powered MUD client for Diku MUDs')
  .version('0.1.0')
  .option('-c, --config <path>', 'path to config file', 'config.json')
  .option('-v, --verbose', 'enable verbose logging')
  .option('-d, --debug', 'enable debug mode')
  .option('--dry-run', 'simulate without actually connecting to MUD')
  .parse();

async function main() {
  const options = program.opts();
  
  try {
    // Initialize configuration
    await config.initialize(options.config);
    
    if (options.verbose) {
      config.set('logging.level', 'debug');
    }
    
    if (options.debug) {
      config.set('advanced.debugMode', true);
      config.set('logging.level', 'debug');
    }

    // Initialize logger with configuration
    logger.init(config.get('logging'));
    
    logger.info('Starting Diku MUD AI Player v0.1.0');
    logger.info(`Configuration loaded from: ${options.config}`);
    
    if (options.dryRun) {
      logger.info('DRY RUN MODE: Will not connect to MUD');
    }

    // Validate required configuration
    const requiredConfigs = [
      'ollama.baseUrl',
      'ollama.model',
      'mud.host',
      'mud.port'
    ];
    
    for (const configKey of requiredConfigs) {
      if (!config.get(configKey)) {
        throw new Error(`Required configuration missing: ${configKey}`);
      }
    }

    // Create MUD client instance
    const mudClient = new MudClient(config.getAll(), { dryRun: options.dryRun });
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await mudClient.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await mudClient.disconnect();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // Start the MUD client
    logger.info('Initializing MUD client...');
    await mudClient.initialize();
    
    if (!options.dryRun) {
      logger.info(`Connecting to ${config.get('mud.host')}:${config.get('mud.port')}...`);
      await mudClient.connect();
    }
    
    logger.info('Diku MUD AI Player started successfully');
    
  } catch (error) {
    console.error('Failed to start Diku MUD AI Player:', error.message);
    if (options.debug) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };