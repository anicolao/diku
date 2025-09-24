/**
 * Simple MUD Client
 * Connects LLM directly to MUD with minimal processing
 */

const Telnet = require('telnet-client');
const axios = require('axios');
const TUI = require('./tui');

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

    // Conversation history for LLM context
    this.conversationHistory = [];
    this.maxHistoryLength = 10; // Keep last 10 interactions

    // System prompt for the LLM
    this.systemPrompt = `You are an expert Diku MUD player connected to arctic diku by telnet. Your goal is to create a character and advance to level 10 as efficiently as possible, while making friends within the Diku environment. In each session, you will play for one hour before returning to a safe exit and disconnecting.

**Environment**
You can send text commands over the telnet connection and receive output from the server.

**Workflow**
1. **Plan**: Create a short term plan of what you want to accomplish. Display it in a <plan> block.
2. **Command**: Send a \`\`\`telnet code block which contains **one line of text** to be transmitted to the server

**Rules**
- Your first response must contain a \`\`\`telnet code block with your first command
- Always respond with exactly one command in a \`\`\`telnet block
- Read the MUD output carefully and respond appropriately
- Focus on character creation, leveling, and social interaction
- **Use anicolao@gmail.com if asked for an email address**
- **Always** include a \`\`\`telnet block
`;

    // Initialize conversation history with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: this.systemPrompt,
    });

    this.httpClient = axios.create({
      baseURL: config.ollama.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Start the MUD client
   */
  async start() {
    try {
      this.tui.updateInputStatus('Connecting to MUD...');
      await this.connectToMud();
      this.tui.showDebug('Connected to MUD, starting LLM interaction...');
      this.tui.showLLMStatus({ contextInfo: 'Conversation history initialized with system prompt' });

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
      this.tui.updateInputStatus('Connected to MUD. Waiting for LLM responses...');
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
        this.tui.showDebug(`Latest MUD output: ${mudOutput.substring(0, 100)}...`);
      }

      const response = await this.httpClient.post('/api/chat', {
        model: this.config.ollama.model,
        messages: this.conversationHistory,
        options: {
          temperature: this.config.ollama.temperature || 0.7,
        },
        stream: false,
      });

      const llmResponse = response.data.message.content;

      if (this.debug) {
        this.tui.showDebug(`LLM Response: ${llmResponse.substring(0, 200)}...`);
      }

      // Add LLM response to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: llmResponse,
      });

      // Parse and display LLM response
      const parsed = this.parseLLMResponse(llmResponse);

      if (!parsed.command) {
        parsed.command = '\n';
        this.tui.showLLMStatus({ error: 'No command found, sending newline to continue.' });
      }

      if (parsed.command) {
        this.tui.showLLMStatus({ command: parsed.command });
        await this.tui.waitForApproval(`✅ Ready to send command to MUD: ${parsed.command}`);
        await this.sendToMud(parsed.command);
      } else {
        this.tui.showLLMStatus({ error: 'No valid command found in LLM response' });
        if (this.debug) {
          this.tui.showDebug(`LLM Response: ${llmResponse}`);
        }
      }
    } catch (error) {
      this.tui.showLLMStatus({ error: `Error communicating with LLM: ${error.message}` });

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

    // Extract plan if present
    const planMatch = llmResponse.match(/\*\*Plan\*\*:?\s*(.*?)(?=\n\*\*|$)/is);
    const plan = planMatch ? planMatch[1].trim() : null;

    // Extract next step/reasoning
    const stepMatch = llmResponse.match(
      /\*\*(?:Next Step|Command|Action)\*\*:?\s*(.*?)(?=\n\*\*|```|$)/is,
    );
    const nextStep = stepMatch ? stepMatch[1].trim() : null;

    // Extract command from telnet code block
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
      statusData.error = 'No command found in telnet block';
    }

    this.tui.showLLMStatus(statusData);
    return { plan, nextStep, command };
  }

  /**
   * Extract telnet command from LLM response
   */
  extractCommand(llmResponse) {
    // Look for ```telnet code blocks
    const telnetMatch = llmResponse.match(/```telnet\s*\n?(.*?)\n?```/s);
    if (telnetMatch) {
      return telnetMatch[1].trim();
    }

    // Fallback: look for any code block
    const codeMatch = llmResponse.match(/```\s*\n?(.*?)\n?```/s);
    if (codeMatch) {
      return codeMatch[1].trim();
    }

    // No code block found
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
