/**
 * Tests for TUI content sanitization to prevent garbage characters
 */

const TUI = require('../src/tui.js');

describe('TUI Content Sanitization', () => {
  let tui;

  beforeEach(() => {
    // Mock behavior object
    const behavior = { commandDelayMs: 1000 };
    tui = new TUI(behavior);
  });

  afterEach(() => {
    if (tui) {
      tui.destroy();
    }
  });

  describe('sanitizeContent', () => {
    test('should remove control characters', () => {
      const input = 'Text with \x07bell and \x1b[31mred color\x1b[0m';
      const result = tui.sanitizeContent(input);
      
      expect(result).not.toMatch(/[\x07\x1b]/);
      expect(result).toContain('Text with');
      expect(result).toContain('bell and');
      expect(result).toContain('red color');
    });

    test('should escape blessed.js markup', () => {
      const input = 'Text with {dangerous} and {bold} markup';
      const result = tui.sanitizeContent(input);
      
      expect(result).toContain('{{dangerous}}');
      expect(result).toContain('{{bold}}');
    });

    test('should truncate very long text', () => {
      const longText = 'A'.repeat(250) + 'END';
      const result = tui.sanitizeContent(longText);
      
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result).toContain('...');
      expect(result).not.toContain('END');
    });

    test('should normalize whitespace', () => {
      const input = 'Text   with    multiple     spaces\t\tand\t\ttabs';
      const result = tui.sanitizeContent(input);
      
      expect(result).toBe('Text with multiple spaces and tabs');
    });

    test('should preserve newlines', () => {
      const input = 'Line 1\nLine 2\nLine 3';
      const result = tui.sanitizeContent(input);
      
      expect(result).toBe('Line 1\nLine 2\nLine 3');
    });

    test('should handle null/undefined input', () => {
      expect(tui.sanitizeContent(null)).toBeNull();
      expect(tui.sanitizeContent(undefined)).toBeUndefined();
      expect(tui.sanitizeContent('')).toBe('');
    });

    test('should handle mixed problematic content', () => {
      const input = 'Mixed {markup} with \x07control and\t\tspaces and ' + 'A'.repeat(100);
      const result = tui.sanitizeContent(input);
      
      expect(result).toContain('{{markup}}');
      expect(result).not.toMatch(/[\x07]/);
      expect(result).toContain('Mixed');
      expect(result).toContain('control and spaces');
    });
  });
});