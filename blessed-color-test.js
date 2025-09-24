#!/usr/bin/env node

/**
 * Test different blessed color formats to find what works
 */

const blessed = require('blessed');

const screen = blessed.screen({
  smartCSR: true,
  title: 'Color Test'
});

// Test different black background formats
const tests = [
  { name: 'String black', bg: 'black' },
  { name: 'Number 0', bg: 0 },
  { name: 'Hex #000000', bg: '#000000' },
  { name: 'Hex #000', bg: '#000' },
  { name: 'RGB [0,0,0]', bg: [0, 0, 0] }
];

tests.forEach((test, index) => {
  const box = blessed.box({
    top: index * 3,
    left: 0,
    width: '100%',
    height: 3,
    content: `Test: ${test.name} - Background should be black`,
    border: {
      type: 'line'
    },
    style: {
      fg: 'green',
      bg: test.bg,
      border: {
        fg: 'white'
      }
    },
    label: ` ${test.name} `
  });
  
  screen.append(box);
});

// Add quit instruction
const quitBox = blessed.box({
  bottom: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: 'Press q or Ctrl+C to quit',
  style: {
    fg: 'yellow'
  }
});

screen.append(quitBox);

// Quit handlers
screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

screen.render();

console.log('Color test running. Check which black background works best.');