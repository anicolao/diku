#!/usr/bin/env node

/**
 * Test script to verify the solid blue background across the entire screen
 */

const TUI = require('./src/tui');

async function solidBlueBackgroundTest() {
  
  const tui = new TUI();

    tui.showDebug('Testing TUI with solid blue background everywhere...');
    tui.showDebug('The entire screen should have a solid blue background:');
    tui.showDebug('- Screen background: blue');
    tui.showDebug('- Panel backgrounds: blue');
    tui.showDebug('- Border backgrounds: blue');
    tui.showDebug('- Empty space: blue');
    tui.showDebug('Press Ctrl+C to exit\n');
  
  // Test all panels with solid blue backgrounds everywhere
  tui.showMudOutput('=== SOLID BLUE BACKGROUND TEST ===');
  tui.showMudOutput('Screen background: BLUE');
  tui.showMudOutput('Panel background: BLUE');
  tui.showMudOutput('Border background: BLUE (not just text color)');
  tui.showMudOutput('Empty screen space: BLUE');
  tui.showMudOutput('Everything should be solid blue!');
  
  tui.showLLMStatus({
    contextInfo: 'Solid blue background everywhere',
    plan: 'Screen, panels, borders all have blue backgrounds',
    nextStep: 'No empty terminal space visible',
    command: 'look'
  });
  
  tui.showDebug('=== SOLID BLUE BACKGROUND VERIFICATION ===');
  tui.showDebug('Screen style.bg = blue');
  tui.showDebug('All panel border.bg = blue (not border.fg)');
  tui.showDebug('Entire interface covered in solid blue');
  tui.showDebug('No terminal default colors showing through');
  
  tui.updateInputStatus('=== SOLID BLUE BACKGROUND COMPLETE ===\n\nThe ENTIRE interface should now have a solid blue background:\n- Screen background: blue\n- Panel backgrounds: blue\n- Border backgrounds: blue\n- All empty space: blue\n\nNo terminal default background should be visible anywhere!\n\nPress Ctrl+C to exit');
  
  // Keep running
  setInterval(() => {}, 1000);
}

// Handle cleanup
process.on('SIGINT', () => {
  process.stderr.write('\nSolid blue background test completed.' + "\n");
  process.exit(0);
});

solidBlueBackgroundTest().catch(process.stderr.write);