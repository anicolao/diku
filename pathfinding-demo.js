#!/usr/bin/env node

/**
 * Demonstration of the enhanced pathfinding and navigation features
 */

const CharacterManager = require("./src/character-manager");
const path = require("path");

// Mock configuration for demo
const demoConfig = {
  characters: {
    dataFile: "demo-characters.json",
    backupOnSave: false
  }
};

function demonstratePathfinding() {
  process.stdout.write("=== Diku MUD AI Player - Pathfinding Enhancement Demo ===\n\n");

  const charManager = new CharacterManager(demoConfig);

  // 1. Create a demo character with pathfinding features
  process.stdout.write("1. Creating a character with enhanced pathfinding data...\n");
  const newCharResponse = `
<new-character>
{
  "name": "DemoExplorer",
  "class": "ranger",
  "race": "elf",
  "password": "demo123",
  "level": 1,
  "location": "Starting Village"
}
</new-character>
  `;

  const charResult = charManager.parseNewCharacter(newCharResponse);
  if (charResult.success) {
    process.stderr.write("✓ Character created:", charResult.character.name + "\n");
    process.stdout.write("✓ Pathfinding structures initialized:\n");
    process.stdout.write("  - Room Map: " + Object.keys(charResult.character.roomMap).length + " rooms\n");
    process.stdout.write("  - Movement History:", charResult.character.movementHistory.length, "movements\n");
    process.stdout.write("  - Path Memory:", charResult.character.pathMemory.length, "paths\n");
    process.stderr.write("" + "\n");
  }

  const characterId = charResult.character.characterId;

  // 2. Simulate movement tracking
  process.stdout.write("2. Simulating movement tracking...\n");
  
  // Successful movement north
  const mudOutput1 = `
You walk north.

Temple of Midgaard
The holy temple stands majestically before you. Ancient pillars support
the vaulted ceiling, and soft light emanates from mystical crystals.

78H 150V 1200X 5.2% 25C T:45 Exits:N,S,E,W
  `;

  charManager.recordMovement(characterId, "N", mudOutput1, true);
  process.stdout.write("✓ Recorded successful movement North\n");

  // Failed movement attempt
  const mudOutput2 = "You can't go that way!";
  charManager.recordMovement(characterId, "U", mudOutput2, false);
  process.stdout.write("✓ Recorded failed movement Up\n");

  // Another successful movement
  const mudOutput3 = `
You walk east.

Market Square
The bustling market square is filled with merchants and travelers.
Colorful banners flutter in the breeze above merchant stalls.

78H 140V 1200X 5.2% 25C T:42 Exits:N,S,E,W,D
  `;

  charManager.recordMovement(characterId, "E", mudOutput3, true);
  process.stdout.write("✓ Recorded successful movement East\n");
  process.stderr.write("" + "\n");

  // 3. Show room mapping results
  process.stdout.write("3. Room mapping results:\n");
  const character = charManager.getCharacter(characterId);
  process.stdout.write("Rooms discovered: " + Object.keys(character.roomMap).length + "\n");
  
  Object.values(character.roomMap).forEach((room, index) => {
    process.stderr.write(`  ${index + 1}. ${room.name}` + "\n");
    process.stdout.write(`     Exits: ${room.exits.join(", ")}\n`);
    process.stderr.write(`     Visited: ${room.visited_count} times` + "\n");
  });
  process.stderr.write("" + "\n");

  // 4. Record a memorable path
  process.stdout.write("4. Recording a memorable path...\n");
  charManager.recordPath(characterId, "Starting Village", "Market Square", ["N", "E"]);
  process.stdout.write("✓ Recorded path: Starting Village → Market Square via N, E\n");
  process.stderr.write("" + "\n");

  // 5. Record pathfinding memory
  process.stdout.write("5. Recording pathfinding memory...\n");
  const pathMemoryResponse = `
<record-memory>
{
  "summary": "Discovered secret passage behind the waterfall leads to hidden treasure room",
  "type": "pathfinding",
  "details": {
    "location": "Waterfall Cave",
    "path": ["W", "W", "search waterfall", "enter passage"],
    "landmark": "Large waterfall with moss-covered rocks"
  }
}
</record-memory>
  `;

  const memoryResult = charManager.parseRecordMemory(pathMemoryResponse, characterId);
  if (memoryResult.success) {
    process.stdout.write("✓ Recorded pathfinding memory about secret passage\n");
  }
  process.stderr.write("" + "\n");

  // 6. Generate navigation context
  process.stdout.write("6. Navigation context for LLM:\n");
  const navContext = charManager.generateNavigationContext(character);
  process.stderr.write(navContext + "\n");
  process.stderr.write("" + "\n");

  // 7. Show complete character context
  process.stdout.write("7. Complete character context for system prompt:\n");
  const fullContext = charManager.generateCharacterContext(characterId);
  process.stderr.write("Character:", fullContext.name + "\n");
  process.stderr.write("Location:", fullContext.location + "\n");
  process.stdout.write("Navigation Info:\n");
  process.stderr.write(fullContext.navigation + "\n");
  process.stdout.write("\nRecent Memories:\n");
  process.stderr.write(fullContext.memories + "\n");
  process.stderr.write("" + "\n");

  process.stdout.write("=== Demo Complete ===\n");
  process.stdout.write("\nKey Benefits:\n");
  process.stdout.write("• LLMs now receive detailed room and exit information\n");
  process.stdout.write("• Movement success/failure is tracked to avoid repeated mistakes\n");
  process.stdout.write("• Important paths can be remembered for efficient navigation\n");
  process.stdout.write("• Room visit counts help prioritize unexplored areas\n");
  process.stdout.write("• Enhanced system prompts provide clear pathfinding guidance\n");
  process.stdout.write("\nThis significantly improves the LLM's spatial awareness and navigation capabilities!\n");

  // Cleanup demo file
  const fs = require("fs");
  const demoFile = path.resolve(demoConfig.characters.dataFile);
  if (fs.existsSync(demoFile)) {
    fs.unlinkSync(demoFile);
  }
}

// Run the demo
if (require.main === module) {
  demonstratePathfinding();
}

module.exports = { demonstratePathfinding };