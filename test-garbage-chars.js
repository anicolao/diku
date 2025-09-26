#!/usr/bin/env node

/**
 * Test to reproduce garbage characters in LLM status box
 */

const blessed = require('blessed');
const TUI = require('./src/tui.js');

console.log('Creating TUI to test garbage character issue...');

// Create a TUI instance
const tui = new TUI({ commandDelayMs: 1000 });

// Wait a moment for the UI to initialize
setTimeout(() => {
  console.log('Testing LLM status with potentially problematic content...');
  
  // Test 1: Simple content (should work fine)
  tui.showLLMStatus({
    plan: 'Simple plan without emojis',
    nextStep: 'Simple next step',
    command: 'look'
  });
  
  setTimeout(() => {
    // Test 2: Content with emojis (potential issue)
    tui.showLLMStatus({
      contextInfo: 'Complex context with symbols',
      plan: 'Plan with emoji 🎮 and special chars',
      nextStep: 'Next step with arrow ➡️  symbols',
      command: 'north',
      error: 'Error with warning ❌ symbol'
    });
    
    setTimeout(() => {
      // Test 3: Content with potential control characters
      tui.showLLMStatus({
        plan: 'Plan with\ttab and\nnewline chars',
        nextStep: 'Step with weird chars: \x1b[31mred\x1b[0m',
        command: 'inventory'
      });
      
      setTimeout(() => {
        // Test 4: Very long content that might wrap
        const longText = 'Very long text that might cause wrapping issues and potentially introduce garbage characters when rendered in the terminal interface because blessed.js might not handle very long strings properly especially when they contain special formatting tags and Unicode characters';
        tui.showLLMStatus({
          plan: longText,
          nextStep: longText,
          command: 'look around carefully'
        });
        
        console.log('Test complete. Check the LLM status box for garbage characters.');
        console.log('Press Ctrl+C to exit.');
        
      }, 1000);
    }, 1000);
  }, 1000);
}, 500);

// Keep the process running
process.on('SIGINT', () => {
  tui.destroy();
  process.exit(0);
});