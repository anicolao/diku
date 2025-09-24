/**
 * Simple tests for the simplified MUD client
 */

const MudClient = require('../src/client');

describe('Simplified Diku MUD AI Player', () => {
  let mockConfig;

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

  describe('MudClient', () => {
    test('should initialize with config', () => {
      const client = new MudClient(mockConfig);
      expect(client.config).toEqual(mockConfig);
      expect(client.isConnected).toBe(false);
    });

    test('should extract commands from LLM response', () => {
      const client = new MudClient(mockConfig);
      
      // Test telnet code block extraction
      const response1 = 'I will create a character.\n\n```telnet\nlook\n```';
      expect(client.extractCommand(response1)).toBe('look');

      // Test regular code block extraction
      const response2 = 'Let me examine the area.\n\n```\nexamine room\n```';
      expect(client.extractCommand(response2)).toBe('examine room');

      // Test no code block
      const response3 = 'I need to think about this.';
      expect(client.extractCommand(response3)).toBe(null);
    });

    test('should reject multi-line commands', () => {
      const client = new MudClient(mockConfig);
      
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const multiLineResponse = `**Plan**: Create character
      
\`\`\`telnet
north
south
\`\`\``;
      
      const result = client.parseLLMResponse(multiLineResponse);
      expect(result.command).toBe(null);
      
      consoleSpy.mockRestore();
    });

    test('should accept single-line commands', () => {
      const client = new MudClient(mockConfig);
      
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const singleLineResponse = `**Plan**: Look around
      
\`\`\`telnet
look
\`\`\``;
      
      const result = client.parseLLMResponse(singleLineResponse);
      expect(result.command).toBe('look');
      
      consoleSpy.mockRestore();
    });

    test('should extract plan and next step from LLM response', () => {
      const client = new MudClient(mockConfig);
      
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const detailedResponse = `**Plan**: I need to create a character and start exploring
      
**Next Step**: First, I'll look around to see where I am
      
\`\`\`telnet
look
\`\`\``;
      
      const result = client.parseLLMResponse(detailedResponse);
      expect(result.plan).toContain('create a character');
      expect(result.nextStep).toContain('look around');
      expect(result.command).toBe('look');
      
      consoleSpy.mockRestore();
    });

    test('should have correct system prompt', () => {
      const client = new MudClient(mockConfig);
      expect(client.systemPrompt).toContain('expert Diku MUD player');
      expect(client.systemPrompt).toContain('arctic diku');
      expect(client.systemPrompt).toContain('level 10');
      expect(client.systemPrompt).toContain('telnet code block');
    });

    test('should handle debug mode', () => {
      const client = new MudClient(mockConfig, { debug: true });
      expect(client.debug).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should load config.json', () => {
      const config = require('../config.example.json');
      expect(config.ollama.baseUrl).toBe('http://localhost:11434');
      expect(config.mud.host).toBe('arctic.org');
      expect(config.mud.port).toBe(2700);
    });
  });
});