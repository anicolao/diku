#!/usr/bin/env node

/**
 * Test script to verify fixes for random characters in content areas
 */

const TUI = require('./src/tui.js');

console.log('Testing TUI content rendering fixes...');

const tui = new TUI({ commandDelayMs: 2000 });

// Test LLM status with various content types that could cause issues
setTimeout(() => {
  console.log('Testing LLM status with complex content...');
  
  // Test 1: Normal content
  tui.showLLMStatus({
    contextInfo: 'Testing normal content without issues',
    plan: 'Simple plan with basic text',
    nextStep: 'Next step with regular characters',
    command: 'look'
  });
  
  setTimeout(() => {
    // Test 2: Content that previously could cause issues
    tui.showLLMStatus({
      contextInfo: 'Context with special characters and symbols @#$%^&*()',
      plan: 'Plan with quotes "test" and apostrophes \'test\' and brackets [test]',
      nextStep: 'Next step with numbers 12345 and mixed Text123',
      command: 'north',
      error: 'Error message with multiple words and punctuation!'
    });
    
    setTimeout(() => {
      // Test 3: Longer content that could accumulate
      for (let i = 0; i < 10; i++) {
        tui.showLLMStatus({
          plan: `Iteration ${i}: Testing content accumulation over multiple updates`,
          command: `test${i}`
        });
      }
      
      setTimeout(() => {
        // Test input panel
        console.log('Testing input status updates...');
        for (let i = 0; i < 5; i++) {
          tui.updateInputStatus(`Input update ${i}: Testing input panel rendering`);
        }
        
        setTimeout(() => {
          // Test debug panel  
          console.log('Testing debug message rendering...');
          for (let i = 0; i < 5; i++) {
            tui.showDebug(`Debug message ${i}: Testing debug panel rendering`);
          }
          
          console.log('✅ Test completed. Check for clean content rendering.');
          console.log('Press Ctrl+C to exit.');
          
        }, 1000);
      }, 2000);
    }, 1000);
  }, 1000);
}, 500);