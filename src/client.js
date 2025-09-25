/**
 * Simple MUD Client
 * Connects LLM directly to MUD with minimal processing
 */

const Telnet = require('telnet-client');
const axios = require('axios');
const TUI = require('./tui');
const CharacterManager = require('./character-manager');

class MudClient {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.debug = options.debug || false;

    this.telnetSocket = null;
    this.isConnected = false;
    this.messageHistory = [];

    // Initialize TUI
    this.tui = new TUI();

    // Initialize character management
    this.characterManager = new CharacterManager(config);
    this.currentCharacterId = options.characterId || null;

    // Conversation history for LLM context
    this.conversationHistory = [];
    this.maxHistoryLength = 10; // Keep last 10 interactions

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
      throw new Error('No LLM configuration found. Please configure either ollama or llm section in config.');
    }

    // Validate configuration
    if (!this.llmConfig) {
      throw new Error(`LLM provider '${this.llmProvider}' configuration not found in config.`);
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
    const basePrompt = `You are an expert Diku MUD player connected to arctic diku by telnet. Your goal is to create a character and advance to level 10 as efficiently as possible, while making friends within the Diku environment. In each session, you will play for one hour before returning to a safe exit and disconnecting.

**Environment**
You can send text commands over the telnet connection and receive output from the server. In a text adventure game,
the commands are typically just one or two words, such as "look", "north", "get sword", "attack orc", "say hello", etc. Don't
generate long sentences or paragraphs. Keep your commands concise and to the point, including when interacting with NPCs. Use
"help" to learn general commands, or "look NPC" to learn how to interact with an NPC. Each NPC has their own set of commands.

**Workflow**
1. **Plan**: Create a short term plan of what you want to accomplish. Display it in a <plan>Your plan here</plan> block.
2. **Command**: Send a <command>your command</command> block which contains **one line of text** to be transmitted to the server

**Rules**
- Your first response must contain a <command> block with your first command
- Always respond with exactly one command in a <command> block  
- Use <plan> blocks to show your planning
- Read the MUD output carefully and respond appropriately
- Focus on character creation, leveling, and social interaction
- **Use anicolao@gmail.com if asked for an email address**
- **Always** include a <command> block
- **When interacting with NPCs**: Start by using a 'look NPC' command to learn their available commands
- **If the game says "Huh?!"**: It means you sent an invalid command. Use "help" *immediately* to learn valid commands.
- **Do not write in full sentences** look for commands of the form <action> <target> and only rarely with more text after that.
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

Record experiences:
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

After creating your character, record it:
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

Record significant experiences:
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
      this.tui.showDebug('Connected to MUD, starting LLM interaction...');
      this.tui.showLLMStatus({
        contextInfo: 'Conversation history initialized with system prompt',
      });

      // Send initial prompt to LLM to start the game
      await this.sendToLLM(
        'You have connected to Arctic MUD. Send start to creating a character, or your name to start logging in if you know a name and password.',
      );
    } catch (error) {
      this.tui.showDebug(`Error starting MUD client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect to the MUD server
   */
  async connectToMud() {
    try {
      this.telnetSocket = new Telnet();

      const connectionParams = {
        host: this.config.mud.host,
        port: this.config.mud.port,
        timeout: 10000,
        negotiationMandatory: false,
        shellPrompt: /.*/, // Match any prompt
        pageSeparator: /--More--/,
        debug: this.debug,
      };

      this.telnetSocket.on('data', (data) => {
        this.handleMudOutput(data);
      });

      this.telnetSocket.on('close', () => {
        this.tui.showDebug('MUD connection closed');
        this.isConnected = false;
      });

      this.telnetSocket.on('error', (error) => {
        this.tui.showDebug(`MUD connection error: ${error.message}`);
      });

      await this.telnetSocket.connect(connectionParams);
      this.isConnected = true;
      this.tui.updateInputStatus(
        'Connected to MUD. Waiting for LLM responses...',
      );
    } catch (error) {
      this.tui.showDebug(`Failed to connect to MUD: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle output from the MUD
   */
  async handleMudOutput(data) {
    const output = data.toString();

    // Show MUD output in the TUI main panel
    this.tui.showMudOutput(output);

    // Store the output for context
    this.messageHistory.push({
      type: 'mud_output',
      content: output,
      timestamp: new Date(),
    });

    // Send to LLM for decision
    await this.sendToLLM(output);
  }

  /**
   * Send message to LLM and handle response
   */
  async sendToLLM(mudOutput) {
    try {
      // Add MUD output to conversation history
      this.conversationHistory.push({
        role: 'tool',
        content: `${mudOutput}`,
      });

      // Truncate history if too long, but always keep system prompt first
      this.truncateConversationHistory();

      if (this.debug) {
        this.tui.showDebug(
          `Sending to LLM with conversation history. Current history length: ${this.conversationHistory.length}`,
        );
        this.tui.showDebug(
          `=== Latest MUD Output ===\n${mudOutput}\n=========================`,
        );
      }

      // Make API call based on provider
      let response;
      let llmResponse;

      if (this.llmProvider === 'openai') {
        // OpenAI API format
        response = await this.httpClient.post('/chat/completions', {
          model: this.llmConfig.model,
          messages: this.conversationHistory,
          temperature: this.llmConfig.temperature || 0.7,
          stream: false,
        });
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
        this.tui.showDebug(
          `=== LLM Response ===\n${llmResponse}\n====================`,
        );
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
      this.tui.showLLMStatus({
        error: `Error communicating with LLM: ${error.message}`,
      });

      // Simple fallback - send 'look' command
      this.tui.showDebug('🔄 Using fallback command: look');
      await this.sendToMud('look');
    }
  }

  /**
   * Truncate conversation history to keep recent interactions
   * Always keeps system prompt as first message
   */
  truncateConversationHistory() {
    if (this.conversationHistory.length <= this.maxHistoryLength) {
      return;
    }

    // Keep system prompt (first message) and last N-1 messages
    const systemPrompt = this.conversationHistory[0];
    const recentMessages = this.conversationHistory.slice(
      -(this.maxHistoryLength - 1),
    );

    this.conversationHistory = [systemPrompt, ...recentMessages];

    if (this.debug) {
      this.tui.showDebug(
        `Truncated conversation history to ${this.conversationHistory.length} messages`,
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
    // Look for <command> blocks (preferred format)
    const commandMatch = llmResponse.match(/<command>\s*(.*?)\s*<\/command>/s);
    if (commandMatch) {
      return commandMatch[1].trim();
    }

    // Look for ```telnet code blocks (legacy)
    const telnetMatch = llmResponse.match(/```telnet\s*\n?(.*?)\n?```/s);
    if (telnetMatch) {
      return telnetMatch[1].trim();
    }

    // Look for any code block (fallback)
    const codeMatch = llmResponse.match(/```\s*\n?(.*?)\n?```/s);
    if (codeMatch) {
      return codeMatch[1].trim();
    }

    // No command block found
    return null;
  }

  /**
   * Send command to MUD
   */
  async sendToMud(command) {
    if (!this.isConnected || !this.telnetSocket) {
      this.tui.showDebug('Cannot send command: not connected to MUD');
      return;
    }

    try {
      this.tui.showDebug(`🚀 SENDING TO MUD: ${command}`);

      await this.telnetSocket.send(command);

      // Store the command for context
      this.messageHistory.push({
        type: 'command_sent',
        content: command,
        timestamp: new Date(),
      });

      // Update UI status
      this.tui.updateInputStatus('Command sent. Waiting for MUD response...');

      // Add a small delay to avoid flooding
      await this.sleep(this.config.behavior?.commandDelayMs || 2000);
    } catch (error) {
      this.tui.showDebug(`Error sending command to MUD: ${error.message}`);
    }
  }

  /**
   * Disconnect from MUD
   */
  async disconnect() {
    if (this.telnetSocket && this.isConnected) {
      try {
        await this.telnetSocket.end();
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
