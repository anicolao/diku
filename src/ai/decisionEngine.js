/**
 * AI Decision Engine - Interfaces with Ollama API for decision making
 * This is a basic implementation that will be expanded
 */

const EventEmitter = require('events');
const axios = require('axios');
const logger = require('../utils/logger');

class DecisionEngine extends EventEmitter {
  constructor(ollamaConfig, behaviorConfig, options = {}) {
    super();
    
    this.ollamaConfig = ollamaConfig;
    this.behaviorConfig = behaviorConfig;
    this.options = options; // Include dry-run option
    this.logger = logger.child({ component: 'DecisionEngine' });
    
    this.httpClient = axios.create({
      baseURL: ollamaConfig.baseUrl,
      timeout: ollamaConfig.timeout || 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.initialized = false;
    this.lastDecisionTime = null;
  }

  /**
   * Initialize the AI engine
   */
  async initialize() {
    try {
      this.logger.info('Initializing AI decision engine...');
      
      // Skip Ollama connection test in dry-run mode
      if (!this.options.dryRun) {
        await this.testOllamaConnection();
      } else {
        this.logger.info('DRY RUN MODE: Skipping Ollama connection test');
      }
      
      this.initialized = true;
      this.logger.info('AI decision engine initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize AI decision engine:', error);
      throw error;
    }
  }

  /**
   * Test connection to Ollama API
   */
  async testOllamaConnection() {
    try {
      const response = await this.httpClient.get('/api/tags');
      
      const models = response.data.models || [];
      const hasRequiredModel = models.some(model => 
        model.name.includes(this.ollamaConfig.model)
      );
      
      if (!hasRequiredModel) {
        this.logger.warn(`Configured model '${this.ollamaConfig.model}' not found. Available models:`, 
          models.map(m => m.name));
      }
      
      this.logger.info('Ollama API connection successful');
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Ollama API. Is Ollama running?');
      }
      throw error;
    }
  }

  /**
   * Make a decision based on current game state
   */
  async makeDecision(gameState) {
    try {
      if (!this.initialized) {
        throw new Error('AI engine not initialized');
      }

      this.logger.debug('Making AI decision with state:', gameState);
      
      // Build context for the AI
      const context = this.buildContext(gameState);
      
      // Generate prompt
      const prompt = this.generatePrompt(context);
      
      // Get decision from Ollama
      const decision = await this.queryOllama(prompt, context);
      
      // Process and validate the decision
      const processedDecision = this.processDecision(decision, context);
      
      this.lastDecisionTime = new Date();
      this.emit('decision', processedDecision);
      
      return processedDecision;
      
    } catch (error) {
      this.logger.error('Error making AI decision:', error);
      
      // Fallback to basic rule-based decision
      const fallbackDecision = this.makeFallbackDecision(gameState);
      this.emit('decision', fallbackDecision);
      
      return fallbackDecision;
    }
  }

  /**
   * Build context information for AI decision making
   */
  buildContext(gameState) {
    const context = {
      player: {
        health: gameState.player.health,
        mana: gameState.player.mana,
        moves: gameState.player.moves,
        healthPercent: Math.round((gameState.player.health.current / gameState.player.health.max) * 100),
        manaPercent: Math.round((gameState.player.mana.current / gameState.player.mana.max) * 100)
      },
      room: {
        name: gameState.room.name || 'Unknown Location',
        exits: gameState.room.exits || [],
        hasObjects: gameState.room.objects && gameState.room.objects.length > 0,
        hasCharacters: gameState.room.characters && gameState.room.characters.length > 0
      },
      combat: gameState.combat,
      behavior: this.behaviorConfig,
      urgency: this.calculateUrgency(gameState)
    };

    return context;
  }

  /**
   * Calculate urgency level based on game state
   */
  calculateUrgency(gameState) {
    let urgency = 0;

    // Health urgency
    const healthPercent = gameState.player.health.current / gameState.player.health.max;
    if (healthPercent < 0.2) urgency += 0.8;
    else if (healthPercent < 0.5) urgency += 0.4;

    // Combat urgency
    if (gameState.combat.inCombat) urgency += 0.6;

    // Mana urgency (for spellcasters)
    const manaPercent = gameState.player.mana.current / gameState.player.mana.max;
    if (manaPercent < 0.1 && gameState.combat.inCombat) urgency += 0.3;

    return Math.min(urgency, 1.0);
  }

  /**
   * Generate prompt for AI decision making
   */
  generatePrompt(context) {
    const prompt = `You are an AI playing a MUD (Multi-User Dungeon) game. You need to make the next decision.

Current Situation:
- Location: ${context.room.name}
- Health: ${context.player.health.current}/${context.player.health.max} (${context.player.healthPercent}%)
- Mana: ${context.player.mana.current}/${context.player.mana.max} (${context.player.manaPercent}%)
- Moves: ${context.player.moves.current}/${context.player.moves.max}
- Available exits: ${context.room.exits.join(', ') || 'none'}
- Objects in room: ${context.room.hasObjects ? 'yes' : 'no'}
- Other characters: ${context.room.hasCharacters ? 'yes' : 'no'}
- In combat: ${context.combat.inCombat ? 'yes' : 'no'}

Your personality traits (scale 0.0-1.0):
- Aggressiveness: ${context.behavior.aggressiveness}
- Exploration: ${context.behavior.exploration}  
- Caution: ${context.behavior.caution}

Choose ONE action from these options:
1. explore - Move to explore new areas
2. look - Examine current surroundings  
3. rest - Rest to recover health/mana
4. inventory - Check inventory
5. wait - Do nothing this turn
6. flee - Run from danger
7. attack - Engage in combat
8. cast - Cast a spell
9. get - Pick up items
10. quit - Leave the game

Respond with ONLY the action name (one word) and a brief reason.
Format: ACTION: reason

Your decision:`;

    return prompt;
  }

  /**
   * Query Ollama API for decision
   */
  async queryOllama(prompt, context) {
    // In dry-run mode, return a mock response
    if (this.options.dryRun) {
      this.logger.info('DRY RUN MODE: Using mock Ollama response');
      return 'explore: Looking for new areas to discover';
    }
    
    try {
      const response = await this.httpClient.post('/api/generate', {
        model: this.ollamaConfig.model,
        prompt: prompt,
        options: {
          temperature: this.ollamaConfig.temperature || 0.7,
          top_p: 0.9,
          max_tokens: 100
        },
        stream: false
      });

      const responseText = response.data.response || '';
      
      this.logger.debug('Ollama response:', responseText);
      
      return responseText.trim();
      
    } catch (error) {
      this.logger.error('Error querying Ollama:', error);
      throw error;
    }
  }

  /**
   * Process and validate AI decision
   */
  processDecision(rawDecision, context) {
    try {
      // Extract action and reasoning from response
      const lines = rawDecision.split('\n').filter(line => line.trim());
      const firstLine = lines[0] || rawDecision;
      
      // Look for "ACTION:" pattern
      const actionMatch = firstLine.match(/^(.*?):\s*(.*)$/);
      let action, reasoning;
      
      if (actionMatch) {
        action = actionMatch[1].toLowerCase().trim();
        reasoning = actionMatch[2].trim();
      } else {
        // Try to extract just the action word
        const words = firstLine.toLowerCase().split(/\s+/);
        action = words[0];
        reasoning = words.slice(1).join(' ') || 'No specific reason given';
      }

      // Validate action
      const validActions = [
        'explore', 'look', 'rest', 'inventory', 'wait', 
        'flee', 'attack', 'cast', 'get', 'quit'
      ];

      if (!validActions.includes(action)) {
        this.logger.warn(`Invalid action '${action}', falling back to 'look'`);
        action = 'look';
        reasoning = 'Fallback action due to invalid AI response';
      }

      // Apply behavioral constraints
      action = this.applyBehavioralConstraints(action, context);

      const decision = {
        action,
        reasoning,
        confidence: this.calculateConfidence(rawDecision),
        timestamp: new Date().toISOString(),
        rawResponse: rawDecision
      };

      this.logger.info(`AI Decision: ${action} (${reasoning})`);
      
      return decision;
      
    } catch (error) {
      this.logger.error('Error processing decision:', error);
      return this.makeFallbackDecision(context);
    }
  }

  /**
   * Apply behavioral constraints to the chosen action
   */
  applyBehavioralConstraints(action, context) {
    // High caution: avoid risky actions when health is low
    if (context.behavior.caution > 0.7 && context.player.healthPercent < 30) {
      if (['attack', 'explore'].includes(action)) {
        this.logger.debug('Behavioral constraint: avoiding risky action due to low health');
        return 'rest';
      }
    }

    // High exploration: prefer movement over waiting
    if (context.behavior.exploration > 0.7 && action === 'wait' && context.room.exits.length > 0) {
      this.logger.debug('Behavioral constraint: preferring exploration over waiting');
      return 'explore';
    }

    // Combat situations
    if (context.combat.inCombat) {
      if (action === 'explore') {
        // In combat, prefer flee over explore
        return context.behavior.caution > 0.5 ? 'flee' : 'attack';
      }
    }

    return action;
  }

  /**
   * Calculate confidence in the AI decision
   */
  calculateConfidence(rawResponse) {
    // Simple confidence calculation based on response structure
    let confidence = 0.5;

    if (rawResponse.includes(':')) confidence += 0.2;
    if (rawResponse.length > 10) confidence += 0.1;
    if (rawResponse.length < 200) confidence += 0.1; // Not too verbose
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Make fallback decision using simple rules
   */
  makeFallbackDecision(gameState) {
    this.logger.info('Using fallback decision making');

    let action = 'wait';
    let reasoning = 'Default fallback action';

    // Rule-based decision making
    const healthPercent = gameState.player.health.current / gameState.player.health.max;
    
    if (gameState.combat.inCombat) {
      if (healthPercent < 0.3) {
        action = 'flee';
        reasoning = 'Low health in combat, fleeing';
      } else {
        action = 'attack';
        reasoning = 'In combat, attacking';
      }
    } else if (healthPercent < 0.5) {
      action = 'rest';
      reasoning = 'Low health, resting to recover';
    } else if (gameState.room.exits && gameState.room.exits.length > 0) {
      action = 'explore';
      reasoning = 'Healthy and have exits, exploring';
    } else {
      action = 'look';
      reasoning = 'No exits available, looking around';
    }

    return {
      action,
      reasoning,
      confidence: 0.3,
      timestamp: new Date().toISOString(),
      rawResponse: 'Fallback rule-based decision',
      isFallback: true
    };
  }

  /**
   * Get decision engine statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      lastDecisionTime: this.lastDecisionTime,
      model: this.ollamaConfig.model,
      baseUrl: this.ollamaConfig.baseUrl
    };
  }
}

module.exports = DecisionEngine;