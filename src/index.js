#!/usr/bin/env node

/**
 * Diku MUD AI Player - Simplified Version
 * Simple client that connects LLM directly to MUD
 */

const { Command } = require('commander');
const MudClient = require('./client');
const CharacterManager = require('./character-manager');
const CharacterSelector = require('./character-selector');

// Try to load config, with fallback
let config;
try {
  config = require('../config.json');
} catch (error) {
  console.error('Warning: config.json not found, using config.example.json');
  try {
    config = require('../config.example.json');
  } catch (error2) {
    console.error('Error: Neither config.json nor config.example.json found');
    process.exit(1);
  }
}

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
    // Only show startup info in dry run mode to avoid interfering with TUI
    if (options.dryRun) {
      console.log('Starting Diku MUD AI Player v0.2.0 (Simplified)');
      console.log('Configuration:', {
        mudHost: config.mud.host,
        mudPort: config.mud.port,
        ollamaUrl: config.ollama.baseUrl,
        model: config.ollama.model
      });
      console.log('DRY RUN MODE: Will not connect to MUD');
      return;
    }

    // Character selection flow
    const characterManager = new CharacterManager(config);
    const characterSelector = new CharacterSelector(characterManager);
    const selection = await characterSelector.selectCharacter();
    
    let selectedCharacterId = null;
    if (selection.action === 'use_existing') {
      selectedCharacterId = selection.characterId;
      console.log('Selected existing character for play.');
    } else {
      console.log('Will create new character during gameplay.');
    }

    // Create and start the simple MUD client
    const mudClient = new MudClient(config, { 
      debug: options.debug, 
      characterId: selectedCharacterId 
    });
    
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

    // Handle uncaught exceptions to clean up TUI
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await mudClient.disconnect();
      process.exit(1);
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