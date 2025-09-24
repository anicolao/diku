#!/usr/bin/env node

/**
 * Simple test to debug blessed color rendering
 */

const blessed = require('blessed');

const screen = blessed.screen({
  smartCSR: true,
  title: 'Color Debug Test',
  fullUnicode: true,
  dockBorders: true
});

// Debug info box
const debugBox = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: 5,
  content: `Terminal: ${process.env.TERM || 'unknown'}\nColors: ${screen.tput.colors || 'unknown'}\nTerminfo: ${process.env.TERMINFO || 'default'}`,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    border: {
      fg: 'cyan'
    }
  },
  label: ' Terminal Info '
});

// Test the exact panels from TUI
const mudPanel = blessed.box({
  top: 5,
  left: 0,
  width: '70%',
  height: '50%',
  content: 'MUD Panel - Should have BLACK background with GREEN text',
  border: {
    type: 'line'
  },
  style: {
    fg: 'green',
    bg: 'black',
    border: {
      fg: 'green'
    }
  },
  label: ' MUD Interaction '
});

const statusPanel = blessed.box({
  top: 5,
  left: '70%',
  width: '30%',
  height: '30%',
  content: 'Status Panel - Should have BLUE background',
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    bg: 'blue',
    border: {
      fg: 'cyan'
    }
  },
  label: ' Status '
});

const debugPanel = blessed.box({
  top: '35%',
  left: '70%',
  width: '30%',
  height: '20%',
  content: 'Debug Panel - Should have BLACK background with YELLOW text',
  border: {
    type: 'line'
  },
  style: {
    fg: 'yellow',
    bg: 'black',
    border: {
      fg: 'yellow'
    }
  },
  label: ' Debug '
});

const inputPanel = blessed.box({
  bottom: 0,
  left: 0,
  width: '100%',
  height: '45%',
  content: 'Input Panel - Should have BLACK background with WHITE text\n\nPress q to quit',
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    bg: 'black',
    border: {
      fg: 'white'
    }
  },
  label: ' Input '
});

screen.append(debugBox);
screen.append(mudPanel);
screen.append(statusPanel);
screen.append(debugPanel);
screen.append(inputPanel);

screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

screen.render();

console.log('Debug test running. Check which panels show correct colors.');