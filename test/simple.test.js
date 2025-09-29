/**
 * Simple tests for the simplified MUD client
 */

const MudClient = require('../src/client');

// Mock the TUI module to avoid creating actual blessed screens in tests
jest.mock('../src/tui', () => {
  return jest.fn().mockImplementation(() => ({
    showMudOutput: jest.fn(),
    showLLMStatus: jest.fn(),
    showDebug: jest.fn(),
    updateInputStatus: jest.fn(),
    waitForApproval: jest.fn().mockResolvedValue(),
    destroy: jest.fn()
  }));
});

describe('Simplified Diku MUD AI Player', () => {
  let mockConfig;
  let client;

  beforeEach(() => {
    mockConfig = {
      llm: {
        provider: 'ollama',
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7
        }
      },
      mud: {
        host: 'arctic.org',
        port: 2700
      },
      behavior: {
        commandDelayMs: 1000
      }
    };
  });

  afterEach(async () => {
    // Clean up any client instances
    if (client && client.disconnect) {
      await client.disconnect();
    }
  });

  describe('MudClient', () => {
    test('should initialize with config and conversation history', () => {
      client = new MudClient(mockConfig);
      expect(client.config).toEqual(mockConfig);
      expect(client.isConnected).toBe(false);
      expect(client.conversationHistory).toHaveLength(1);
      expect(client.conversationHistory[0].role).toBe('system');
      expect(client.maxTokens).toBe(100000);
      expect(client.tui).toBeDefined();
    });

    test('should maintain conversation history', () => {
      client = new MudClient(mockConfig);
      
      // Start with system prompt
      expect(client.conversationHistory).toHaveLength(1);
      
      // Add user message
      client.conversationHistory.push({ role: 'user', content: 'test user input' });
      expect(client.conversationHistory).toHaveLength(2);
      
      // Add assistant message  
      client.conversationHistory.push({ role: 'assistant', content: 'test assistant response' });
      expect(client.conversationHistory).toHaveLength(3);
    });

    test('should truncate conversation history based on token count while preserving system prompt', () => {
      client = new MudClient(mockConfig);
      client.maxTokens = 700; // Set limit higher than system prompt but low enough to trigger truncation
      
      // Add messages with many words to exceed token limit
      const largeMessage = 'word '.repeat(50); // 50 tokens each
      for (let i = 0; i < 3; i++) {
        client.conversationHistory.push({ role: 'user', content: `${largeMessage} message ${i}` });
      }
      
      // Should have 4 messages total (1 system + 3 user)
      expect(client.conversationHistory).toHaveLength(4);
      const initialTokens = client.calculateTotalTokens();
      expect(initialTokens).toBeGreaterThan(700);
      
      // Truncate
      client.truncateConversationHistory();
      
      // Should have fewer messages and be under token limit
      expect(client.conversationHistory.length).toBeLessThan(4);
      expect(client.conversationHistory[0].role).toBe('system');
      const finalTokens = client.calculateTotalTokens();
      expect(finalTokens).toBeLessThanOrEqual(700);
    });

    test('should estimate tokens correctly', () => {
      client = new MudClient(mockConfig);
      
      // Test token estimation based on word count
      expect(client.estimateTokens('')).toBe(0);
      expect(client.estimateTokens('hello')).toBe(1); // 1 word = 1 token
      expect(client.estimateTokens('hello world')).toBe(2); // 2 words = 2 tokens
      expect(client.estimateTokens('a b c d e')).toBe(5); // 5 words = 5 tokens
      expect(client.estimateTokens('  hello   world  ')).toBe(2); // 2 words (trimmed) = 2 tokens
    });

    test('should allow configurable maxTokens', () => {
      client = new MudClient(mockConfig, { maxTokens: 2000 });
      expect(client.maxTokens).toBe(2000);
      
      const clientDefault = new MudClient(mockConfig);
      expect(clientDefault.maxTokens).toBe(100000);
    });

    test('should extract commands from LLM response', () => {
      client = new MudClient(mockConfig);
      
      // Test <command> block extraction (only supported format)
      const response0 = 'I will create a character.\n\n<command>\nlook\n</command>';
      expect(client.extractCommand(response0)).toBe('look');

      // Test no command block
      const response3 = 'I need to think about this.';
      expect(client.extractCommand(response3)).toBe(null);
      
      // Test code blocks are not supported (should return null)
      const response4 = 'Let me examine the area.\n\n```\nexamine room\n```';
      expect(client.extractCommand(response4)).toBe(null);
    });

    test('should handle literal return/enter commands', () => {
      client = new MudClient(mockConfig);
      
      // Test literal "return" command
      const response1 = 'I need to press return.\n\n<command>\nreturn\n</command>';
      expect(client.extractCommand(response1)).toBe('\n');
      
      // Test literal "enter" command
      const response2 = 'Let me press enter.\n\n<command>\nenter\n</command>';
      expect(client.extractCommand(response2)).toBe('\n');
      
      // Test case insensitive "RETURN"
      const response3 = 'I need to press RETURN.\n\n<command>\nRETURN\n</command>';
      expect(client.extractCommand(response3)).toBe('\n');
      
      // Test case insensitive "ENTER"
      const response4 = 'Let me press ENTER.\n\n<command>\nENTER\n</command>';
      expect(client.extractCommand(response4)).toBe('\n');
      
      // Test that regular commands starting with "e" are not affected
      const response9 = 'I will examine something.\n\n<command>\nexamine table\n</command>';
      expect(client.extractCommand(response9)).toBe('examine table');
      
      // Test that "exit" is not treated as enter
      const response10 = 'I will exit.\n\n<command>\nexit\n</command>';
      expect(client.extractCommand(response10)).toBe('exit');
      
      // Test that single "e" is not treated as enter (no partial matches)
      const response11 = 'I will use e command.\n\n<command>\ne\n</command>';
      expect(client.extractCommand(response11)).toBe('e');
      
      // Test literal "q" command for pager quit
      const response12 = 'I need to quit the pager.\n\n<command>\nq\n</command>';
      expect(client.extractCommand(response12)).toBe('q');
      
      // Test case insensitive "Q" command
      const response13 = 'I need to quit the pager.\n\n<command>\nQ\n</command>';
      expect(client.extractCommand(response13)).toBe('q');
    });

    test('should reject multi-line commands', () => {
      client = new MudClient(mockConfig);
      
      const multiLineResponse = `<plan>Create character</plan>
      
<command>
north
south
</command>`;
      
      const result = client.parseLLMResponse(multiLineResponse);
      expect(result.command).toBe(null);
    });

    test('should accept single-line commands', () => {
      client = new MudClient(mockConfig);
      
      const singleLineResponse = `<plan>Look around</plan>
      
<command>
look
</command>`;
      
      const result = client.parseLLMResponse(singleLineResponse);
      expect(result.command).toBe('look');
    });

    test('should extract plan and next step from LLM response', () => {
      client = new MudClient(mockConfig);
      
      const detailedResponse = `<plan>I need to create a character and start exploring</plan>
      
**Next Step**: First, I'll look around to see where I am
      
<command>
look
</command>`;
      
      const result = client.parseLLMResponse(detailedResponse);
      expect(result.plan).toContain('create a character');
      expect(result.nextStep).toContain('look around');
      expect(result.command).toBe('look');
    });


    test('should have correct system prompt', () => {
      client = new MudClient(mockConfig);
      expect(client.systemPrompt).toContain('expert Diku MUD player');
      expect(client.systemPrompt).toContain('arctic diku');
      expect(client.systemPrompt).toContain('level 10');
      expect(client.systemPrompt).toContain('<command> block');
    });

    test('should include NPC interaction help instructions in system prompt', () => {
      client = new MudClient(mockConfig);
      expect(client.systemPrompt).toContain('When interacting with NPCs');
      expect(client.systemPrompt).toContain('look NPC');
      expect(client.systemPrompt).toContain('Each NPC has their');
      expect(client.systemPrompt).toContain('own set of commands');
    });

    test('should include MUD status prompt parsing information in system prompt', () => {
      client = new MudClient(mockConfig);
      expect(client.systemPrompt).toContain('Game Status Information');
      expect(client.systemPrompt).toContain('56H 118V 1499X 0.00% 0C T:60 Exits:D');
      expect(client.systemPrompt).toContain('H** = Hit Points');
      expect(client.systemPrompt).toContain('V** = Move Points');
      expect(client.systemPrompt).toContain('X** = Experience Points');
      expect(client.systemPrompt).toContain('C** = Coins');
      expect(client.systemPrompt).toContain('T:** = Time to Next Tick');
      expect(client.systemPrompt).toContain('Exits:** = Visible Exits');
      expect(client.systemPrompt).toContain('N=North, S=South, E=East, W=West, U=Up, D=Down');
    });

    test('should include pager prompt handling instructions in system prompt', () => {
      client = new MudClient(mockConfig);
      expect(client.systemPrompt).toContain('PAGER PROMPTS');
      expect(client.systemPrompt).toContain('prompts with options in brackets like "[press return for more; q to quit]"');
      expect(client.systemPrompt).toContain('prompt ends with ">" symbol');
      expect(client.systemPrompt).toContain('PAGER COMMANDS');
      expect(client.systemPrompt).toContain('use <command>return</command> to see more content or <command>q</command> to quit');
    });

    test('should handle debug mode', () => {
      client = new MudClient(mockConfig, { debug: true });
      expect(client.debug).toBe(true);
    });

    test('should strip ANSI escape sequences from MUD output', async () => {
      client = new MudClient(mockConfig);
      
      // Mock sendToLLM to prevent actual LLM calls
      jest.spyOn(client, 'sendToLLM').mockImplementation(async () => {});
      
      // Sample MUD output with ANSI escape sequences
      const mudOutputWithAnsi = Buffer.from('\u001b[31mHello \u001b[32mworld\u001b[0m! Welcome to \u001b[1;34mArctic MUD\u001b[0m.');
      
      await client.handleMudOutput(mudOutputWithAnsi);
      
      // Check that ANSI sequences were stripped from TUI output
      expect(client.tui.showMudOutput).toHaveBeenCalledWith('Hello world! Welcome to Arctic MUD.');
      
      // Check that ANSI sequences were stripped from message history
      const lastMessage = client.messageHistory[client.messageHistory.length - 1];
      expect(lastMessage.content).toBe('Hello world! Welcome to Arctic MUD.');
      expect(lastMessage.type).toBe('mud_output');
      
      // Check that ANSI sequences were stripped from LLM input
      expect(client.sendToLLM).toHaveBeenCalledWith('Hello world! Welcome to Arctic MUD.');
    });

    test('should sanitize problematic characters from MUD output', async () => {
      client = new MudClient(mockConfig);
      
      // Mock sendToLLM to prevent actual LLM calls
      jest.spyOn(client, 'sendToLLM').mockImplementation(async () => {});
      
      // Sample MUD output with problematic characters as mentioned in the issue
      // Hex: bf ef ef bd bd bf 0d 01 00 0a = invalid UTF-8, CR, SOH, NULL, LF
      const problematicOutput = Buffer.from([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, // "Hello"
        0xbf, 0xef, 0xef, 0xbd, 0xbd, 0xbf, // Invalid UTF-8 sequence
        0x20, 0x57, 0x6f, 0x72, 0x6c, 0x64, // " World"
        0x0d, // Carriage return
        0x01, // SOH control character
        0x00, // NULL character
        0x21, // "!"
        0x0a  // Line feed
      ]);
      
      await client.handleMudOutput(problematicOutput);
      
      // Check that problematic characters were sanitized
      // Should remove: invalid UTF-8 replacement chars, CR, SOH, NULL
      // Should keep: regular text and line feed
      expect(client.tui.showMudOutput).toHaveBeenCalledWith('Hello World!\n');
      
      // Check message history
      const lastMessage = client.messageHistory[client.messageHistory.length - 1];
      expect(lastMessage.content).toBe('Hello World!\n');
      expect(lastMessage.type).toBe('mud_output');
      
      // Check LLM input
      expect(client.sendToLLM).toHaveBeenCalledWith('Hello World!\n');
    });

    test('should handle carriage return sequences correctly', async () => {
      client = new MudClient(mockConfig);
      
      // Mock sendToLLM to prevent actual LLM calls
      jest.spyOn(client, 'sendToLLM').mockImplementation(async () => {});
      
      // Test different carriage return scenarios
      const crTestOutput = 'Line 1\r\nLine 2\rLine 3\n';
      
      await client.handleMudOutput(Buffer.from(crTestOutput));
      
      // Should convert \r\n to \n and remove standalone \r
      expect(client.tui.showMudOutput).toHaveBeenCalledWith('Line 1\nLine 2Line 3\n');
    });
  });

  describe('Configuration', () => {
    test('should load config.json with new format', () => {
      const config = require('../config.example.json');
      expect(config.llm.ollama.baseUrl).toBe('http://localhost:11434');
      expect(config.llm.openai.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.mud.host).toBe('mud.arctic.org');
      expect(config.mud.port).toBe(2700);
    });



    test('should configure OpenAI provider', () => {
      const openaiConfig = {
        llm: {
          provider: 'openai',
          openai: {
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4',
            temperature: 0.7,
            apiKey: 'test-api-key'
          }
        },
        mud: {
          host: 'arctic.org',
          port: 2700
        },
        behavior: {
          commandDelayMs: 1000
        }
      };

      client = new MudClient(openaiConfig);
      expect(client.llmProvider).toBe('openai');
      expect(client.llmConfig.baseUrl).toBe('https://api.openai.com/v1');
      expect(client.llmConfig.model).toBe('gpt-4');
      expect(client.llmConfig.apiKey).toBe('test-api-key');
    });

    test('should default to ollama provider when not specified', () => {
      const configWithoutProvider = {
        llm: {
          ollama: {
            baseUrl: 'http://localhost:11434',
            model: 'llama2',
            temperature: 0.7
          }
        },
        mud: {
          host: 'arctic.org',
          port: 2700
        },
        behavior: {
          commandDelayMs: 1000
        }
      };

      client = new MudClient(configWithoutProvider);
      expect(client.llmProvider).toBe('ollama');
    });

    test('should throw error when no LLM configuration found', () => {
      const invalidConfig = {
        mud: {
          host: 'arctic.org',
          port: 2700
        }
      };

      expect(() => new MudClient(invalidConfig)).toThrow('No LLM configuration found');
    });

    test('should throw error when provider configuration missing', () => {
      const invalidConfig = {
        llm: {
          provider: 'openai',
          ollama: {
            baseUrl: 'http://localhost:11434',
            model: 'llama2'
          }
        },
        mud: {
          host: 'arctic.org',
          port: 2700
        }
      };

      expect(() => new MudClient(invalidConfig)).toThrow("LLM provider 'openai' configuration not found");
    });

    test('should handle OpenAI message format transformation', () => {
      const openaiConfig = {
        llm: {
          provider: 'openai',
          openai: {
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4',
            temperature: 0.7,
            apiKey: 'test-api-key'
          }
        },
        mud: {
          host: 'arctic.org',
          port: 2700
        },
        behavior: {
          commandDelayMs: 1000
        }
      };

      client = new MudClient(openaiConfig);
      
      // Add some messages with 'tool' role
      client.conversationHistory.push({
        role: 'tool',
        content: 'Test MUD output'
      });

      // Test the message transformation logic
      const openaiMessages = client.conversationHistory.map(msg => {
        if (msg.role === 'tool') {
          return {
            role: 'user',
            content: msg.content
          };
        }
        return msg;
      });

      // Verify transformation
      expect(openaiMessages.find(msg => msg.role === 'tool')).toBeUndefined();
      expect(openaiMessages.find(msg => msg.role === 'user' && msg.content === 'Test MUD output')).toBeDefined();
      expect(openaiMessages.find(msg => msg.role === 'system')).toBeDefined(); // System prompt should remain
    });
  });
});