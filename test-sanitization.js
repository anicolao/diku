#!/usr/bin/env node

/**
 * Test sanitization fix for garbage characters in LLM status box
 */

const blessed = require('blessed');
const TUI = require('./src/tui.js');

console.log('Testing sanitization fix for LLM status garbage characters...');

// Create a TUI instance
const tui = new TUI({ commandDelayMs: 2000 });

// Wait a moment for the UI to initialize
setTimeout(() => {
  console.log('Testing problematic content that should now be sanitized...');
  
  // Test 1: Control characters and escape sequences
  tui.showLLMStatus({
    plan: 'Plan with control chars: \x1b[31mred text\x1b[0m and \x07bell',
    nextStep: 'Step with tab\there and newline\nhere',
    command: 'look'
  });
  
  setTimeout(() => {
    // Test 2: Blessed.js markup conflicts
    tui.showLLMStatus({
      contextInfo: 'Context with {dangerous} markup {that could break} rendering',
      plan: 'Plan with {bold} and {red-fg} tags that should be escaped',
      nextStep: 'Next {step} with more {tags}',
      command: 'north'
    });
    
    setTimeout(() => {
      // Test 3: Very long content
      const veryLongText = 'This is an extremely long piece of text that might cause wrapping and rendering issues in the terminal interface when displayed in blessed.js panels because some terminals and blessed.js versions have trouble with very long lines that exceed certain character limits and might introduce garbage characters or strange rendering artifacts when trying to display such content especially if it contains special characters or formatting.';
      tui.showLLMStatus({
        plan: veryLongText,
        nextStep: veryLongText,
        command: 'inventory'
      });
      
      setTimeout(() => {
        // Test 4: Mixed problematic content
        tui.showLLMStatus({
          contextInfo: 'Mixed: \x1b[31m{red}\x1b[0m content with\ttabs',
          plan: 'Complex {plan} with \x07bell and very long text that should be truncated properly without causing rendering issues in the terminal interface',
          nextStep: 'Final {test} step with\nmultiple\nlines and {formatting}',
          command: 'quit',
          error: 'Error with {dangerous} markup and \x1b[31mcolors\x1b[0m'
        });
        
        console.log('Test complete. Check if LLM status box displays cleanly without garbage characters.');
        console.log('Press Ctrl+C to exit.');
        
      }, 2000);
    }, 2000);
  }, 2000);
}, 500);

// Keep the process running
process.on('SIGINT', () => {
  tui.destroy();
  process.exit(0);
});