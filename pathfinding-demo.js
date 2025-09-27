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
  console.log("=== Diku MUD AI Player - Pathfinding Enhancement Demo ===\n");

  const charManager = new CharacterManager(demoConfig);

  // 1. Create a demo character with pathfinding features
  console.log("1. Creating a character with enhanced pathfinding data...");
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
    console.log("✓ Character created:", charResult.character.name);
    console.log("✓ Pathfinding structures initialized:");
    console.log("  - Room Map:", Object.keys(charResult.character.roomMap).length, "rooms");
    console.log("  - Movement History:", charResult.character.movementHistory.length, "movements");
    console.log("  - Path Memory:", charResult.character.pathMemory.length, "paths");
    console.log("");
  }

  const characterId = charResult.character.characterId;

  // 2. Simulate movement tracking
  console.log("2. Simulating movement tracking...");
  
  // Successful movement north
  const mudOutput1 = `
You walk north.

Temple of Midgaard
The holy temple stands majestically before you. Ancient pillars support
the vaulted ceiling, and soft light emanates from mystical crystals.

78H 150V 1200X 5.2% 25C T:45 Exits:N,S,E,W
  `;

  charManager.recordMovement(characterId, "N", mudOutput1, true);
  console.log("✓ Recorded successful movement North");

  // Failed movement attempt
  const mudOutput2 = "You can't go that way!";
  charManager.recordMovement(characterId, "U", mudOutput2, false);
  console.log("✓ Recorded failed movement Up");

  // Another successful movement
  const mudOutput3 = `
You walk east.

Market Square
The bustling market square is filled with merchants and travelers.
Colorful banners flutter in the breeze above merchant stalls.

78H 140V 1200X 5.2% 25C T:42 Exits:N,S,E,W,D
  `;

  charManager.recordMovement(characterId, "E", mudOutput3, true);
  console.log("✓ Recorded successful movement East");
  console.log("");

  // 3. Show room mapping results
  console.log("3. Room mapping results:");
  const character = charManager.getCharacter(characterId);
  console.log("Rooms discovered:", Object.keys(character.roomMap).length);
  
  Object.values(character.roomMap).forEach((room, index) => {
    console.log(`  ${index + 1}. ${room.name}`);
    console.log(`     Exits: ${room.exits.join(", ")}`);
    console.log(`     Visited: ${room.visited_count} times`);
  });
  console.log("");

  // 4. Record a memorable path
  console.log("4. Recording a memorable path...");
  charManager.recordPath(characterId, "Starting Village", "Market Square", ["N", "E"]);
  console.log("✓ Recorded path: Starting Village → Market Square via N, E");
  console.log("");

  // 5. Record pathfinding memory
  console.log("5. Recording pathfinding memory...");
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
    console.log("✓ Recorded pathfinding memory about secret passage");
  }
  console.log("");

  // 6. Generate navigation context
  console.log("6. Navigation context for LLM:");
  const navContext = charManager.generateNavigationContext(character);
  console.log(navContext);
  console.log("");

  // 7. Show complete character context
  console.log("7. Complete character context for system prompt:");
  const fullContext = charManager.generateCharacterContext(characterId);
  console.log("Character:", fullContext.name);
  console.log("Location:", fullContext.location);
  console.log("Navigation Info:");
  console.log(fullContext.navigation);
  console.log("\nRecent Memories:");
  console.log(fullContext.memories);
  console.log("");

  console.log("=== Demo Complete ===");
  console.log("\nKey Benefits:");
  console.log("• LLMs now receive detailed room and exit information");
  console.log("• Movement success/failure is tracked to avoid repeated mistakes");
  console.log("• Important paths can be remembered for efficient navigation");
  console.log("• Room visit counts help prioritize unexplored areas");
  console.log("• Enhanced system prompts provide clear pathfinding guidance");
  console.log("\nThis significantly improves the LLM's spatial awareness and navigation capabilities!");

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