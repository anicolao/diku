/**
 * Terminal UI for Diku MUD AI Player
 * Provides a fancy TUI layout with separate panels for MUD interaction, status, and debug
 */

const blessed = require("blessed");
const fs = require("fs");
const path = require("path");

class TUI {
  constructor(behavior) {
    this.behavior = behavior;
    this.screen = null;
    this.mudPanel = null;
    this.statusPanel = null;
    this.debugPanel = null;
    this.inputBox = null;

    this.waitingForApproval = false;
    this.approvalCallback = null;

    // Initialize logging
    this.initializeLogging();
    this.initializeScreen();
  }

  /**
   * Initialize logging directories and files
   */
  initializeLogging() {
    const logsDir = path.join(__dirname, "..", "logs");

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Initialize log file paths
    this.logFiles = {
      mud: path.join(logsDir, "mud.log"),
      status: path.join(logsDir, "status.log"),
      debug: path.join(logsDir, "debug.log"),
      input: path.join(logsDir, "input.log"),
    };

    // Create empty log files if they don't exist
    Object.values(this.logFiles).forEach((logFile) => {
      if (!fs.existsSync(logFile)) {
        fs.writeFileSync(
          logFile,
          `Log started at ${new Date().toISOString()}\n`,
        );
      }
    });
  }

  /**
   * Initialize the blessed screen and create UI layout
   */
  initializeScreen() {
    // Create main screen with improved configuration to reduce corruption
    this.screen = blessed.screen({
      smartCSR: true,
      title: "Diku MUD AI Player",
      fullUnicode: true,
      dockBorders: true,
      warnings: false,
      autoPadding: true,
      fastCSR: true,
      sendFocus: false,
      useBCE: true,
      style: {
        bg: "blue",
        fg: "white",
      },
    });

    // Force color mode if terminal doesn't detect it properly
    if (this.screen.tput && this.screen.tput.colors < 256) {
      this.screen.tput.colors = 256;
    }

    // Create a full-screen background element to ensure complete blue coverage
    this.backgroundElement = blessed.box({
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      style: {
        bg: "blue",
      },
    });
    this.screen.append(this.backgroundElement);

    // Main MUD interaction panel - now takes top 60% of left column
    this.mudPanel = blessed.box({
      top: 0,
      left: 0,
      width: "70%",
      height: "60%",
      content: "Connecting to MUD...",
      tags: true,
      border: {
        type: "line",
      },
      label: " MUD Interaction (Blue Mode) ",
      style: {
        fg: "bright-white",
        bg: "blue",
        border: {
          bg: "blue",
        },
        label: {
          fg: "bright-white",
          bg: "blue",
        },
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      scrollbar: {
        ch: " ",
        style: {
          bg: "blue",
        },
      },
    });

    // Debug panel - now underneath main panel in left column (40% of left column)
    this.debugPanel = blessed.box({
      top: "60%",
      left: 0,
      width: "70%",
      height: "40%",
      content: "Debug: Ready",
      tags: true,
      border: {
        type: "line",
      },
      style: {
        fg: "bright-white",
        bg: "blue",
        border: {
          bg: "blue",
        },
        label: {
          fg: "bright-white",
          bg: "blue",
        },
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      scrollbar: {
        ch: " ",
        style: {
          bg: "blue",
        },
      },
      label: " Debug Messages ",
    });

    // Status panel - now takes top 60% of right column
    this.statusPanel = blessed.box({
      top: 0,
      left: "70%",
      width: "30%",
      height: "60%",
      content: "Status: Initializing...",
      tags: true,
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        bg: "blue",
        border: {
          bg: "blue",
        },
        label: {
          fg: "bright-white",
          bg: "blue",
        },
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      scrollbar: {
        ch: " ",
        style: {
          bg: "blue",
        },
      },
      label: " LLM Status & Plans ",
    });

    // Input/approval area - now takes bottom 40% of right column
    this.inputBox = blessed.box({
      top: "60%",
      left: "70%",
      width: "30%",
      height: "40%",
      content: "Press Ctrl+C to quit. Waiting for MUD connection...",
      tags: true,
      border: {
        type: "line",
      },
      style: {
        fg: "bright-white",
        bg: "blue",
        border: {
          bg: "blue",
        },
        label: {
          fg: "bright-white",
          bg: "blue",
        },
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      scrollbar: {
        ch: " ",
        style: {
          bg: "blue",
        },
      },
      label: " User Input / Approval ",
    });

    // Add all panels to screen
    this.screen.append(this.mudPanel);
    this.screen.append(this.statusPanel);
    this.screen.append(this.debugPanel);
    this.screen.append(this.inputBox);

    // Handle key presses
    this.screen.key(["escape", "q", "C-c"], () => {
      return process.exit(0);
    });

    // Handle Enter key for approval
    this.screen.key(["enter"], () => {
      if (this.waitingForApproval && this.approvalCallback) {
        this.waitingForApproval = false;

        // Log approval to file
        this.writeToLog("input", "Command approved. Processing...");

        // Append processing message with timestamp (consistent with updateInputStatus)
        const timestamp = new Date().toLocaleTimeString();
        const currentContent = this.inputBox.getContent();
        this.inputBox.setContent(
          currentContent +
            `{bold}[${timestamp}]{/bold} Command approved. Processing...\n`,
        );
        this.inputBox.scrollTo(this.inputBox.getScrollHeight());
        this.screen.render();
        this.approvalCallback();
        this.approvalCallback = null;
      }
    });

    // Initial render
    this.screen.render();
  }

  /**
   * Write a message to a log file
   */
  writeToLog(logType, message) {
    if (!this.logFiles || !this.logFiles[logType]) return;

    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}\n`;
      fs.appendFileSync(this.logFiles[logType], logEntry);
    } catch (error) {
      // Silently ignore logging errors to avoid disrupting UI
      console.error(`Failed to write to ${logType} log:`, error.message);
    }
  }

  /**
   * Display MUD output in the main panel
   */
  showMudOutput(output) {
    if (!this.mudPanel) return;

    this.writeToLog("mud", output);

    // Append to existing content
    const currentContent = this.mudPanel.getContent();
    this.mudPanel.setContent(`${currentContent}${output}`);
    this.mudPanel.scrollTo(this.mudPanel.getScrollHeight());
    this.screen.render();
  }
  showMudInput(input) {
    if (!this.mudPanel) return;

    this.writeToLog("mud", input);

    // Append to existing content
    const currentContent = this.mudPanel.getContent();
    this.mudPanel.setContent(`${currentContent}{bold}${input}{/bold}\n`);
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
    let logContent = "";

    if (data.contextInfo) {
      content += `{cyan-fg}💭 ${data.contextInfo}{/cyan-fg}\n`;
      logContent += `💭 ${data.contextInfo}\n`;
    }

    if (data.plan) {
      content += `{yellow-fg}📋 Plan:{/yellow-fg} ${data.plan}\n`;
      logContent += `📋 Plan: ${data.plan}\n`;
    }

    if (data.nextStep) {
      content += `{green-fg}➡️  Next Step:{/green-fg} ${data.nextStep}\n`;
      logContent += `➡️  Next Step: ${data.nextStep}\n`;
    }

    if (data.command) {
      content += `{white-fg}🎮 Command:{/white-fg} ${data.command}\n`;
      logContent += `🎮 Command: ${data.command}\n`;
    }

    if (data.error) {
      content += `{red-fg}❌ Error:{/red-fg} ${data.error}\n`;
      logContent += `❌ Error: ${data.error}\n`;
    }

    content += "\n";

    // Log to file
    if (logContent) {
      this.writeToLog("status", logContent.trim());
    }

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

    // Log to file
    this.writeToLog("debug", message);

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

      // Approve after a small delay to avoid flooding
      const ms = this.behavior?.commandDelayMs || 2000;
      this.showDebug(`Auto-approving in ${ms / 1000} seconds...`);
      setTimeout(() => {
        if (this.approvalCallback === resolve) {
          this.showDebug("Auto-approved.");
          this.approvalCallback();
          this.approvalCallback = null;
          this.waitingForApproval = false;
        }
      }, ms);

      // Log to file
      this.writeToLog("input", `APPROVAL REQUIRED: ${message}`);

      // Append approval prompt with clear visual separator (consistent with other methods)
      const timestamp = new Date().toLocaleTimeString();
      const currentContent = this.inputBox.getContent();
      const separator = "\n" + "━".repeat(35) + "\n";
      const promptContent = `${separator}{bold}[${timestamp}] APPROVAL REQUIRED{/bold}\n${message}\n\n{bold}{yellow-fg}Press ENTER to approve, or Ctrl+C to quit{/yellow-fg}{/bold}\n`;
      this.inputBox.setContent(currentContent + promptContent);
      this.inputBox.scrollTo(this.inputBox.getScrollHeight());
      this.screen.render();
    });
  }

  /**
   * Clear the input box content properly
   */
  clearInputBox() {
    if (!this.inputBox) return;

    // Multiple approaches to ensure clearing works with blessed.js
    this.inputBox.setContent("");
    this.inputBox.setScrollPerc(0);
    // Force a repaint by temporarily hiding and showing
    this.inputBox.hide();
    this.screen.render();
    this.inputBox.show();
    this.screen.render();
  }

  /**
   * Update the input box with a message
   */
  updateInputStatus(message) {
    if (!this.inputBox) return;

    // Log to file
    this.writeToLog("input", message);

    // Append to existing content with timestamp and separator for better readability
    const timestamp = new Date().toLocaleTimeString();
    const newContent = `{bold}[${timestamp}]{/bold} ${message}\n`;
    const currentContent = this.inputBox.getContent();
    this.inputBox.setContent(currentContent + newContent);
    this.inputBox.scrollTo(this.inputBox.getScrollHeight());
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
