#!/usr/bin/env node

/**
 * Diku MUD AI Player - Simplified Version
 * Simple client that connects LLM directly to MUD
 */

const { Command } = require('commander');
const MudClient = require('./client');
const config = require('../config.json');

const program = new Command();

program
  .name('diku-ai')
  .description('Simple AI-powered MUD client that lets LLM play directly')
  .version('0.2.0')
  .option('-d, --debug', 'enable debug logging')
  .option('--dry-run', 'simulate without actually connecting to MUD')
  .parse();

async function main() {
  const options = program.opts();
  
  try {
    console.log('Starting Diku MUD AI Player v0.2.0 (Simplified)');
    console.log('Configuration:', {
      mudHost: config.mud.host,
      mudPort: config.mud.port,
      ollamaUrl: config.ollama.baseUrl,
      model: config.ollama.model
    });
    
    if (options.dryRun) {
      console.log('DRY RUN MODE: Will not connect to MUD');
      return;
    }

    // Create and start the simple MUD client
    const mudClient = new MudClient(config, { debug: options.debug });
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      await mudClient.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM, shutting down gracefully...');
      await mudClient.disconnect();
      process.exit(0);
    });

    // Start the client
    await mudClient.start();
    
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