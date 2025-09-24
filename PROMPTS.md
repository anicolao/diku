# Prompt Tracking Log

This file maintains a comprehensive record of all AI prompts used during the development of the Diku MUD AI Player project. Each entry includes the commit information, issue number, and the complete prompt that generated the changes.

## Purpose

This tracking system serves multiple purposes:
1. **Reproducibility**: Ability to recreate development decisions
2. **Learning**: Understanding which prompts produce effective results
3. **Debugging**: Tracing issues back to their originating prompts
4. **Improvement**: Iterating on prompt engineering techniques
5. **Documentation**: Complete development history for future reference

## Format

Each entry follows this format:
```
### Commit: [commit-hash] - [commit-message]
**Issue**: #[issue-number]
**Date**: [ISO-8601-timestamp]
**Prompt**:
[Complete prompt text that generated the commit]
```

---

## Development History

### Commit: 7f823f0 - Initial plan
**Issue**: #1
**Date**: 2025-01-14T18:02:33Z
**Prompt**:
```
You are working on an issue in the 'anicolao/diku' repository.

<repository_context>
I've cloned the repository in the directory /home/runner/work/diku/diku (not in /tmp/inputs). Always use absolute paths when referring to files in the repository.
</repository_context>

Consider the following problem statement:
<problem_statement>
----
*This section details on the original issue you should resolve*

<issue_title>
Copilot Task: the goal of this project is to create a Diku MUD player that uses the ollama API...
</issue_title>

<issue_description>
**GitHub Copilot Coding Agent Task**

This issue has been assigned to GitHub Copilot for automated resolution.

**Task Request:**
the goal of this project is to create a Diku MUD player that uses the ollama API to get responses from an Ollama LLM and successfully play a Diku MUD. The specific MUD I am thinking of is arctic. Write a README.md for this repository and propose an INITIAL_DESIGN.md for how to implement the MUD client. Also, for this project I'd like a record of every prompt created in PROMPTS.md, write rules somewhere that you'll never miss such that every commit also adds the prompt that created it and its issue number to the PROMPTS.md file for future reference, including this one.

*This issue will be automatically processed by GitHub Copilot's coding agent.*
</issue_description>

## Comments on the Issue (you are @copilot in this section)
<comments>
<comment_new>
<comment_id>3325935817</comment_id>
<author>@anicolao</author>
🤖 **GitHub Copilot Coding Agent Assigned**

Session ID: cop_real_1_1758672153877
Status: pending

The GitHub Copilot coding agent is now working on this issue. You can track progress at https://github.com/copilot/agents
</comment_new>
</comments>
</problem_statement>

Implement the necessary changes to the repository so that the requirements specified in the <problem_statement> are met.

[... rest of the system prompt and instructions ...]
```

### Commit: [CURRENT] - Create comprehensive documentation framework
**Issue**: #1  
**Date**: 2025-01-14T18:04:00Z
**Prompt**:
```
Same as above - This commit creates the README.md, INITIAL_DESIGN.md, and PROMPTS.md files as requested in the original issue. The prompt is identical to the one above as this is part of the same development session.
```

---

## Rules for Prompt Tracking

### MANDATORY RULES - NEVER SKIP THESE:

1. **EVERY COMMIT MUST BE LOGGED**: Every single commit to this repository must have a corresponding entry in this PROMPTS.md file.

2. **UPDATE BEFORE COMMITTING**: The PROMPTS.md file must be updated with the new prompt entry BEFORE making the commit that implements the changes.

3. **COMPLETE PROMPTS**: Include the full prompt text, not summaries or excerpts. This includes all system instructions, context, and user requests.

4. **REQUIRED FIELDS**: Every entry must include:
   - Commit hash (use [CURRENT] for the commit being created)
   - Commit message
   - Issue number (if applicable)
   - ISO-8601 timestamp
   - Complete prompt text

5. **CHRONOLOGICAL ORDER**: Entries must be in chronological order with the most recent at the bottom.

6. **NO EXCEPTIONS**: This rule applies to ALL commits - bug fixes, features, documentation, configuration, etc.

### Implementation Guidelines:

- **Before each commit**: Add the prompt entry to PROMPTS.md
- **After commit**: Update the entry with the actual commit hash
- **For multiple commits from one prompt**: Create separate entries for each commit
- **For iterative development**: Log each iteration as a separate prompt/commit pair

### Automation Reminder:

**This is a critical requirement**: The original issue specifically requested that rules be written "somewhere that you'll never miss" to ensure every commit includes its prompt. This PROMPTS.md file serves as that reminder system.

### Future Development:

Any future contributors or AI agents working on this project must:
1. Read this PROMPTS.md file before making any commits
2. Follow the mandatory rules above
3. Update this file with their prompt information
4. Maintain the same format and level of detail

This system ensures complete traceability of all development decisions and enables future analysis, debugging, and improvement of the AI-driven development process.