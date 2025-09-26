/**
 * Simple MUD Client
 * Connects LLM directly to MUD with minimal processing
 */

const net = require('net');
const axios = require('axios');
const stripAnsi = require('strip-ansi');
const TUI = require('./tui');
const CharacterManager = require('./character-manager');

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
    this.characterManager = new CharacterManager(config);
    this.currentCharacterId = options.characterId || null;

    // Conversation history for LLM context
    this.conversationHistory = [];
    this.maxTokens = options.maxTokens || 100000; // Maximum token limit for context window

    // LLM request state tracking
    this.llmRequestPending = false;
    this.mudOutputQueue = [];
    this.waitingForMudResponse = false;

    // Generate system prompt based on character selection
    this.systemPrompt = this.generateSystemPrompt();

    // Initialize conversation history with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: this.systemPrompt,
    });

    // Determine LLM provider and setup HTTP client
    this.setupLLMProvider(config);
  }

  /**
   * Setup LLM provider (Ollama or OpenAI) with backward compatibility
   */
  setupLLMProvider(config) {
    // Support backward compatibility with old config format
    if (config.ollama && !config.llm) {
      // Legacy config format - use Ollama
      this.llmProvider = 'ollama';
      this.llmConfig = config.ollama;
    } else if (config.llm) {
      // New config format
      this.llmProvider = config.llm.provider || 'ollama';
      this.llmConfig = config.llm[this.llmProvider];
    } else {
      throw new Error(
        'No LLM configuration found. Please configure either ollama or llm section in config.',
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
      'Content-Type': 'application/json',
    };

    if (this.llmProvider === 'openai' && this.llmConfig.apiKey) {
      headers['Authorization'] = `Bearer ${this.llmConfig.apiKey}`;
    }

    this.httpClient = axios.create({
      baseURL: this.llmConfig.baseUrl,
      timeout: 30000,
      headers,
    });

    if (this.debug) {
      console.log(`LLM Provider: ${this.llmProvider}`);
      console.log(`LLM Model: ${this.llmConfig.model}`);
      console.log(`LLM Base URL: ${this.llmConfig.baseUrl}`);
    }
  }

  /**
   * Generate system prompt based on character selection
   */
  generateSystemPrompt() {
    const basePrompt = `
You are an expert Diku MUD player connected to arctic diku by telnet.
Your goal is to create a character and advance to level 10 as
efficiently as possible, while making friends within the Diku
environment. In each session, you will play for one hour before
returning to a safe exit and disconnecting.

**Environment**

You can send commands and receive results from the game.  In a text
adventure game, the commands are typically just one or two words,
such as "look", "north", "get sword", "attack orc", "say hello",
etc. Keep your commands concise and to the point, including when
interacting with NPCs. Use "help" to learn general commands, or
"look NPC" to learn how to interact with an NPC. Each NPC has their
own set of commands.

**CRITICAL: Command Structure**
This is a KEYWORD-DRIVEN text adventure, NOT a natural language
processor. Commands must use specific keywords found in room/item/NPC
descriptions, or in the game help for global commands. **Read the Help**.

**CORRECT command patterns:**
- "look" (examine surroundings)
- "north" or "n" (movement)
- "get sword" (action + target)
- "attack orc" (action + target) 
- "ask girl guide" (action + NPC + topic keyword)
- "say hello" (action + message)
- "give sword girl" (action + item + target)

**WRONG (these will fail):**
- "ask girl for guide" (contains unnecessary words like "for")
- "tell the girl about the guide" (too many unnecessary words)
- "could you help me with directions" (natural language sentences)
- "please give me the sword" (politeness words don't work)
- "ne" "nw" or any other non-compass point direction (**only** N, S, E, W, U, D are valid)

**Environment**
Commands are parsed as: ACTION [TARGET] [OBJECT/TOPIC]. Keywords
available depend on what's in the current room (items, NPCs, exits).
Look for keywords hidden in descriptions - they often appear as
nouns or verbs in the text.

**Game Status Information**
The MUD displays your character status in a prompt line before each command, typically formatted like:
"56H 118V 1499X 0.00% 0C T:60 Exits:D"

This status line contains crucial information:
- **H** = Hit Points (health/life) - current health out of maximum
- **V** = Move Points (movement stamina) - energy for moving between rooms  
- **X** = Experience Points - accumulated experience toward next level
- **%** = Progress to Next Level - percentage complete to next level (e.g., 0.00%)
- **C** = Coins - money/currency you are carrying
- **T:** = Time to Next Tick - seconds until next game tick/update
- **Exits:** = Visible Exits **ONE LETTER PER DIRECTION** - available directions (N=North, S=South, E=East, W=West, U=Up, D=Down)

Monitor these values carefully to track your character's condition and plan actions accordingly.

**Workflow**
1. **Plan**: Create a short term plan of what you want to accomplish. Display it in a <plan>Your plan here</plan> block.
2. **Command**: Send a <command>your command</command> block which contains **one command** to be transmitted to the server

**Rules**
- Use <plan> blocks to show your planning
- Always respond with exactly one command in a <command> block  
- Read the MUD output carefully and respond appropriately
- **Use anicolao@gmail.com if asked for an email address**
- **Always** include a <command> block
- **When interacting with NPCs**: Start by using a 'look NPC' command to learn their available commands
- **If the game says "Huh?!"**: It means you sent an invalid command. Use "help" *immediately* to learn valid commands.
- **Do not write in full sentences** look for commands of the form <action> <target> and only rarely with more text after that.
- **exa corpse** to see if there are any items you can get
- **OFTEN USED** **cons target** to assess the difficulty in killing a target
- **OFTEN USED** **get all corpse** to loot a corpse
- **Directions are square compass points N, S, E, W, U, D** NE, NW, etc are almost **never valid**.
- **Never insist on giving a failed command twice.**
- **list** to list the items for sale in a shop
- **rent** to save your items when you quit, at a receptionist/inn
- **Eat or drink when you are hungry or thirsty**. Check inventory for food/water.
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

**Character Context**
Continuing as: ${characterContext.name} (Level ${characterContext.level} ${characterContext.class}, ${characterContext.race})

Character password: ${characterContext.password}
Last location: ${characterContext.location}
Recent memories:
${characterContext.memories}

Login: Send your character name *by itself* as the first command, followed by your password *by itself* as the second command.

Record *important* experiences:
<record-memory>
{
  "summary": "Brief description",
  "type": "level_up|social|combat|exploration|quest", 
  "details": { "key": "value" }
}
</record-memory>

Continue with this character's established goals and relationships.`
        );
      }
    }

    // For new character creation
    return (
      basePrompt +
      `

**Character Creation**
First Command: Send <command>
start
</command>

**Important**: After creating your character, record it:
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

You may record significant experiences:
<record-memory>
{
  "summary": "Brief description",
  "type": "level_up|social|combat|exploration|quest",
  "details": { "key": "value" }
}
</record-memory>

System responds with "OK" or "ERROR - message". Use these tools when appropriate.`
    );
  }

  /**
   * Start the MUD client
   */
  async start() {
    try {
      this.tui.updateInputStatus('Connecting to MUD...');
      await this.connectToMud();
      this.tui.showDebug('Connected to MUD, waiting for login banner...');
      this.tui.showLLMStatus({
        contextInfo: 'Conversation history initialized with system prompt',
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
          'No initial data received from MUD, sending minimal initialization prompt to LLM',
        );
        // Send a minimal prompt only if no MUD data was received
        await this.sendToLLM(
          'Connected to MUD. Waiting for server response...',
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
        this.socket.on('data', (data) => {
          this.handleMudOutput(data);
        });

        this.socket.on('connect', () => {
          this.tui.showDebug('Raw socket connected to MUD server');
          this.isConnected = true;
          this.tui.updateInputStatus(
            'Connected to MUD. Waiting for login banner...',
          );
          resolve();
        });

        this.socket.on('close', () => {
          this.tui.showDebug('MUD connection closed');
          this.isConnected = false;
        });

        this.socket.on('error', (error) => {
          this.tui.showDebug(`MUD connection error: ${error.message}`);
          this.isConnected = false;
          reject(error);
        });

        this.socket.on('timeout', () => {
          this.tui.showDebug('MUD connection timeout');
          this.socket.destroy();
          reject(new Error('Connection timeout'));
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

    // Strip ANSI escape sequences from MUD output
    const output = stripAnsi(rawOutput);

    // Mark that we've received initial data from MUD
    this.initialDataReceived = true;

    this.tui.showDebug('Received MUD output, processing...');

    // Show MUD output in the TUI main panel
    this.tui.showMudOutput(output);

    // Store the output for context
    this.messageHistory.push({
      type: 'mud_output',
      content: output,
      timestamp: new Date(),
    });

    // If we were waiting for MUD response after sending a command,
    // now we can process any queued messages
    if (this.waitingForMudResponse) {
      this.waitingForMudResponse = false;
      this.tui.showDebug(
        'Received MUD response after command, processing queued messages...',
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
      this.tui.showDebug('LLM request pending, queuing MUD output...');
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
      this.tui.showDebug('LLM request already pending, ignoring new request');
      return;
    }

    this.llmRequestPending = true;
    this.tui.showDebug('🔄 LLM request started');

    try {
      // Add MUD output to conversation history
      this.conversationHistory.push({
        role: 'tool',
        content: `${mudOutput}`,
      });

      // Truncate history if too long, but always keep system prompt first
      this.truncateConversationHistory();

      if (this.debug) {
        const totalTokens = this.calculateTotalTokens();
        this.tui.showDebug(
          `Sending to LLM: ${this.conversationHistory.length} messages, ${totalTokens} estimated tokens`,
        );
        const output = this.formatOutput('Latest MUD Output', mudOutput);
        this.tui.showDebug(output);
      }

      // Make API call based on provider
      let response;
      let llmResponse;

      if (this.llmProvider === 'openai') {
        // OpenAI API format - transform messages for OpenAI compatibility
        const openaiMessages = this.conversationHistory.map((msg) => {
          // OpenAI doesn't support 'tool' role, map it to 'user'
          if (msg.role === 'tool') {
            return {
              role: 'user',
              content: msg.content,
            };
          }
          return msg;
        });

        response = await this.httpClient.post('/chat/completions', {
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
        response = await this.httpClient.post('/api/chat', {
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
        this.tui.showDebug(this.formatOutput('LLM Response', llmResponse));
      }

      // Add LLM response to conversation history
      this.conversationHistory.push({
        role: 'assistant',
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
            response.startsWith('OK - Character recorded:') &&
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
            role: 'tool',
            content: response,
          });
        }
      }

      if (!parsed.command) {
        parsed.command = '\n';
        this.tui.showLLMStatus({
          error: 'No command found, sending newline to continue.',
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
          error: 'No valid command found in LLM response',
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
      this.tui.showDebug('🔄 Using fallback command: look');
      await this.sendToMud('look');
    }
  }

  /**
   * Process queued MUD messages after LLM request completion
   */
  async processQueuedMessages() {
    // This should only be called when no LLM request is pending
    if (this.llmRequestPending) {
      this.tui.showDebug(
        'ERROR: processQueuedMessages called while LLM request is pending',
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
    const combinedOutput = this.mudOutputQueue.join('\n');
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
      .join('\n');
  }

  /**
   * Parse LLM response and extract plan, reasoning, and command
   */
  parseLLMResponse(llmResponse) {
    const contextInfo = `${this.conversationHistory.length} messages in conversation history`;

    // Extract plan from <plan> blocks (XML-style)
    const planMatch = llmResponse.match(/<plan>\s*(.*?)\s*<\/plan>/is);
    let plan = planMatch ? planMatch[1].trim() : null;

    // Fallback: Extract plan from **Plan**: headers (markdown-style)
    if (!plan) {
      const planMarkdownMatch = llmResponse.match(
        /\*\*Plan\*\*:?\s*(.*?)(?=\n|$)/i,
      );
      plan = planMarkdownMatch ? planMarkdownMatch[1].trim() : null;
    }

    // Extract next step/reasoning (keeping existing logic for compatibility)
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
      const commandLines = command.split('\n').filter((line) => line.trim());
      if (commandLines.length > 1) {
        statusData.error = `REJECTED: Command contains multiple lines: ${command}`;
        this.tui.showLLMStatus(statusData);
        return { plan, nextStep, command: null };
      }

      statusData.command = command;
    } else {
      statusData.error = 'No command found in <command> block or code block';
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
      if (lowerCommand === 'return' || lowerCommand === 'enter') {
        return '\n';
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
      this.tui.showDebug('Cannot send command: not connected to MUD');
      return;
    }
    // Mark LLM request as completed but don't process queued messages yet
    // We need to wait for the MUD response after sending the command
    try {
      this.llmRequestPending = false;
      this.tui.showDebug('✅ LLM request completed');
      this.waitingForMudResponse = true;

      this.tui.showDebug(`🚀 SENDING TO MUD: ${command}`);

      // Send command with newline (MUDs expect commands to end with newline)
      this.socket.write(command + '\n');

      // Store the command for context
      this.messageHistory.push({
        type: 'command_sent',
        content: command,
        timestamp: new Date(),
      });

      // Update UI status
      this.tui.updateInputStatus('Command sent. Waiting for MUD response...');
    } catch (error) {
      this.tui.showDebug(`Error sending command to MUD: ${error.message}`);
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
