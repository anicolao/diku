#!/usr/bin/env node

/**
 * Test script to verify the blue theme is working across all panels
 */

const TUI = require('./src/tui');

async function blueThemeTest() {
  console.log('Testing TUI with uniform blue background theme...');
  console.log('All panels should now have blue backgrounds with cyan borders.');
  console.log('Press Ctrl+C to exit\n');
  
  const tui = new TUI();
  
  // Test all panels with blue backgrounds
  tui.showMudOutput('=== MUD PANEL (BLUE BACKGROUND) ===');
  tui.showMudOutput('This panel now has a blue background with cyan border');
  tui.showMudOutput('White text on blue background for good contrast');
  tui.showMudOutput('Welcome to Arctic MUD!');
  tui.showMudOutput('You are in a dimly lit chamber.');
  
  tui.showLLMStatus({
    contextInfo: 'Status panel maintains blue background',
    plan: 'All panels now use consistent blue theme',
    nextStep: 'Uniform appearance across the interface',
    command: 'look'
  });
  
  tui.showDebug('=== DEBUG PANEL (BLUE BACKGROUND) ===');
  tui.showDebug('This debug panel now has blue background with cyan border');
  tui.showDebug('Yellow text on blue background');
  tui.showDebug('Connected to MUD');
  tui.showDebug('Theme: Uniform blue across all panels');
  
  tui.updateInputStatus('=== INPUT PANEL (BLUE BACKGROUND) ===\nThis input panel now has blue background with cyan border\nWhite text on blue background\n\nAll panels should now look consistent with blue backgrounds\nPress Ctrl+C to exit');
  
  // Keep running
  setInterval(() => {}, 1000);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nBlue theme test completed.');
  process.exit(0);
});

blueThemeTest().catch(console.error);