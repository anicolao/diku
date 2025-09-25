/**
 * Tests for LLM request queuing functionality
 */

const MudClient = require('../src/client');

// Mock TUI module to avoid blessed screen creation during testing
jest.mock('../src/tui', () => {
  return jest.fn().mockImplementation(() => ({
    showDebug: jest.fn(),
    showMudOutput: jest.fn(),
    showLLMStatus: jest.fn(),
    showMudInput: jest.fn(),
    updateInputStatus: jest.fn(),
    waitForApproval: jest.fn().mockResolvedValue(),
    destroy: jest.fn(),
  }));
});

describe('LLM Request Queuing', () => {
  let client;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      mud: {
        host: 'test.host',
        port: 1234,
      },
      llm: {
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'test-model',
        },
      },
    };

    client = new MudClient(mockConfig, { debug: true });
  });

  afterEach(() => {
    if (client && client.tui) {
      client.tui.destroy();
    }
  });

  test('should initialize with empty queue and no pending requests', () => {
    expect(client.llmRequestPending).toBe(false);
    expect(client.mudOutputQueue).toEqual([]);
  });

  test('should queue messages when LLM request is pending', async () => {
    // Set LLM request as pending
    client.llmRequestPending = true;

    // Simulate MUD output
    const testOutput = 'Test MUD output';
    
    // Mock the data object that handleMudOutput expects
    const mockData = {
      toString: () => testOutput
    };

    await client.handleMudOutput(mockData);

    // Check that message was queued
    expect(client.mudOutputQueue).toContain(testOutput);
    expect(client.mudOutputQueue.length).toBe(1);
  });

  test('should not queue messages when LLM request is not pending', async () => {
    // Ensure LLM request is not pending
    client.llmRequestPending = false;
    
    // Mock sendToLLM to prevent actual LLM calls
    const sendToLLMSpy = jest.spyOn(client, 'sendToLLM').mockResolvedValue();

    // Simulate MUD output
    const testOutput = 'Test MUD output';
    const mockData = {
      toString: () => testOutput
    };

    await client.handleMudOutput(mockData);

    // Check that message was not queued but sent to LLM
    expect(client.mudOutputQueue.length).toBe(0);
    expect(sendToLLMSpy).toHaveBeenCalledWith(testOutput);

    sendToLLMSpy.mockRestore();
  });

  test('should prevent concurrent LLM requests', async () => {
    // Mock HTTP client to prevent actual API calls
    client.httpClient = {
      post: jest.fn().mockResolvedValue({
        data: {
          message: {
            content: '<command>look</command>'
          }
        }
      })
    };

    // Mock sendToMud to prevent actual MUD communication
    const sendToMudSpy = jest.spyOn(client, 'sendToMud').mockResolvedValue();

    // Start first LLM request
    const firstRequest = client.sendToLLM('First message');
    expect(client.llmRequestPending).toBe(true);

    // Try to start second LLM request while first is pending
    const secondRequest = client.sendToLLM('Second message');

    // Wait for both to complete
    await Promise.all([firstRequest, secondRequest]);

    // Verify that only one HTTP request was made
    expect(client.httpClient.post).toHaveBeenCalledTimes(1);
    expect(sendToMudSpy).toHaveBeenCalledTimes(1);

    sendToMudSpy.mockRestore();
  });

  test('should process queued messages after LLM request completes', async () => {
    // Mock HTTP client
    client.httpClient = {
      post: jest.fn().mockResolvedValue({
        data: {
          message: {
            content: '<command>look</command>'
          }
        }
      })
    };

    // Mock sendToMud to prevent actual MUD communication
    const sendToMudSpy = jest.spyOn(client, 'sendToMud').mockResolvedValue();

    // Queue some messages
    client.mudOutputQueue = ['Message 1', 'Message 2', 'Message 3'];

    // Process the queue
    await client.processQueuedMessages();

    // Verify queue was cleared and combined message was sent to LLM
    expect(client.mudOutputQueue.length).toBe(0);
    expect(client.httpClient.post).toHaveBeenCalledTimes(1);
    
    // Check that the conversation history contains the combined message as a tool message
    const toolMessages = client.conversationHistory.filter(msg => msg.role === 'tool');
    const lastToolMessage = toolMessages[toolMessages.length - 1];
    expect(lastToolMessage.content).toBe('Message 1\nMessage 2\nMessage 3');

    sendToMudSpy.mockRestore();
  });

  test('should handle empty queue gracefully', async () => {
    // Ensure queue is empty
    client.mudOutputQueue = [];

    // Mock sendToLLM to track calls
    const sendToLLMSpy = jest.spyOn(client, 'sendToLLM').mockResolvedValue();

    await client.processQueuedMessages();

    // Verify no LLM call was made for empty queue
    expect(sendToLLMSpy).not.toHaveBeenCalled();

    sendToLLMSpy.mockRestore();
  });
});