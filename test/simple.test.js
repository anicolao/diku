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
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'llama2',
        temperature: 0.7
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
      expect(client.maxHistoryLength).toBe(10);
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
      client.maxTokens = 1000; // Set small token limit for testing
      
      // Add messages with large content to exceed token limit
      const largeMessage = 'a'.repeat(300); // ~75 tokens each
      for (let i = 0; i < 10; i++) {
        client.conversationHistory.push({ role: 'user', content: `${largeMessage}_${i}` });
      }
      
      // Should have 11 messages total (1 system + 10 user)
      expect(client.conversationHistory).toHaveLength(11);
      const initialTokens = client.calculateTotalTokens();
      expect(initialTokens).toBeGreaterThan(1000);
      
      // Truncate
      client.truncateConversationHistory();
      
      // Should have fewer messages and be under token limit
      expect(client.conversationHistory.length).toBeLessThan(11);
      expect(client.conversationHistory[0].role).toBe('system');
      const finalTokens = client.calculateTotalTokens();
      expect(finalTokens).toBeLessThanOrEqual(1000);
    });

    test('should estimate tokens correctly', () => {
      client = new MudClient(mockConfig);
      
      // Test token estimation
      expect(client.estimateTokens('')).toBe(0);
      expect(client.estimateTokens('hello')).toBe(2); // 5 chars / 4 = 1.25, rounded up to 2
      expect(client.estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75, rounded up to 3
      expect(client.estimateTokens('a'.repeat(100))).toBe(25); // 100 chars / 4 = 25
    });

    test('should extract commands from LLM response', () => {
      client = new MudClient(mockConfig);
      
      // Test <command> block extraction (preferred format)
      const response0 = 'I will create a character.\n\n<command>\nlook\n</command>';
      expect(client.extractCommand(response0)).toBe('look');
      
      // Test telnet code block extraction (legacy)
      const response1 = 'I will create a character.\n\n```telnet\nlook\n```';
      expect(client.extractCommand(response1)).toBe('look');

      // Test regular code block extraction (fallback)
      const response2 = 'Let me examine the area.\n\n```\nexamine room\n```';
      expect(client.extractCommand(response2)).toBe('examine room');

      // Test no command block
      const response3 = 'I need to think about this.';
      expect(client.extractCommand(response3)).toBe(null);
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

    test('should support backward compatibility with markdown-style Plan headers', () => {
      client = new MudClient(mockConfig);
      
      const legacyResponse = `**Plan**: Legacy plan format test
      
<command>
look
</command>`;
      
      const result = client.parseLLMResponse(legacyResponse);
      expect(result.plan).toBe('Legacy plan format test');
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

    test('should handle debug mode', () => {
      client = new MudClient(mockConfig, { debug: true });
      expect(client.debug).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should load config.json with new format', () => {
      const config = require('../config.example.json');
      expect(config.llm.ollama.baseUrl).toBe('http://localhost:11434');
      expect(config.llm.openai.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.mud.host).toBe('arctic.org');
      expect(config.mud.port).toBe(2700);
    });

    test('should support backward compatibility with old config format', () => {
      const legacyConfig = {
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7
        },
        mud: {
          host: 'arctic.org',
          port: 2700
        },
        behavior: {
          commandDelayMs: 1000
        }
      };

      client = new MudClient(legacyConfig);
      expect(client.llmProvider).toBe('ollama');
      expect(client.llmConfig.baseUrl).toBe('http://localhost:11434');
      expect(client.llmConfig.model).toBe('llama2');
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