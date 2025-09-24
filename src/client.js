/**
 * Simple MUD Client
 * Connects LLM directly to MUD with minimal processing
 */

const { TelnetSocket } = require('telnet-client');
const axios = require('axios');

class MudClient {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.debug = options.debug || false;
    
    this.telnetSocket = null;
    this.isConnected = false;
    this.messageHistory = [];
    
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
    return new Promise((resolve, reject) => {
      this.telnetSocket = new TelnetSocket();
      
      const connectionParams = {
        host: this.config.mud.host,
        port: this.config.mud.port,
        timeout: 10000,
        negotiationMandatory: false,
        irs: '\r\n',
        ors: '\r\n'
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
        reject(error);
      });
      
      this.telnetSocket.connect(connectionParams)
        .then(() => {
          this.isConnected = true;
          resolve();
        })
        .catch(reject);
    });
  }

  /**
   * Handle output from the MUD
   */
  async handleMudOutput(data) {
    const output = data.toString();
    
    if (this.debug) {
      console.log('MUD OUTPUT:', output);
    }
    
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
      // Build the conversation context
      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `MUD Output:\n${mudOutput}\n\nWhat is your next command?` }
      ];

      if (this.debug) {
        console.log('Sending to LLM:', mudOutput);
      }

      const response = await this.httpClient.post('/api/chat', {
        model: this.config.ollama.model,
        messages: messages,
        options: {
          temperature: this.config.ollama.temperature || 0.7
        },
        stream: false
      });

      const llmResponse = response.data.message.content;
      
      if (this.debug) {
        console.log('LLM Response:', llmResponse);
      }

      // Extract command from LLM response
      const command = this.extractCommand(llmResponse);
      
      if (command) {
        await this.sendToMud(command);
      } else {
        console.log('No command found in LLM response:', llmResponse);
      }

    } catch (error) {
      console.error('Error communicating with LLM:', error.message);
      
      // Simple fallback - send 'look' command
      await this.sendToMud('look');
    }
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
      console.log('SENDING TO MUD:', command);
      
      await this.telnetSocket.write(command + '\r\n');
      
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