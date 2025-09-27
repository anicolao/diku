/**
 * Terminal UI for Diku MUD AI Player using terminal-kit
 * Provides a fancy TUI layout with separate panels for MUD interaction, status, and debug
 */

const termkit = require("terminal-kit");
const fs = require("fs");
const path = require("path");

class TUI {
  constructor(behavior) {
    this.behavior = behavior;
    this.terminal = termkit.terminal;
    
    this.waitingForApproval = false;
    this.approvalCallback = null;
    
    // Panel boundaries (percentage-based)
    this.layout = {
      mudPanel: { x: 1, y: 1, width: 0.7, height: 0.6 },
      statusPanel: { x: 0.7, y: 1, width: 0.3, height: 0.6 },
      debugPanel: { x: 1, y: 0.6, width: 0.7, height: 0.4 },
      inputPanel: { x: 0.7, y: 0.6, width: 0.3, height: 0.4 }
    };
    
    // Initialize logging and screen
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
   * Initialize the terminal-kit screen and create UI layout
   */
  initializeScreen() {
    // Clear screen and set up terminal
    this.terminal.fullscreen();
    this.terminal.hideCursor();
    
    // Set terminal title
    this.terminal.windowTitle("Diku MUD AI Player");
    
    // Calculate panel dimensions based on terminal size
    this.updateDimensions();
    
    // Draw initial interface
    this.drawInterface();
    
    // Set up key handlers
    this.setupKeyHandlers();
    
    // Initialize panel content
    this.panels = {
      mud: [],
      status: [],
      debug: [],
      input: []
    };
    
    // Show initial status
    this.updateInputStatus("Press Ctrl+C to quit. Waiting for MUD connection...");
  }

  /**
   * Update panel dimensions based on current terminal size
   */
  updateDimensions() {
    const width = this.terminal.width && isFinite(this.terminal.width) ? this.terminal.width : 80;
    const height = this.terminal.height && isFinite(this.terminal.height) ? this.terminal.height : 24;
    
    this.dimensions = {
      mudPanel: {
        x: 1,
        y: 1,
        width: Math.floor(width * this.layout.mudPanel.width),
        height: Math.floor(height * this.layout.mudPanel.height)
      },
      statusPanel: {
        x: Math.floor(width * this.layout.statusPanel.x) + 1,
        y: 1,
        width: Math.floor(width * this.layout.statusPanel.width),
        height: Math.floor(height * this.layout.statusPanel.height)
      },
      debugPanel: {
        x: 1,
        y: Math.floor(height * this.layout.debugPanel.y) + 1,
        width: Math.floor(width * this.layout.debugPanel.width),
        height: Math.floor(height * this.layout.debugPanel.height)
      },
      inputPanel: {
        x: Math.floor(width * this.layout.inputPanel.x) + 1,
        y: Math.floor(height * this.layout.inputPanel.y) + 1,
        width: Math.floor(width * this.layout.inputPanel.width),
        height: Math.floor(height * this.layout.inputPanel.height)
      }
    };
  }

  /**
   * Draw the basic interface structure with borders
   */
  drawInterface() {
    // Clear screen with blue background  
    this.terminal.clear();
    this.terminal.bgBlue();
    
    // Fill entire screen with blue (with fallback dimensions for testing)
    const width = this.terminal.width && isFinite(this.terminal.width) ? this.terminal.width : 80;
    const height = this.terminal.height && isFinite(this.terminal.height) ? this.terminal.height : 24;
    
    for (let y = 1; y <= height; y++) {
      this.terminal.moveTo(1, y);
      this.terminal.white.bgBlue(" ".repeat(width));
    }
    
    // Draw panel borders
    this.drawPanel("MUD Interaction (Terminal-Kit)", this.dimensions.mudPanel);
    this.drawPanel("LLM Status & Plans", this.dimensions.statusPanel);
    this.drawPanel("Debug Messages", this.dimensions.debugPanel);
    this.drawPanel("User Input / Approval", this.dimensions.inputPanel);
  }

  /**
   * Draw a panel with border and title
   */
  drawPanel(title, dim) {
    if (!dim || dim.width <= 0 || dim.height <= 0) return;
    
    // Draw simple border using terminal characters
    // Top border
    this.terminal.moveTo(dim.x, dim.y);
    this.terminal.white.bgBlue("┌" + "─".repeat(dim.width - 2) + "┐");
    
    // Side borders
    for (let y = 1; y < dim.height - 1; y++) {
      this.terminal.moveTo(dim.x, dim.y + y);
      this.terminal.white.bgBlue("│");
      this.terminal.moveTo(dim.x + dim.width - 1, dim.y + y);
      this.terminal.white.bgBlue("│");
    }
    
    // Bottom border
    this.terminal.moveTo(dim.x, dim.y + dim.height - 1);
    this.terminal.white.bgBlue("└" + "─".repeat(dim.width - 2) + "┘");
    
    // Draw title
    if (title && dim.width > title.length + 4) {
      const titleX = dim.x + Math.floor((dim.width - title.length - 2) / 2);
      this.terminal.moveTo(titleX, dim.y);
      this.terminal.white.bgBlue(` ${title} `);
    }
  }

  /**
   * Set up keyboard event handlers
   */
  setupKeyHandlers() {
    // Handle Ctrl+C and ESC to exit
    this.terminal.on("key", (name) => {
      if (name === "CTRL_C" || name === "ESCAPE" || name === "q") {
        this.destroy();
        process.exit(0);
      }
      
      // Handle Enter for approval
      if (name === "ENTER" && this.waitingForApproval && this.approvalCallback) {
        this.waitingForApproval = false;
        
        // Log approval to file
        this.writeToLog("input", "Command approved. Processing...");
        
        // Add processing message
        const timestamp = new Date().toLocaleTimeString();
        this.panels.input.push(`[${timestamp}] Command approved. Processing...`);
        this.renderPanel("input");
        
        this.approvalCallback();
        this.approvalCallback = null;
      }
    });
    
    // Handle terminal resize
    this.terminal.on("resize", () => {
      this.updateDimensions();
      this.drawInterface();
      this.renderAllPanels();
    });
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
   * Render a specific panel's content
   */
  renderPanel(panelName) {
    const dim = this.dimensions[panelName + "Panel"];
    const content = this.panels[panelName];
    
    if (!dim || !content) return;
    
    // Clear panel content area (inside border)
    const contentArea = {
      x: dim.x + 1,
      y: dim.y + 1,
      width: dim.width - 2,
      height: dim.height - 2
    };
    
    // Clear the content area
    for (let y = 0; y < contentArea.height; y++) {
      this.terminal.moveTo(contentArea.x, contentArea.y + y);
      this.terminal.white.bgBlue(" ".repeat(contentArea.width));
    }
    
    // Render content lines (show last N lines that fit)
    const visibleLines = Math.max(0, contentArea.height);
    const startIndex = Math.max(0, content.length - visibleLines);
    const linesToShow = content.slice(startIndex);
    
    linesToShow.forEach((line, index) => {
      const y = contentArea.y + index;
      if (y < contentArea.y + contentArea.height) {
        this.terminal.moveTo(contentArea.x, y);
        // Truncate line if too long
        const truncatedLine = line.length > contentArea.width 
          ? line.substring(0, contentArea.width - 3) + "..."
          : line;
        this.terminal.white.bgBlue(truncatedLine);
      }
    });
  }

  /**
   * Render all panels
   */
  renderAllPanels() {
    this.renderPanel("mud");
    this.renderPanel("status");
    this.renderPanel("debug");
    this.renderPanel("input");
  }

  /**
   * Display MUD output in the main panel
   */
  showMudOutput(output) {
    this.writeToLog("mud", output);
    
    // Split output into lines and add to panel
    const lines = output.split("\n");
    lines.forEach(line => {
      if (line.trim()) {
        this.panels.mud.push(line);
      }
    });
    
    // Keep panel size manageable
    if (this.panels.mud.length > 1000) {
      this.panels.mud = this.panels.mud.slice(-500);
    }
    
    this.renderPanel("mud");
  }

  /**
   * Display MUD input in the main panel
   */
  showMudInput(input) {
    this.writeToLog("mud", input);
    
    // Add input as bold line
    this.panels.mud.push(`> ${input}`);
    
    // Keep panel size manageable
    if (this.panels.mud.length > 1000) {
      this.panels.mud = this.panels.mud.slice(-500);
    }
    
    this.renderPanel("mud");
  }

  /**
   * Display LLM status, plans, and reasoning
   */
  showLLMStatus(data) {
    const timestamp = new Date().toLocaleTimeString();
    let content = [`[${timestamp}]`];
    let logContent = "";

    if (data.contextInfo) {
      content.push(`💭 ${data.contextInfo}`);
      logContent += `💭 ${data.contextInfo}\n`;
    }

    if (data.plan) {
      content.push(`📋 Plan: ${data.plan}`);
      logContent += `📋 Plan: ${data.plan}\n`;
    }

    if (data.nextStep) {
      content.push(`➡️  Next Step: ${data.nextStep}`);
      logContent += `➡️  Next Step: ${data.nextStep}\n`;
    }

    if (data.command) {
      content.push(`🎮 Command: ${data.command}`);
      logContent += `🎮 Command: ${data.command}\n`;
    }

    if (data.error) {
      content.push(`❌ Error: ${data.error}`);
      logContent += `❌ Error: ${data.error}\n`;
    }

    // Log to file
    if (logContent) {
      this.writeToLog("status", logContent.trim());
    }

    // Add to status panel
    this.panels.status.push(...content, "");
    
    // Keep panel size manageable
    if (this.panels.status.length > 1000) {
      this.panels.status = this.panels.status.slice(-500);
    }

    this.renderPanel("status");
  }

  /**
   * Display debug messages
   */
  showDebug(message) {
    const timestamp = new Date().toLocaleTimeString();
    const content = `[${timestamp}] ${message}`;

    // Log to file
    this.writeToLog("debug", message);

    // Add to debug panel
    this.panels.debug.push(content);
    
    // Keep panel size manageable
    if (this.panels.debug.length > 1000) {
      this.panels.debug = this.panels.debug.slice(-500);
    }

    this.renderPanel("debug");
  }

  /**
   * Wait for user approval (Enter key press)
   */
  waitForApproval(message) {
    return new Promise((resolve) => {
      this.waitingForApproval = true;
      this.approvalCallback = resolve;

      // Auto-approve after delay to avoid flooding
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

      // Add approval prompt
      const timestamp = new Date().toLocaleTimeString();
      this.panels.input.push(
        "─".repeat(35),
        `[${timestamp}] APPROVAL REQUIRED`,
        message,
        "",
        "Press ENTER to approve, or Ctrl+C to quit"
      );

      this.renderPanel("input");
    });
  }

  /**
   * Clear the input box content
   */
  clearInputBox() {
    this.panels.input = [];
    this.renderPanel("input");
  }

  /**
   * Update the input box with a message
   */
  updateInputStatus(message) {
    // Log to file
    this.writeToLog("input", message);

    // Add to input panel with timestamp
    const timestamp = new Date().toLocaleTimeString();
    this.panels.input.push(`[${timestamp}] ${message}`);
    
    // Keep panel size manageable
    if (this.panels.input.length > 1000) {
      this.panels.input = this.panels.input.slice(-500);
    }

    this.renderPanel("input");
  }

  /**
   * Destroy the TUI and clean up
   */
  destroy() {
    if (this.terminal) {
      this.terminal.hideCursor(false);
      this.terminal.fullscreen(false);
      this.terminal.processExit();
    }
  }
}

module.exports = TUI;