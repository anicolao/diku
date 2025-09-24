#!/usr/bin/env node

/**
 * Color test script to demonstrate the TUI backgrounds
 * Shows the different panels with their updated black backgrounds
 */

const TUI = require('./src/tui');

async function colorTest() {
  console.log('Testing TUI with dark backgrounds...');
  console.log('This will demonstrate the panels with black backgrounds as requested.');
  console.log('Press Ctrl+C to exit\n');
  
  const tui = new TUI();
  
  // Add content to demonstrate the backgrounds
  tui.showMudOutput('=== MAIN MUD PANEL (BLACK BACKGROUND) ===');
  tui.showMudOutput('This panel now has an explicit black background (ANSI 0)');
  tui.showMudOutput('Text appears in green on black as requested');
  tui.showMudOutput('The background should be pure black');
  
  tui.showLLMStatus({
    contextInfo: 'Status panel keeps blue background',
    plan: 'This panel maintains its blue background for contrast',
    nextStep: 'Only game and input panels have black backgrounds'
  });
  
  tui.showDebug('=== DEBUG PANEL (BLACK BACKGROUND) ===');
  tui.showDebug('This debug panel has explicit black background (ANSI 0)');
  tui.showDebug('Yellow text on black background');
  tui.showDebug('Background should be pure black');
  
  tui.updateInputStatus('=== BOTTOM INPUT PANEL (BLACK BACKGROUND) ===\nThis input panel has explicit black background (ANSI 0)\nWhite text on black background as requested\n\nPress Ctrl+C to exit');
  
  // Keep running
  setInterval(() => {}, 1000);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nColor test completed.');
  process.exit(0);
});

colorTest().catch(console.error);