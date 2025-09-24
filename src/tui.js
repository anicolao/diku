/**
 * Terminal UI for Diku MUD AI Player
 * Provides a fancy TUI layout with separate panels for MUD interaction, status, and debug
 */

const blessed = require('blessed');

class TUI {
  constructor() {
    this.screen = null;
    this.mudPanel = null;
    this.statusPanel = null;
    this.debugPanel = null;
    this.inputBox = null;
    
    this.waitingForApproval = false;
    this.approvalCallback = null;
    
    this.initializeScreen();
  }

  /**
   * Initialize the blessed screen and create UI layout
   */
  initializeScreen() {
    // Force color support and create main screen with blue background
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Diku MUD AI Player',
      fullUnicode: true,
      dockBorders: true,
      warnings: false,
      style: {
        bg: 'blue'
      }
    });
    
    // Force color mode if terminal doesn't detect it properly
    if (this.screen.tput.colors < 256) {
      this.screen.tput.colors = 256;
    }

    // Main MUD interaction panel (dark mode)
    this.mudPanel = blessed.box({
      top: 0,
      left: 0,
      width: '70%',
      height: '80%',
      content: 'Connecting to MUD...',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'bright-white',
        bg: 'blue',
        border: {
          bg: 'blue'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        style: {
          bg: 'blue'
        }
      },
      label: ' MUD Interaction (Blue Mode) '
    });

    // Status panel for LLM plans and decisions
    this.statusPanel = blessed.box({
      top: 0,
      left: '70%',
      width: '30%',
      height: '60%',
      content: 'Status: Initializing...',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          bg: 'blue'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        style: {
          bg: 'blue'
        }
      },
      label: ' LLM Status & Plans '
    });

    // Debug panel for technical messages
    this.debugPanel = blessed.box({
      top: '60%',
      left: '70%',
      width: '30%',
      height: '20%',
      content: 'Debug: Ready',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'bright-white',
        bg: 'blue',
        border: {
          bg: 'blue'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        style: {
          bg: 'blue'
        }
      },
      label: ' Debug Messages '
    });

    // Input/approval area
    this.inputBox = blessed.box({
      top: '80%',
      left: 0,
      width: '100%',
      height: '20%',
      content: 'Press Ctrl+C to quit. Waiting for MUD connection...',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'bright-white',
        bg: 'blue',
        border: {
          bg: 'blue'
        }
      },
      label: ' User Input / Approval '
    });

    // Add all panels to screen
    this.screen.append(this.mudPanel);
    this.screen.append(this.statusPanel);
    this.screen.append(this.debugPanel);
    this.screen.append(this.inputBox);

    // Handle key presses
    this.screen.key(['escape', 'q', 'C-c'], () => {
      return process.exit(0);
    });

    // Handle Enter key for approval
    this.screen.key(['enter'], () => {
      if (this.waitingForApproval && this.approvalCallback) {
        this.waitingForApproval = false;
        this.inputBox.setContent('Command approved. Processing...');
        this.screen.render();
        this.approvalCallback();
        this.approvalCallback = null;
      }
    });

    // Initial render
    this.screen.render();
  }

  /**
   * Display MUD output in the main panel
   */
  showMudOutput(output) {
    if (!this.mudPanel) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const content = `{bold}[${timestamp}]{/bold}\n${output}\n`;
    
    // Append to existing content
    const currentContent = this.mudPanel.getContent();
    this.mudPanel.setContent(currentContent + content);
    this.mudPanel.scrollTo(this.mudPanel.getScrollHeight());
    this.screen.render();
  }

  /**
   * Display LLM status, plans, and reasoning
   */
  showLLMStatus(data) {
    if (!this.statusPanel) return;
    
    const timestamp = new Date().toLocaleTimeString();
    let content = `{bold}[${timestamp}]{/bold}\n`;
    
    if (data.contextInfo) {
      content += `{cyan-fg}💭 ${data.contextInfo}{/cyan-fg}\n`;
    }
    
    if (data.plan) {
      content += `{yellow-fg}📋 Plan:{/yellow-fg} ${data.plan}\n`;
    }
    
    if (data.nextStep) {
      content += `{green-fg}➡️  Next Step:{/green-fg} ${data.nextStep}\n`;
    }
    
    if (data.command) {
      content += `{white-fg}🎮 Command:{/white-fg} ${data.command}\n`;
    }
    
    if (data.error) {
      content += `{red-fg}❌ Error:{/red-fg} ${data.error}\n`;
    }
    
    content += '\n';
    
    // Append to existing content
    const currentContent = this.statusPanel.getContent();
    this.statusPanel.setContent(currentContent + content);
    this.statusPanel.scrollTo(this.statusPanel.getScrollHeight());
    this.screen.render();
  }

  /**
   * Display debug messages
   */
  showDebug(message) {
    if (!this.debugPanel) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const content = `{bold}[${timestamp}]{/bold} ${message}\n`;
    
    // Append to existing content  
    const currentContent = this.debugPanel.getContent();
    this.debugPanel.setContent(currentContent + content);
    this.debugPanel.scrollTo(this.debugPanel.getScrollHeight());
    this.screen.render();
  }

  /**
   * Wait for user approval (Enter key press)
   */
  waitForApproval(message) {
    return new Promise((resolve) => {
      this.waitingForApproval = true;
      this.approvalCallback = resolve;
      
      this.inputBox.setContent(`${message}\n\n{bold}{yellow-fg}Press ENTER to approve, or Ctrl+C to quit{/yellow-fg}{/bold}`);
      this.screen.render();
    });
  }

  /**
   * Update the input box with a message
   */
  updateInputStatus(message) {
    if (!this.inputBox) return;
    
    this.inputBox.setContent(message);
    this.screen.render();
  }

  /**
   * Destroy the TUI and clean up
   */
  destroy() {
    if (this.screen) {
      this.screen.destroy();
    }
  }
}

module.exports = TUI;