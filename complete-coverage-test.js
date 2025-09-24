#!/usr/bin/env node

/**
 * Test script to verify white titles and complete screen coverage
 */

const TUI = require('./src/tui');

async function completeCoverageTest() {
  console.log('Testing TUI with white titles and complete screen coverage...');
  console.log('Checking for:');
  console.log('1. Titles/labels should be bright-white on blue background');
  console.log('2. ALL screen real estate should have blue background');
  console.log('3. No empty/uncovered terminal space visible');
  console.log('Press Ctrl+C to exit\n');
  
  const tui = new TUI();
  
  // Test title visibility and complete coverage
  tui.showMudOutput('=== WHITE TITLES & COMPLETE COVERAGE TEST ===');
  tui.showMudOutput('Panel titles should now be BRIGHT WHITE on BLUE');
  tui.showMudOutput('Check that ALL screen areas have blue background:');
  tui.showMudOutput('- Inside panels: blue');
  tui.showMudOutput('- Panel borders: blue');
  tui.showMudOutput('- Panel titles/labels: white text on blue');
  tui.showMudOutput('- Empty space around panels: blue');
  tui.showMudOutput('- Entire screen coverage: blue everywhere!');
  
  tui.showLLMStatus({
    contextInfo: 'Verifying complete visual coverage',
    plan: 'All titles should be white on blue background',
    nextStep: 'All empty screen space should be blue',
    command: 'look'
  });
  
  tui.showDebug('=== TITLE & COVERAGE VERIFICATION ===');
  tui.showDebug('Label style.fg = bright-white');
  tui.showDebug('Label style.bg = blue');
  tui.showDebug('Background element covers entire screen');
  tui.showDebug('Screen style.bg = blue with fg = white');
  tui.showDebug('No uncovered terminal areas remain');
  
  tui.updateInputStatus('=== COMPLETE COVERAGE VERIFICATION ===\n\nAll titles/labels should be BRIGHT WHITE on BLUE:\n✓ MUD Interaction title\n✓ LLM Status & Plans title\n✓ Debug Messages title\n✓ User Input / Approval title\n\nAll screen areas should be BLUE:\n✓ Panel backgrounds\n✓ Border backgrounds\n✓ Empty space beyond borders\n✓ Entire terminal coverage\n\nPress Ctrl+C to exit');
  
  // Keep running
  setInterval(() => {}, 1000);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nComplete coverage test completed.');
  process.exit(0);
});

completeCoverageTest().catch(console.error);