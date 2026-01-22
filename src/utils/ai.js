/**
 * AI-Powered Task Suggestions Utility
 *
 * Integrates with Anthropic Claude API (Haiku model) to generate
 * intelligent task suggestions based on source content.
 */

import {
  getStoredAISuggestionsSettings,
  getStoredAISuggestionCache,
  setStoredAISuggestionCache,
} from './storage';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-3-haiku-20240307';
const MAX_TOKENS = 250;

/**
 * Generates a cache key from context
 */
function generateCacheKey(context) {
  const key = `${context.platform}:${context.sourceUrl}:${context.templateKey}`;
  return btoa(key).substring(0, 32);
}

/**
 * Checks if cached suggestion is still valid
 */
function isCacheValid(cachedEntry, ttl) {
  if (!cachedEntry || !cachedEntry.timestamp) return false;
  return Date.now() - cachedEntry.timestamp < ttl;
}

/**
 * Builds the prompt for Claude
 */
function buildPrompt(context, userLabels) {
  const labelNames = userLabels?.map(l => l.title).join(', ') || 'None available';

  return `You are helping create a task from web content. Respond with JSON only, no markdown.

Source platform: ${context.platform || 'unknown'}
Content type: ${context.action || 'generic'}
Page title: ${context.metadata?.title || context.metadata?.prTitle || context.metadata?.summary || 'Unknown'}
Additional context: ${JSON.stringify(context.metadata || {}).substring(0, 500)}

Available labels to choose from: ${labelNames}

Return a JSON object with these exact fields:
{
  "title": "Concise actionable task title starting with a verb (max 60 chars)",
  "timeEstimate": <estimated minutes as integer>,
  "suggestedLabels": ["label1", "label2"],
  "priority": "none" | "low" | "medium" | "high",
  "note": "Brief helpful description (1-2 sentences, optional)"
}

Rules:
- Title must start with an action verb (Review, Fix, Respond, Complete, etc.)
- Only suggest labels from the available list
- Time estimate should be realistic (5-120 minutes typically)
- Priority: "high" for urgent/blocking, "medium" for important, "low" for nice-to-have, "none" for routine`;
}

/**
 * Parses the AI response into structured suggestions
 */
function parseAIResponse(responseText, userLabels) {
  try {
    // Try to extract JSON from the response
    let jsonStr = responseText;

    // Handle potential markdown code blocks
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and sanitize
    const suggestions = {
      title: typeof parsed.title === 'string' ? parsed.title.substring(0, 100) : null,
      timeEstimate: typeof parsed.timeEstimate === 'number'
        ? parsed.timeEstimate * 60 * 1000 // Convert minutes to ms
        : null,
      suggestedLabels: [],
      priority: ['none', 'low', 'medium', 'high'].includes(parsed.priority)
        ? parsed.priority
        : 'none',
      note: typeof parsed.note === 'string' ? parsed.note.substring(0, 500) : null,
      isAISuggestion: true,
    };

    // Map suggested label names to actual label objects
    if (Array.isArray(parsed.suggestedLabels) && userLabels) {
      for (const labelName of parsed.suggestedLabels) {
        const matchedLabel = userLabels.find(
          l => l.title.toLowerCase() === labelName.toLowerCase()
        );
        if (matchedLabel) {
          suggestions.suggestedLabels.push(matchedLabel);
        }
      }
    }

    return suggestions;
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return null;
  }
}

/**
 * Calls the Claude API to generate suggestions
 */
export async function getAISuggestions(context, userLabels) {
  const settings = await getStoredAISuggestionsSettings();

  if (!settings.enabled || !settings.apiKey) {
    return null;
  }

  // Check cache first
  if (settings.cacheEnabled) {
    const cache = await getStoredAISuggestionCache();
    const cacheKey = generateCacheKey(context);
    const cachedEntry = cache[cacheKey];

    if (isCacheValid(cachedEntry, settings.cacheTTL)) {
      return { ...cachedEntry.suggestions, fromCache: true };
    }
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{
          role: 'user',
          content: buildPrompt(context, userLabels),
        }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Claude API error:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.text;

    if (!responseText) {
      return null;
    }

    const suggestions = parseAIResponse(responseText, userLabels);

    // Cache the result
    if (suggestions && settings.cacheEnabled) {
      const cache = await getStoredAISuggestionCache();
      const cacheKey = generateCacheKey(context);
      cache[cacheKey] = {
        suggestions,
        timestamp: Date.now(),
      };

      // Clean old cache entries
      const now = Date.now();
      for (const key of Object.keys(cache)) {
        if (!isCacheValid(cache[key], settings.cacheTTL)) {
          delete cache[key];
        }
      }

      await setStoredAISuggestionCache(cache);
    }

    return suggestions;
  } catch (error) {
    console.error('Failed to get AI suggestions:', error);
    return null;
  }
}

/**
 * Verifies an Anthropic API key by making a minimal request
 */
export async function verifyAnthropicApiKey(apiKey) {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: 'Say "OK"',
        }],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('API key verification failed:', error);
    return false;
  }
}
