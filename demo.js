#!/usr/bin/env node

/**
 * Demo script to showcase the new TUI interface
 * This demonstrates the fancy TUI layout without connecting to external services
 */

const TUI = require('./src/tui');

async function runDemo() {
  const tui = new TUI();
  
  tui.showDebug('Starting TUI Demo...');
  tui.showDebug('Press Ctrl+C to exit');
  
  // Simulate MUD connection
  tui.updateInputStatus('Demo mode: Showcasing TUI layout');
  
  // Show some sample MUD output
  tui.showMudOutput('Welcome to Arctic MUD!\n\nYou are standing in a dimly lit chamber.');
  
  // Show LLM status information
  tui.showLLMStatus({
    contextInfo: 'Demo conversation with 5 messages',
    plan: 'Create a character and explore the starting area',
    nextStep: 'Look around to understand the environment',
    command: 'look'
  });
  
  // Show some debug messages
  tui.showDebug('Connected to demo MUD server');
  tui.showDebug('LLM model: demo-model');
  tui.showDebug('Response time: 1.2s');
  
  // Simulate more interaction
  setTimeout(() => {
    tui.showMudOutput('\nA small door leads north.\nThere is a rusty key here.');
    
    tui.showLLMStatus({
      contextInfo: 'Processing new room information',
      plan: 'Pick up the key and explore north',
      nextStep: 'Get the key first',
      command: 'get key'
    });
    
    tui.showDebug('Parsed room description: door=north, item=rusty_key');
  }, 2000);
  
  // Wait for approval demo
  setTimeout(async () => {
    tui.showDebug('Waiting for user approval...');
    await tui.waitForApproval('Ready to send command: get key');
    
    tui.showMudOutput('\nYou pick up the rusty key.\n\nInventory: rusty key');
    
    tui.showLLMStatus({
      contextInfo: 'Command executed successfully',
      plan: 'Now explore north with the key',
      nextStep: 'Move to the next room',
      command: 'north'
    });
    
    tui.updateInputStatus('Demo completed! Press Ctrl+C to exit');
  }, 4000);
  
  // Keep the demo running
  setInterval(() => {}, 1000);
}

// Handle cleanup
process.on('SIGINT', () => {
  process.stderr.write('\nExiting demo...\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.stderr.write('\nExiting demo...\n');
  process.exit(0);
});

runDemo().catch((error) => {
  process.stderr.write('Demo error: ' + error + '\n');
  process.exit(1);
});