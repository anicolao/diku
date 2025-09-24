/**
 * Basic tests for core MUD client components
 */

const OutputParser = require('../src/parser/outputParser');
const GameState = require('../src/state/gameState');
const ActionExecutor = require('../src/executor/executor');
const config = require('../src/utils/config');
const logger = require('../src/utils/logger');

describe('Diku MUD AI Player Core Components', () => {
  beforeAll(async () => {
    // Initialize configuration for tests
    await config.initialize('config.example.json');
    logger.init({ level: 'error', console: false }); // Suppress logs in tests
  });

  describe('OutputParser', () => {
    let parser;

    beforeEach(() => {
      parser = new OutputParser();
    });

    test('should parse basic prompt correctly', async () => {
      const input = '<100hp 50m 75mv>';
      const result = await parser.parse(input);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('prompt');
      expect(result[0].health).toBe(100);
      expect(result[0].mana).toBe(50);
      expect(result[0].moves).toBe(75);
    });

    test('should strip ANSI codes', () => {
      const input = '\x1b[31mRed text\x1b[0m';
      const cleaned = parser.stripAnsiCodes(input);
      expect(cleaned).toBe('Red text');
    });

    test('should detect room names', async () => {
      const input = 'A Dark Forest';
      const result = await parser.parse(input);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('room_name');
      expect(result[0].name).toBe('A Dark Forest');
    });

    test('should handle empty input', async () => {
      const result = await parser.parse('');
      expect(result).toHaveLength(0);
    });
  });

  describe('GameState', () => {
    let gameState;

    beforeEach(async () => {
      gameState = new GameState();
      await gameState.initialize();
    });

    test('should initialize with default state', () => {
      const state = gameState.getCurrentState();
      
      expect(state.player.health.current).toBe(100);
      expect(state.player.health.max).toBe(100);
      expect(state.combat.inCombat).toBe(false);
      expect(state.room.name).toBeNull();
    });

    test('should update player stats from prompt', async () => {
      const promptData = {
        type: 'prompt',
        health: 80,
        mana: 60,
        moves: 90
      };

      await gameState.updateFromParsedOutput(promptData);
      const state = gameState.getCurrentState();

      expect(state.player.health.current).toBe(80);
      expect(state.player.mana.current).toBe(60);
      expect(state.player.moves.current).toBe(90);
    });

    test('should update room information', async () => {
      const roomData = {
        type: 'room_name',
        name: 'Test Room'
      };

      await gameState.updateFromParsedOutput(roomData);
      const state = gameState.getCurrentState();

      expect(state.room.name).toBe('Test Room');
      expect(state.session.roomsVisited).toBe(1);
    });

    test('should calculate health percentage correctly', () => {
      gameState.updatePlayerStats({
        health: { current: 75, max: 100 }
      });

      expect(gameState.getHealthPercentage()).toBe(0.75);
      expect(gameState.needsHealing(0.8)).toBe(true);
      expect(gameState.needsHealing(0.7)).toBe(false);
    });

    test('should provide AI context', () => {
      const context = gameState.getContextForAI();

      expect(context).toHaveProperty('player');
      expect(context).toHaveProperty('room');
      expect(context).toHaveProperty('combat');
      expect(context).toHaveProperty('health');
      expect(context).toHaveProperty('mana');
      expect(context).toHaveProperty('session');
    });
  });

  describe('ActionExecutor', () => {
    let executor;
    let mockConnection;

    beforeEach(() => {
      const behaviorConfig = { commandDelayMs: 100 };
      executor = new ActionExecutor(behaviorConfig);
      
      mockConnection = {
        send: jest.fn().mockResolvedValue(undefined)
      };
    });

    test('should convert actions to commands', () => {
      const commands = executor.actionToCommands('look');
      expect(commands).toEqual(['look']);
    });

    test('should handle exploration actions', () => {
      const commands = executor.actionToCommands('explore');
      expect(commands).toHaveLength(1);
      expect(['north', 'south', 'east', 'west', 'up', 'down']).toContain(commands[0]);
    });

    test('should get opposite directions correctly', () => {
      expect(executor.getOppositeDirection('north')).toBe('south');
      expect(executor.getOppositeDirection('east')).toBe('west');
      expect(executor.getOppositeDirection('up')).toBe('down');
    });

    test('should track queue length', () => {
      expect(executor.getQueueLength()).toBe(0);
      executor.commandQueue.push('test');
      expect(executor.getQueueLength()).toBe(1);
    });

    test('should validate commands', () => {
      expect(executor.validateCommand('look')).toBe(true);
      expect(executor.validateCommand('delete something')).toBe(false);
      expect(executor.validateCommand('')).toBe(false);
      expect(executor.validateCommand(null)).toBe(false);
    });
  });

  describe('Configuration System', () => {
    test('should load default configuration', async () => {
      const testConfig = require('../src/utils/config');
      await testConfig.initialize('nonexistent-file.json'); // Should use defaults
      
      expect(testConfig.get('ollama.baseUrl')).toBe('http://localhost:11434');
      expect(testConfig.get('mud.host')).toBe('arctic.org');
      expect(testConfig.get('mud.port')).toBe(2700);
    });

    test('should get nested configuration values', async () => {
      const testConfig = require('../src/utils/config');
      await testConfig.initialize('config.example.json');
      
      expect(testConfig.get('behavior.aggressiveness')).toBe(0.5);
      expect(testConfig.get('logging.level')).toBe('info');
    });

    test('should handle missing configuration gracefully', async () => {
      const testConfig = require('../src/utils/config');
      await testConfig.initialize('config.example.json');
      
      expect(testConfig.get('nonexistent.key', 'default')).toBe('default');
    });
  });
});