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