#!/usr/bin/env node

/**
 * Diku MUD AI Player - Simplified Version
 * Simple client that connects LLM directly to MUD
 */

const { Command } = require("commander");
const MudClient = require("./client");
const CharacterManager = require("./character-manager");
const CharacterSelector = require("./character-selector");
const TUI = require("./tui");

// Simple logger that can work before TUI is available
const logger = {
  tui: null,
  setTUI(tui) {
    this.tui = tui;
  },
  log(message) {
    if (this.tui && this.tui.showDebug) {
      this.tui.showDebug(message);
    } else {
      process.stdout.write(message + "\n");
    }
  },
  error(message) {
    if (this.tui && this.tui.showDebug) {
      this.tui.showDebug(`ERROR: ${message}`);
    } else {
      process.stderr.write(message + "\n");
    }
  }
};

// Try to load config, with fallback
let config;
try {
  config = require("../config.json");
} catch (error) {
  logger.error("Warning: config.json not found, using config.example.json");
  try {
    config = require("../config.example.json");
  } catch (error2) {
    logger.error("Error: Neither config.json nor config.example.json found");
    process.exit(1);
  }
}

const program = new Command();

program
  .name("diku-ai")
  .description("Simple AI-powered MUD client that lets LLM play directly")
  .version("0.2.0")
  .option("-d, --debug", "enable debug logging")
  .option("--dry-run", "simulate without actually connecting to MUD")
  .parse();

async function main() {
  const options = program.opts();

  try {
    // Only show startup info in dry run mode to avoid interfering with TUI
    if (options.dryRun) {
      // Create TUI for dry-run mode to handle debug output
      const tui = new TUI(config.behavior);
      
      tui.showDebug("Starting Diku MUD AI Player v0.2.0 (Simplified)");
      // Determine config format for display
      let llmInfo;
      if (config.llm) {
        const provider = config.llm.provider || "ollama";
        const providerConfig = config.llm[provider];
        llmInfo = {
          provider: provider,
          baseUrl: providerConfig.baseUrl,
          model: providerConfig.model
        };
      }

      tui.showDebug(`Configuration: MUD Host: ${config.mud.host}, MUD Port: ${config.mud.port}, LLM Provider: ${llmInfo.provider}, LLM URL: ${llmInfo.baseUrl}, Model: ${llmInfo.model}`);
      tui.showDebug("DRY RUN MODE: Will not connect to MUD");
      
      // Keep TUI open for a moment to show the debug info
      setTimeout(() => {
        tui.destroy();
        process.exit(0);
      }, 3000);
      return;
    }

    // Character selection flow
    const characterManager = new CharacterManager(config);
    const characterSelector = new CharacterSelector(characterManager, logger);
    const selection = await characterSelector.selectCharacter();
    
    let selectedCharacterId = null;
    if (selection.action === "use_existing") {
      selectedCharacterId = selection.characterId;
      // Note: Character selection status will be logged to TUI debug panel once client starts
    } else {
      // Note: New character creation status will be logged to TUI debug panel once client starts
    }

    // Create and start the simple MUD client
    const mudClient = new MudClient(config, { 
      debug: options.debug, 
      characterId: selectedCharacterId 
    });
    
    // Log character selection status to TUI now that it's available
    logger.setTUI(mudClient.tui);
    if (selection.action === "use_existing") {
      logger.log("Selected existing character for play.");
    } else {
      logger.log("Will create new character during gameplay.");
    }
    
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      logger.log("\nReceived SIGINT, shutting down gracefully...");
      await mudClient.disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.log("\nReceived SIGTERM, shutting down gracefully...");
      await mudClient.disconnect();
      process.exit(0);
    });

    // Handle uncaught exceptions to clean up TUI
    process.on("uncaughtException", async (error) => {
      logger.error("Uncaught exception:", error);
      await mudClient.disconnect();
      process.exit(1);
    });

    // Start the client
    await mudClient.start();
    
  } catch (error) {
    logger.error("Failed to start Diku MUD AI Player:", error.message);
    if (options.debug) {
      logger.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    // Final error handler - must use direct write as TUI may not be available
    process.stderr.write("Fatal error: " + error + "\n");
    process.exit(1);
  });
}

module.exports = { main };