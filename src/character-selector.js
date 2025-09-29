/**
 * Character Selection Utility
 * Provides interactive character selection functionality
 */

const readline = require("readline");

class CharacterSelector {
  constructor(characterManager, logger = null) {
    this.characterManager = characterManager;
    this.logger = logger || {
      log: (msg) => process.stdout.write(msg + "\n"),
      error: (msg) => process.stderr.write(msg + "\n")
    };
  }

  /**
   * Display character selection menu and get user choice
   */
  async selectCharacter() {
    const characters = this.characterManager.getCharactersList();
    
    this.logger.log("\n=== Diku MUD AI Player ===");
    this.logger.log("Available characters:");
    
    characters.forEach((char, index) => {
      this.logger.log(`${index + 1}. ${char.name} (Level ${char.level} ${char.class}, ${char.race})`);
    });
    
    this.logger.log(`${characters.length + 1}. Create new character`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      const choice = await new Promise((resolve) => {
        rl.question(`Choose option (1-${characters.length + 1}): `, resolve);
      });

      const choiceNum = parseInt(choice.trim(), 10);
      
      if (choiceNum === characters.length + 1) {
        // Create new character
        rl.close();
        return { action: "create_new" };
      } else if (choiceNum >= 1 && choiceNum <= characters.length) {
        // Select existing character
        const selectedChar = characters[choiceNum - 1];
        rl.close();
        return { action: "use_existing", characterId: selectedChar.id };
      } else {
        rl.close();
        this.logger.error("Invalid choice. Exiting.");
        process.exit(1);
      }
    } catch (error) {
      rl.close();
      throw error;
    }
  }
}

module.exports = CharacterSelector;