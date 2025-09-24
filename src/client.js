/**
 * Simple MUD Client
 * Connects LLM directly to MUD with minimal processing
 */

const Telnet = require('telnet-client');
const axios = require('axios');

class MudClient {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.debug = options.debug || false;
    
    this.telnetSocket = null;
    this.isConnected = false;
    this.messageHistory = [];
    
    // Conversation history for LLM context
    this.conversationHistory = [];
    this.maxHistoryLength = 10; // Keep last 10 interactions
    
    // System prompt for the LLM
    this.systemPrompt = `You are an expert Diku MUD player connected to arctic diku by telnet. Your goal is to create a character and advance to level 10 as efficiently as possible, while making friends within the Diku environment. In each session, you will play for one hour before returning to a safe exit and disconnecting.

**Environment**
You can send text commands over the telnet connection and receive output from the server.

**Workflow**
1. **Plan**: Create a short term plan of what you want to accomplish
2. **Command**: Display commands in a \`\`\`telnet code block which contains the text to be transmitted to the server

**Rules**
- Your first response must contain a \`\`\`telnet code block with your first command
- Always respond with exactly one command in a \`\`\`telnet block
- Read the MUD output carefully and respond appropriately
- Focus on character creation, leveling, and social interaction`;

    // Initialize conversation history with system prompt
    this.conversationHistory.push({ role: 'system', content: this.systemPrompt });

    this.httpClient = axios.create({
      baseURL: config.ollama.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Start the MUD client
   */
  async start() {
    try {
      await this.connectToMud();
      console.log('Connected to MUD, starting LLM interaction...');
      console.log('💭 Conversation history initialized with system prompt');
      
      // Send initial prompt to LLM to start the game
      await this.sendToLLM('You have connected to Arctic MUD. Please start by creating a character.');
      
    } catch (error) {
      console.error('Error starting MUD client:', error);
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
        debug: this.debug
      };

      this.telnetSocket.on('data', (data) => {
        this.handleMudOutput(data);
      });
      
      this.telnetSocket.on('close', () => {
        console.log('MUD connection closed');
        this.isConnected = false;
      });
      
      this.telnetSocket.on('error', (error) => {
        console.error('MUD connection error:', error);
      });
      
      await this.telnetSocket.connect(connectionParams);
      this.isConnected = true;
      
    } catch (error) {
      console.error('Failed to connect to MUD:', error);
      throw error;
    }
  }

  /**
   * Handle output from the MUD
   */
  async handleMudOutput(data) {
    const output = data.toString();
    
    // Always show MUD output to user (not just in debug mode)
    console.log('\n=== MUD OUTPUT ===');
    console.log(output);
    console.log('=================\n');
    
    // Store the output for context
    this.messageHistory.push({
      type: 'mud_output',
      content: output,
      timestamp: new Date()
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
        role: 'user', 
        content: `MUD Output:\n${mudOutput}\n\nWhat is your next command?` 
      });

      // Truncate history if too long, but always keep system prompt first
      this.truncateConversationHistory();

      if (this.debug) {
        console.log('Sending to LLM with conversation history. Current history length:', this.conversationHistory.length);
        console.log('Latest MUD output:', mudOutput);
      }

      const response = await this.httpClient.post('/api/chat', {
        model: this.config.ollama.model,
        messages: this.conversationHistory,
        options: {
          temperature: this.config.ollama.temperature || 0.7
        },
        stream: false
      });

      const llmResponse = response.data.message.content;
      
      if (this.debug) {
        console.log('LLM Response:', llmResponse);
      }

      // Add LLM response to conversation history
      this.conversationHistory.push({ 
        role: 'assistant', 
        content: llmResponse 
      });

      // Parse and display LLM response
      const parsed = this.parseLLMResponse(llmResponse);
      
      if (parsed.command) {
        await this.sendToMud(parsed.command);
      } else {
        console.log('❌ No valid command found in LLM response');
        console.log('LLM Response:', llmResponse);
      }

    } catch (error) {
      console.error('Error communicating with LLM:', error.message);
      
      // Simple fallback - send 'look' command
      console.log('🔄 Using fallback command: look');
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
    const recentMessages = this.conversationHistory.slice(-(this.maxHistoryLength - 1));
    
    this.conversationHistory = [systemPrompt, ...recentMessages];
    
    if (this.debug) {
      console.log(`Truncated conversation history to ${this.conversationHistory.length} messages`);
    }
  }

  /**
   * Get conversation history summary for debugging
   */
  getConversationSummary() {
    return this.conversationHistory.map((msg, index) => 
      `${index + 1}. ${msg.role}: ${msg.content.substring(0, 100)}...`
    ).join('\n');
  }

  /**
   * Parse LLM response and extract plan, reasoning, and command
   */
  parseLLMResponse(llmResponse) {
    console.log('\n=== LLM RESPONSE ===');
    console.log(`💭 Context: ${this.conversationHistory.length} messages in conversation history`);
    
    // Extract plan if present
    const planMatch = llmResponse.match(/\*\*Plan\*\*:?\s*(.*?)(?=\n\*\*|$)/is);
    const plan = planMatch ? planMatch[1].trim() : null;
    
    // Extract next step/reasoning
    const stepMatch = llmResponse.match(/\*\*(?:Next Step|Command|Action)\*\*:?\s*(.*?)(?=\n\*\*|```|$)/is);
    const nextStep = stepMatch ? stepMatch[1].trim() : null;
    
    // Extract command from telnet code block
    const command = this.extractCommand(llmResponse);
    
    // Display the parsed information
    if (plan) {
      console.log('📋 Plan:', plan);
    }
    
    if (nextStep) {
      console.log('➡️  Next Step:', nextStep);
    }
    
    if (command) {
      // Validate command is single line
      const commandLines = command.split('\n').filter(line => line.trim());
      if (commandLines.length > 1) {
        console.log('❌ REJECTED: Command contains multiple lines');
        console.log('Command was:', command);
        return { plan, nextStep, command: null };
      }
      
      console.log('🎮 Command:', command);
    } else {
      console.log('❌ No command found in telnet block');
    }
    
    console.log('===================\n');
    
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
      console.error('Cannot send command: not connected to MUD');
      return;
    }

    try {
      console.log('🚀 SENDING TO MUD:', command);
      
      await this.telnetSocket.send(command);
      
      // Store the command for context
      this.messageHistory.push({
        type: 'command_sent',
        content: command,
        timestamp: new Date()
      });

      // Add a small delay to avoid flooding
      await this.sleep(this.config.behavior?.commandDelayMs || 2000);

    } catch (error) {
      console.error('Error sending command to MUD:', error);
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
        console.error('Error disconnecting from MUD:', error);
      }
    }
    this.isConnected = false;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MudClient;