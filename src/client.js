/**
 * Simple MUD Client
 * Connects LLM directly to MUD with minimal processing
 */

const net = require("net");
const axios = require("axios");
const stripAnsi = require("strip-ansi");
const TUI = require("./tui");
const CharacterManager = require("./character-manager");

/**
 * Comprehensive text sanitization for TUI display
 * Handles ANSI sequences, control characters, invalid UTF-8, and other problematic characters
 */
function sanitizeTextForDisplay(rawText) {
  let text = rawText;

  // First strip ANSI escape sequences
  text = stripAnsi(text);

  // Handle problematic characters that can mess up TUI display:

  // 1. Replace UTF-8 replacement characters (often from invalid UTF-8 sequences)
  //    The hex sequence bf ef ef bd bd bf creates these replacement chars
  text = text.replace(/\uFFFD/g, "");

  // 2. Remove problematic characters from invalid UTF-8 sequences
  //    This includes half-width katakana and other chars that appear from corrupted UTF-8
  //    Remove characters in ranges that commonly appear from invalid UTF-8:
  //    - Half-width katakana (U+FF61-U+FF9F)
  //    - Other problematic ranges
  text = text.replace(/[\uFF61-\uFF9F]/g, "");

  // 3. Remove or replace control characters except for newlines and tabs
  //    Keep: \n (0x0A), \t (0x09)
  //    Remove: NULL (0x00), SOH (0x01), STX (0x02), etc.
  //    Also removes other non-printable characters that might interfere with blessed
  // eslint-disable-next-line no-control-regex
  text = text.replace(
    /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g,
    "",
  );

  // 4. Handle carriage returns - convert \r\n to \n, remove standalone \r
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\r/g, "");

  return text;
}

class MudClient {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.debug = options.debug || false;

    this.socket = null;
    this.isConnected = false;
    this.initialDataReceived = false;
    this.messageHistory = [];

    // Initialize TUI
    this.tui = new TUI(this.config.behavior);

    // Initialize character management
    this.characterManager = new CharacterManager(config, (message) => this.tui.showDebug(message));
    this.currentCharacterId = options.characterId || null;

    // Conversation history for LLM context
    this.conversationHistory = [];
    this.maxTokens = options.maxTokens || 100000; // Maximum token limit for context window

    // LLM request state tracking
    this.llmRequestPending = false;
    this.mudOutputQueue = [];
    this.waitingForMudResponse = false;

    // Pathfinding tracking
    this.lastMovementCommand = null; // Track the last movement command sent
    this.awaitingExitsResponse = false; // Track if we're waiting for an automatic exits command response

    // Generate system prompt based on character selection
    this.systemPrompt = this.generateSystemPrompt();

    // Initialize conversation history with system prompt
    this.conversationHistory.push({
      role: "system",
      content: this.systemPrompt,
    });

    // Determine LLM provider and setup HTTP client
    this.setupLLMProvider(config);
  }

  /**
   * Setup LLM provider (Ollama or OpenAI)
   */
  setupLLMProvider(config) {
    if (config.llm) {
      this.llmProvider = config.llm.provider || "ollama";
      this.llmConfig = config.llm[this.llmProvider];
    } else {
      throw new Error(
        "No LLM configuration found. Please configure llm section in config.",
      );
    }

    // Validate configuration
    if (!this.llmConfig) {
      throw new Error(
        `LLM provider '${this.llmProvider}' configuration not found in config.`,
      );
    }

    // Setup HTTP client based on provider
    const headers = {
      "Content-Type": "application/json",
    };

    if (this.llmProvider === "openai" && this.llmConfig.apiKey) {
      headers["Authorization"] = `Bearer ${this.llmConfig.apiKey}`;
    }

    this.httpClient = axios.create({
      baseURL: this.llmConfig.baseUrl,
      timeout: 30000,
      headers,
    });

    if (this.debug) {
      this.tui.showDebug(`LLM Provider: ${this.llmProvider}`);
      this.tui.showDebug(`LLM Model: ${this.llmConfig.model}`);
      this.tui.showDebug(`LLM Base URL: ${this.llmConfig.baseUrl}`);
    }
  }

  /**
   * Generate system prompt based on character selection
   */
  generateSystemPrompt() {
    const basePrompt = `
# ARCTIC DIKU MUD AI PLAYER

## PRIMARY OBJECTIVE
Efficiently advance to level 10 in Arctic MUD by gaining **one level per session** before renting and disconnecting.

## STRATEGIC PLANNING FRAMEWORK
Before each action, follow this decision sequence:
1. **Assess Current Status**: Check HP, moves, hunger, thirst, equipment condition
2. **Evaluate Immediate Threats/Opportunities**: Combat, loot, learning opportunities  
3. **Choose Priority Action**: Survival > Progress > Efficiency > Exploration
4. **Execute Single Command**: Use <plan> and <command> blocks

## COMMAND STRUCTURE (CRITICAL)
**This is KEYWORD-DRIVEN, not natural language**
- Format: ACTION [TARGET] [OBJECT] 
- Use ONLY keywords found in room/item/NPC descriptions
- NO full sentences, politeness words, or unnecessary articles

### Command Examples:
**CORRECT**: 'look', 'north', 'get sword', 'kill orc', 'cons mob'  
**WRONG**: 'ask girl for guide', 'could you help me', 'please give me'

## GAME STATUS PARSING
Monitor prompt: "56H 118V 1499X 0.00% 0C T:60 Exits:D"
- **H** = Hit Points (health) - **CRITICAL for survival**
- **V** = Move Points (stamina) - needed for movement  
- **X** = Experience to next level (counts DOWN)
- **%** = Progress to next level
- **C** = Coins carried
- **T:** = Seconds to next game tick
- **Exits:** = Available directions (N/S/E/W/U/D only)

## SURVIVAL & SAFETY PRIORITIES
1. **Health Management**: Flee if HP drops below 50%, rest when safe
2. **Resource Management**: Keep food/water, manage move points
3. **Equipment**: Always have weapon, armor, light source
4. **Emergency Exit**: Know path to inn/safety, use 'recall' scrolls

## COMBAT STRATEGY  
1. **Target Selection**: Use 'cons mob' - target "Easy" to "Fairly Easy" only
2. **Engagement**: 'kill mobname' starts auto-combat
3. **Skills**: Use class abilities ('bash', 'kick') during combat
4. **Looting**: Always 'get all corpse' after victories
5. **Escape**: 'flee' if HP critical, 'recite recall' for emergency teleport

## NAVIGATION & EXPLORATION
- **Movement**: Only N, S, E, W, U, D (never NE, NW, etc.)
- **Orientation**: 'look' after every move to understand location
- **Mapping**: Remember landmarks (shops, guilds, temples)
- **Helper Commands**: Use '/point destination' or '/wayfind destination'
- **If Lost**: Use '/wayfind' to find important locations

## LEVELING STRATEGY
1. **Efficient XP**: Target mobs giving 5%+ experience per kill
2. **Skill Learning**: Visit guildmaster, use 'learn all' every login  
3. **Equipment Upgrades**: Sell loot at appropriate shops, buy better gear
4. **Progress Tracking**: Use 'score' to confirm level gains

## SESSION WORKFLOW
1. **Login**: 'look', check status, visit guildmaster
2. **Preparation**: Buy food/water, check equipment, get light source
3. **Adventure**: Fight appropriate mobs, loot efficiently
4. **Safety Check**: Monitor HP/resources, return to safety when needed
5. **End Session**: Sell loot, 'rent' at inn (NEVER quit without renting)

## CRITICAL COMMANDS REFERENCE
### Essential Commands:
- 'look' - examine environment (use frequently)
- 'inv' - check inventory  
- 'eq' - check equipment
- 'score' - full character status
- 'cons mob' - assess mob difficulty

### Combat Commands:
- 'kill target' - start combat
- 'flee' - escape combat
- 'get all corpse' - loot after victory

### Navigation Commands:
- 'n/s/e/w/u/d' - move in cardinal directions
- '/point location' - get next step to destination
- '/wayfind location' - get full path to destination

### Commerce Commands:
- 'list' - see shop inventory
- 'buy item' - purchase items
- 'sell item' - sell to appropriate shop type

### Safety Commands:
- 'rent' - save progress at inn
- 'recite recall' - emergency teleport to safety

## RESPONSE FORMAT
Always respond with:
1. **<plan>** block explaining your short-term strategy
2. **<command>** block with exactly ONE game command

## ERROR HANDLING
- **"Huh?!"** = Invalid command → Use 'help' immediately
- **Movement fails** = Try different exits or use '/wayfind'
- **Cannot rent** = Sell items first, never drop valuable equipment
- **Pager prompts** (with [brackets]) = Use only bracketed options like 'return' or 'q'
- **Email required** = Use 'anicolao@gmail.com' when prompted for email address

## INTERACTION GUIDELINES
- **NPCs**: Start with 'look npc' to learn available commands
- **Multiple items**: Use numbers ('l 2.guard', 'get 2.sword')
- **Containers**: 'put item container', 'get item container'
- **Failed commands**: Never repeat the same failed command

## CHARACTER PROGRESSION NOTES
- **Level 1-3**: Focus on easy mobs near starting area
- **Level 4-6**: Expand hunting grounds, upgrade equipment  
- **Level 7-10**: Seek challenging but manageable mobs
- Always maintain 5%+ XP gain per mob to stay efficient

`;

    // Add character-specific context if a character is selected
    if (this.currentCharacterId) {
      const characterContext = this.characterManager.generateCharacterContext(
        this.currentCharacterId,
      );
      if (characterContext) {
        return (
          basePrompt +
          `

## CHARACTER CONTEXT
**Current Character**: ${characterContext.name} (Level ${characterContext.level} ${characterContext.class}, ${characterContext.race})
**Password**: ${characterContext.password}
**Last Location**: ${characterContext.location}

### Recent Memories:
${characterContext.memories}

### Navigation Context:
${characterContext.navigation}

**Login Instructions**: Send character name first, then password as separate commands.

**Memory Recording**: Use <record-memory> blocks for significant events (level_up, combat, exploration, etc.)`
        );
      }
    }

    // For new character creation
    return (
      basePrompt +
      `

## CHARACTER CREATION
**First Command**: Start with <command>start</command>

**After character creation**, record details:
<new-character>
{
  "name": "YourCharacterName",
  "class": "chosen_class", 
  "race": "chosen_race",
  "password": "your_password",
  "level": 1,
  "location": "current_location"
}
</new-character>

**Memory System**: Use <record-memory> blocks for significant events.
System responds with "OK" or "ERROR - message".`
    );
  }

  /**
   * Start the MUD client
   */
  async start() {
    try {
      this.tui.updateInputStatus("Connecting to MUD...");
      await this.connectToMud();
      this.tui.showDebug("Connected to MUD, waiting for login banner...");
      this.tui.showLLMStatus({
        contextInfo: "Conversation history initialized with system prompt",
      });

      // Wait a bit for initial MUD banner/data
      // If no data arrives within reasonable time, send a minimal prompt
      const maxWaitTime = 5000; // 5 seconds
      const waitStart = Date.now();

      while (
        !this.initialDataReceived &&
        Date.now() - waitStart < maxWaitTime
      ) {
        await this.sleep(100);
      }

      if (!this.initialDataReceived) {
        this.tui.showDebug(
          "No initial data received from MUD, sending minimal initialization prompt to LLM",
        );
        // Send a minimal prompt only if no MUD data was received
        await this.sendToLLM(
          "Connected to MUD. Waiting for server response...",
        );
      }
      // If initialDataReceived is true, the data was already processed by handleMudOutput
    } catch (error) {
      this.tui.showDebug(`Error starting MUD client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect to the MUD server using raw socket
   */
  async connectToMud() {
    return new Promise((resolve, reject) => {
      try {
        this.initialDataReceived = false;

        // Create raw TCP socket connection
        this.socket = new net.Socket();
        this.socket.setTimeout(3600000); // 1 hour timeout (3600 seconds * 1000ms)

        // Set up event handlers before connecting
        this.socket.on("data", (data) => {
          this.handleMudOutput(data);
        });

        this.socket.on("connect", () => {
          this.tui.showDebug("Raw socket connected to MUD server");
          this.isConnected = true;
          this.tui.updateInputStatus(
            "Connected to MUD. Waiting for login banner...",
          );
          resolve();
        });

        this.socket.on("close", () => {
          this.tui.showDebug("MUD connection closed");
          this.isConnected = false;
        });

        this.socket.on("error", (error) => {
          this.tui.showDebug(`MUD connection error: ${error.message}`);
          this.isConnected = false;
          reject(error);
        });

        this.socket.on("timeout", () => {
          this.tui.showDebug("MUD connection timeout");
          this.socket.destroy();
          reject(new Error("Connection timeout"));
        });

        // Connect to the MUD server
        this.tui.showDebug(
          `Connecting to ${this.config.mud.host}:${this.config.mud.port}...`,
        );
        this.socket.connect(this.config.mud.port, this.config.mud.host);
      } catch (error) {
        this.tui.showDebug(`Failed to connect to MUD: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Handle output from the MUD
   */
  async handleMudOutput(data) {
    const rawOutput = data.toString();

    // Sanitize text for clean TUI display (handles ANSI, control chars, invalid UTF-8, etc.)
    const output = sanitizeTextForDisplay(rawOutput);

    // Mark that we've received initial data from MUD
    this.initialDataReceived = true;

    this.tui.showDebug("Received MUD output, processing...");

    // Show MUD output in the TUI main panel
    this.tui.showMudOutput(output);

    // Store the output for context
    this.messageHistory.push({
      type: "mud_output",
      content: output,
      timestamp: new Date(),
    });

    // Track movement results for pathfinding if we just sent a movement command
    if (this.lastMovementCommand && this.currentCharacterId) {
      const success =
        !output.toLowerCase().includes("you can't go that way") &&
        !output.toLowerCase().includes("alas, you cannot") &&
        !output.toLowerCase().includes("you cannot");

      this.characterManager.recordMovement(
        this.currentCharacterId,
        this.lastMovementCommand.direction,
        output,
        success,
      );

      // If movement was successful, automatically send "exits" command to get room connectivity info
      if (success) {
        this.tui.showDebug(
          "🗺️ Movement successful, sending automatic 'exits' command",
        );
        this.awaitingExitsResponse = true;
        // Send exits command immediately after successful movement
        setTimeout(() => {
          if (this.socket && this.isConnected) {
            this.socket.write("exits\n");
            this.tui.showDebug("🚀 AUTO-SENT: exits");
          }
        }, 100); // Small delay to ensure room description is complete
      }

      // Clear the movement command after processing
      this.lastMovementCommand = null;
    }

    // Check if this output contains "Obvious exits:" response from automatic exits command
    const isExitsResponse = output.includes("Obvious exits:");
    if (this.awaitingExitsResponse && isExitsResponse) {
      this.tui.showDebug(
        "📋 Processing automatic exits response for room mapping",
      );
      this.awaitingExitsResponse = false;

      // Process for room mapping and continue to send to LLM for planning
      if (this.currentCharacterId) {
        const character = this.characterManager.getCharacter(
          this.currentCharacterId,
        );
        if (character) {
          this.characterManager.updateRoomMap(character, output);
        }
      }

      // Continue with normal processing to send exits info to LLM for planning
    }

    // If we were waiting for MUD response after sending a command,
    // now we can process any queued messages
    if (this.waitingForMudResponse) {
      this.waitingForMudResponse = false;
      this.tui.showDebug(
        "Received MUD response after command, processing queued messages...",
      );

      // Add current output to the queue and process all together
      if (this.mudOutputQueue.length > 0) {
        this.mudOutputQueue.push(output);
        await this.processQueuedMessages();
        return; // processQueuedMessages will handle the combined LLM request
      }
      // If no queued messages, just continue with normal processing
    }

    // If LLM request is pending, queue this output instead of sending immediately
    if (this.llmRequestPending) {
      this.tui.showDebug("LLM request pending, queuing MUD output...");
      this.mudOutputQueue.push(output);
      return;
    }

    // Send to LLM for decision
    await this.sendToLLM(output);
  }

  formatOutput(title, output) {
    return `\n==== ${title} ===>> (\n${output}\n==== ${title} ===<< )`;
  }
  /**
   * Send message to LLM and handle response
   */
  async sendToLLM(mudOutput) {
    // Prevent concurrent LLM requests
    if (this.llmRequestPending) {
      this.tui.showDebug("LLM request already pending, ignoring new request");
      return;
    }

    this.llmRequestPending = true;
    this.tui.showDebug("🔄 LLM request started");

    try {
      // Add MUD output to conversation history
      this.conversationHistory.push({
        role: "tool",
        content: `${mudOutput}`,
      });

      // Truncate history if too long, but always keep system prompt first
      this.truncateConversationHistory();

      if (this.debug) {
        const totalTokens = this.calculateTotalTokens();
        this.tui.showDebug(
          `Sending to LLM: ${this.conversationHistory.length} messages, ${totalTokens} estimated tokens`,
        );
        const output = this.formatOutput("Latest MUD Output", mudOutput);
        this.tui.showDebug(output);
      }

      // Make API call based on provider
      let response;
      let llmResponse;

      if (this.llmProvider === "openai") {
        // OpenAI API format - transform messages for OpenAI compatibility
        const openaiMessages = this.conversationHistory.map((msg) => {
          // OpenAI doesn't support 'tool' role, map it to 'user'
          if (msg.role === "tool") {
            return {
              role: "user",
              content: msg.content,
            };
          }
          return msg;
        });

        response = await this.httpClient.post("/chat/completions", {
          model: this.llmConfig.model,
          messages: openaiMessages,
          temperature: this.llmConfig.temperature || 0.7,
          stream: false,
        });

        if (this.debug) {
          this.tui.showDebug(
            `OpenAI API request sent with ${openaiMessages.length} messages`,
          );
        }

        llmResponse = response.data.choices[0].message.content;
      } else {
        // Ollama API format (default)
        response = await this.httpClient.post("/api/chat", {
          model: this.llmConfig.model,
          messages: this.conversationHistory,
          options: {
            temperature: this.llmConfig.temperature || 0.7,
          },
          stream: false,
        });
        llmResponse = response.data.message.content;
      }

      if (this.debug) {
        this.tui.showDebug(this.formatOutput("LLM Response", llmResponse));
      }

      // Add LLM response to conversation history
      this.conversationHistory.push({
        role: "assistant",
        content: llmResponse,
      });

      // Parse and display LLM response
      const parsed = this.parseLLMResponse(llmResponse);

      // Process character management commands
      const characterResponses = this.characterManager.processLLMResponse(
        llmResponse,
        this.currentCharacterId,
      );
      if (characterResponses.length > 0) {
        for (const response of characterResponses) {
          this.tui.showDebug(`💾 Character System: ${response}`);

          // If a new character was created, set it as current
          if (
            response.startsWith("OK - Character recorded:") &&
            !this.currentCharacterId
          ) {
            const characters = this.characterManager.getCharactersList();
            if (characters.length > 0) {
              this.currentCharacterId = characters[characters.length - 1].id; // Use the most recently created
              this.tui.showDebug(
                `🆔 Set current character ID: ${this.currentCharacterId}`,
              );
            }
          }

          // Send system response back to LLM
          this.conversationHistory.push({
            role: "tool",
            content: response,
          });
        }
      }

      if (!parsed.command) {
        parsed.command = "\n";
        this.tui.showLLMStatus({
          error: "No command found, sending newline to continue.",
        });
      }

      if (parsed.command) {
        this.tui.showLLMStatus({ command: parsed.command });
        await this.tui.waitForApproval(
          `✅ Ready to send command to MUD: ${parsed.command}`,
        );
        this.tui.showMudInput(parsed.command);
        await this.sendToMud(parsed.command);
      } else {
        this.tui.showLLMStatus({
          error: "No valid command found in LLM response",
        });
        if (this.debug) {
          this.tui.showDebug(
            `=== Full LLM Response (No Command Found) ===\n${llmResponse}\n============================================`,
          );
        }
      }
    } catch (error) {
      // Enhanced error logging for API debugging
      let errorMessage = error.message;
      if (error.response) {
        // API returned an error response
        errorMessage = `${error.response.status} ${error.response.statusText}`;
        if (error.response.data) {
          if (this.debug) {
            this.tui.showDebug(
              `=== API Error Details ===\n${JSON.stringify(error.response.data, null, 2)}\n========================`,
            );
          }
          // Try to extract a more specific error message
          if (error.response.data.error && error.response.data.error.message) {
            errorMessage += `: ${error.response.data.error.message}`;
          }
        }
      }

      this.tui.showLLMStatus({
        error: `Error communicating with LLM (${this.llmProvider}): ${errorMessage}`,
      });

      // Simple fallback - send 'look' command
      this.tui.showDebug("🔄 Using fallback command: look");
      await this.sendToMud("look");
    }
  }

  /**
   * Process queued MUD messages after LLM request completion
   */
  async processQueuedMessages() {
    // This should only be called when no LLM request is pending
    if (this.llmRequestPending) {
      this.tui.showDebug(
        "ERROR: processQueuedMessages called while LLM request is pending",
      );
      return;
    }

    if (this.mudOutputQueue.length === 0) {
      return;
    }

    this.tui.showDebug(
      `Processing ${this.mudOutputQueue.length} queued MUD messages...`,
    );

    // Combine all queued messages into a single message
    const combinedOutput = this.mudOutputQueue.join("\n");
    this.mudOutputQueue = []; // Clear the queue

    // Send the combined output to LLM for processing
    await this.sendToLLM(combinedOutput);
  }

  /**
   * Estimate the number of tokens in a text string
   * Uses word count as approximation (splits on spaces)
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Split on spaces and count words as token approximation
    const words = text.trim().split(/\s+/);
    return words.length;
  }

  /**
   * Calculate total tokens in conversation history
   */
  calculateTotalTokens() {
    return this.conversationHistory.reduce((total, message) => {
      return total + this.estimateTokens(message.content);
    }, 0);
  }

  /**
   * Truncate conversation history based on token count
   * Always keeps system prompt as first message
   * Removes oldest messages (except system prompt) until token count < maxTokens
   */
  truncateConversationHistory() {
    if (this.conversationHistory.length === 0) {
      return;
    }

    const totalTokens = this.calculateTotalTokens();

    if (totalTokens <= this.maxTokens) {
      return;
    }

    // Always preserve system prompt (first message)
    const systemPrompt = this.conversationHistory[0];
    let messages = this.conversationHistory.slice(1);

    // Remove oldest messages until we're under the token limit
    while (messages.length > 0) {
      // Calculate current total tokens with system prompt + remaining messages
      let currentTokens = this.estimateTokens(systemPrompt.content);
      currentTokens += messages.reduce((total, msg) => {
        return total + this.estimateTokens(msg.content);
      }, 0);

      // If we're under the limit (with 90% safety margin), we're done
      if (currentTokens <= this.maxTokens * 0.9) {
        break;
      }

      const removedMessage = messages.shift(); // Remove oldest non-system message
      if (this.debug) {
        this.tui.showDebug(
          `Removed message: ${removedMessage.role} (${this.estimateTokens(removedMessage.content)} tokens)`,
        );
      }
    }

    // Reconstruct conversation history
    this.conversationHistory = [systemPrompt, ...messages];

    if (this.debug) {
      const finalTokens = this.calculateTotalTokens();
      this.tui.showDebug(
        `Truncated conversation history: ${this.conversationHistory.length} messages, ${finalTokens} estimated tokens`,
      );
    }
  }

  /**
   * Get conversation history summary for debugging
   */
  getConversationSummary() {
    return this.conversationHistory
      .map(
        (msg, index) =>
          `${index + 1}. ${msg.role}: ${msg.content.substring(0, 100)}...`,
      )
      .join("\n");
  }

  /**
   * Parse LLM response and extract plan, reasoning, and command
   */
  parseLLMResponse(llmResponse) {
    const contextInfo = `${this.conversationHistory.length} messages in conversation history`;

    // Extract plan from <plan> blocks (XML-style)
    const planMatch = llmResponse.match(/<plan>\s*(.*?)\s*<\/plan>/is);
    let plan = planMatch ? planMatch[1].trim() : null;

    // Extract next step/reasoning
    const stepMatch = llmResponse.match(
      /\*\*(?:Next Step|Command|Action)\*\*:?\s*(.*?)(?=\n\*\*|<|$)/is,
    );
    const nextStep = stepMatch ? stepMatch[1].trim() : null;

    // Extract command from response
    const command = this.extractCommand(llmResponse);

    // Display the parsed information in TUI
    const statusData = { contextInfo };

    if (plan) {
      statusData.plan = plan;
    }

    if (nextStep) {
      statusData.nextStep = nextStep;
    }

    if (command) {
      // Validate command is single line
      const commandLines = command.split("\n").filter((line) => line.trim());
      if (commandLines.length > 1) {
        statusData.error = `REJECTED: Command contains multiple lines: ${command}`;
        this.tui.showLLMStatus(statusData);
        return { plan, nextStep, command: null };
      }

      statusData.command = command;
    } else {
      statusData.error = "No command found in <command> block or code block";
    }

    this.tui.showLLMStatus(statusData);
    return { plan, nextStep, command };
  }

  /**
   * Extract command from LLM response
   */
  extractCommand(llmResponse) {
    // Look for <command> blocks (only supported format)
    const commandMatch = llmResponse.match(/<command>\s*(.*?)\s*<\/command>/s);
    if (commandMatch) {
      const command = commandMatch[1].trim();

      // Check for literal return/enter commands and convert to newline
      const lowerCommand = command.toLowerCase().trim();
      if (lowerCommand === "return" || lowerCommand === "enter") {
        return "\n";
      }

      // Handle pager quit command
      if (lowerCommand === "q") {
        return "q";
      }

      return command;
    }

    // No command block found
    return null;
  }

  /**
   * Send command to MUD
   */
  async sendToMud(command) {
    if (!this.isConnected || !this.socket) {
      this.tui.showDebug("Cannot send command: not connected to MUD");
      return;
    }

    // Intercept navigation helper commands
    const trimmedCommand = command.trim();
    if (
      trimmedCommand.startsWith("/point ") ||
      trimmedCommand.startsWith("/wayfind ")
    ) {
      this.llmRequestPending = false;
      this.tui.showDebug("✅ LLM request completed");
      await this.handleNavigationCommand(trimmedCommand);
      return;
    }

    // Mark LLM request as completed but don't process queued messages yet
    // We need to wait for the MUD response after sending the command
    try {
      this.llmRequestPending = false;
      this.tui.showDebug("✅ LLM request completed");
      this.waitingForMudResponse = true;

      // Track if this is a movement command for pathfinding
      const isMovementCommand = this.isMovementCommand(command.trim());
      if (isMovementCommand) {
        this.lastMovementCommand = {
          direction: command.trim().toUpperCase(),
          timestamp: new Date().toISOString(),
        };
      }

      this.tui.showDebug(`🚀 SENDING TO MUD: ${command}`);

      // Send command with newline (MUDs expect commands to end with newline)
      this.socket.write(command + "\n");

      // Store the command for context
      this.messageHistory.push({
        type: "command_sent",
        content: command,
        timestamp: new Date(),
      });

      // Update UI status
      this.tui.updateInputStatus("Command sent. Waiting for MUD response...");
    } catch (error) {
      this.tui.showDebug(`Error sending command to MUD: ${error.message}`);
    }
  }

  /**
   * Check if a command is a movement command
   */
  isMovementCommand(command) {
    const movementCommands = [
      "N",
      "S",
      "E",
      "W",
      "U",
      "D",
      "NORTH",
      "SOUTH",
      "EAST",
      "WEST",
      "UP",
      "DOWN",
    ];
    return movementCommands.includes(command.toUpperCase());
  }

  /**
   * Handle navigation helper commands (/point and /wayfind)
   */
  async handleNavigationCommand(command) {
    if (!this.currentCharacterId) {
      const response =
        "Navigation commands require a character to be selected.";
      this.tui.showMudOutput(response);
      await this.sendToLLM(response);
      return;
    }

    const parts = command.split(" ");
    const commandType = parts[0]; // "/point" or "/wayfind"
    const destination = parts.slice(1).join(" ").trim();

    if (!destination) {
      const response = `Usage: ${commandType} <destination>`;
      this.tui.showMudOutput(response);
      await this.sendToLLM(response);
      return;
    }

    this.tui.showDebug(`Processing navigation command: ${command}`);

    try {
      let response;
      if (commandType === "/point") {
        response = this.characterManager.findNextStep(
          this.currentCharacterId,
          destination,
        );
      } else if (commandType === "/wayfind") {
        response = this.characterManager.findFullPath(
          this.currentCharacterId,
          destination,
        );
      }

      // Show the navigation result to both TUI and send to LLM
      this.tui.showMudOutput(response);
      await this.sendToLLM(response);
    } catch (error) {
      const errorResponse = `Navigation error: ${error.message}`;
      this.tui.showDebug(errorResponse);
      this.tui.showMudOutput(errorResponse);
      await this.sendToLLM(errorResponse);
    }
  }

  /**
   * Disconnect from MUD
   */
  async disconnect() {
    if (this.socket && this.isConnected) {
      try {
        this.socket.end();
      } catch (error) {
        this.tui.showDebug(`Error disconnecting from MUD: ${error.message}`);
      }
    }
    this.isConnected = false;

    // Clean up TUI
    if (this.tui) {
      this.tui.destroy();
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = MudClient;
