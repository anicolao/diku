#!/usr/bin/env node

/**
 * Test script to verify the all-blue theme with blue borders
 */

const TUI = require('./src/tui');

async function allBlueThemeTest() {
  console.log('Testing TUI with all-blue theme (blue backgrounds AND blue borders)...');
  console.log('All panels should now have blue backgrounds with blue borders.');
  console.log('Debug panel should use bright-white text.');
  console.log('Press Ctrl+C to exit\n');
  
  const tui = new TUI();
  
  // Test all panels with blue backgrounds and blue borders
  tui.showMudOutput('=== MUD PANEL (BLUE BACKGROUND + BLUE BORDER) ===');
  tui.showMudOutput('This panel has blue background with BLUE border (not cyan)');
  tui.showMudOutput('Bright white text on blue background for good contrast');
  tui.showMudOutput('Welcome to Arctic MUD!');
  tui.showMudOutput('You are in a dimly lit chamber.');
  
  tui.showLLMStatus({
    contextInfo: 'Status panel with blue borders',
    plan: 'All panels now use blue borders instead of cyan',
    nextStep: 'Debug panel uses bright-white text',
    command: 'look'
  });
  
  tui.showDebug('=== DEBUG PANEL (BLUE BACKGROUND + BLUE BORDER) ===');
  tui.showDebug('This debug panel has blue background with BLUE border');
  tui.showDebug('BRIGHT WHITE text on blue background (changed from yellow)');
  tui.showDebug('Connected to MUD');
  tui.showDebug('Theme: All blue with blue borders');
  
  tui.updateInputStatus('=== INPUT PANEL (BLUE BACKGROUND + BLUE BORDER) ===\nThis input panel has blue background with BLUE border\nBright white text on blue background\n\nAll panels now have:\n- Blue backgrounds\n- Blue borders (not cyan)\n- Debug panel uses bright-white text\n\nPress Ctrl+C to exit');
  
  // Keep running
  setInterval(() => {}, 1000);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nAll-blue theme test completed.');
  process.exit(0);
});

allBlueThemeTest().catch(console.error);