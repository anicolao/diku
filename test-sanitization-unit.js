#!/usr/bin/env node

/**
 * Unit test for content sanitization to prevent garbage characters
 */

const TUI = require('./src/tui.js');

console.log('Testing sanitization functionality...');

// Create a simple behavior object
const behavior = { commandDelayMs: 1000 };

// Create TUI to access sanitizeContent method
const tui = new TUI(behavior);

// Test cases
const testCases = [
  {
    name: 'Control characters',
    input: 'Text with \x07bell and \x1b[31mred color\x1b[0m',
    shouldNotContain: ['\x07', '\x1b'],
    description: 'Should remove control characters'
  },
  {
    name: 'Blessed.js markup escaping',
    input: 'Text with {dangerous} and {bold} markup',
    shouldContain: ['{{dangerous}}', '{{bold}}'],
    description: 'Should escape blessed.js markup'
  },
  {
    name: 'Very long text truncation',
    input: 'A'.repeat(250) + 'END',
    maxLength: 200,
    shouldContain: ['...'],
    shouldNotContain: ['END'],
    description: 'Should truncate very long text'
  },
  {
    name: 'Whitespace normalization',
    input: 'Text   with    multiple     spaces\t\tand\t\ttabs',
    shouldContain: ['Text with multiple spaces and tabs'],
    description: 'Should normalize whitespace'
  },
  {
    name: 'Newlines preservation',
    input: 'Line 1\nLine 2\nLine 3',
    shouldContain: ['Line 1\nLine 2\nLine 3'],
    description: 'Should preserve newlines'
  },
  {
    name: 'Mixed problematic content',
    input: 'Mixed {markup} with \x07control and\t\tspaces and ' + 'A'.repeat(100) + 'TRUNCATED',
    shouldContain: ['{{markup}}'],
    shouldNotContain: ['\x07', 'TRUNCATED'],
    description: 'Should handle mixed problematic content'
  }
];

console.log('\n=== Running Sanitization Tests ===\n');

let passed = 0;
let failed = 0;

testCases.forEach(test => {
  console.log(`Testing: ${test.name}`);
  console.log(`Input: "${test.input.substring(0, 50)}${test.input.length > 50 ? '...' : ''}"`);
  
  const result = tui.sanitizeContent(test.input);
  console.log(`Output: "${result.substring(0, 50)}${result.length > 50 ? '...' : ''}"`);
  
  let testPassed = true;
  
  // Check should contain
  if (test.shouldContain) {
    for (const item of test.shouldContain) {
      if (!result.includes(item)) {
        console.log(`  ❌ FAIL: Output should contain "${item}"`);
        testPassed = false;
      }
    }
  }
  
  // Check should not contain
  if (test.shouldNotContain) {
    for (const item of test.shouldNotContain) {
      if (result.includes(item)) {
        console.log(`  ❌ FAIL: Output should NOT contain "${item}"`);
        testPassed = false;
      }
    }
  }
  
  // Check max length
  if (test.maxLength && result.length > test.maxLength) {
    console.log(`  ❌ FAIL: Output length ${result.length} exceeds max ${test.maxLength}`);
    testPassed = false;
  }
  
  if (testPassed) {
    console.log(`  ✅ PASS: ${test.description}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${test.description}`);
    failed++;
  }
  
  console.log('');
});

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);

// Clean up
tui.destroy();

process.exit(failed > 0 ? 1 : 0);