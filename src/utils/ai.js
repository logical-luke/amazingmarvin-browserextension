/**
 * AI-Powered Task Suggestions Utility
 *
 * Supports multiple AI providers:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google (Gemini)
 */

import {
  getStoredAISuggestionsSettings,
  getStoredAISuggestionCache,
  setStoredAISuggestionCache,
} from './storage';

// Provider configurations
export const AI_PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    models: [
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fast & affordable' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best balance' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Faster, smarter' },
    ],
    defaultModel: 'claude-3-haiku-20240307',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-api...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Fast GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legacy, cheapest' },
    ],
    defaultModel: 'gpt-4o-mini',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  google: {
    name: 'Google',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast & affordable' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: 'Latest experimental' },
    ],
    defaultModel: 'gemini-1.5-flash',
    keyPrefix: 'AI',
    keyPlaceholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
};

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
 * Builds the prompt for AI providers
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
 * Calls Anthropic Claude API
 */
async function callAnthropicAPI(prompt, apiKey, model) {
  const response = await fetch(AI_PROVIDERS.anthropic.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Anthropic API error:', response.status, errorData);
    return null;
  }

  const data = await response.json();
  return data.content?.[0]?.text || null;
}

/**
 * Calls OpenAI API
 */
async function callOpenAIAPI(prompt, apiKey, model) {
  const response = await fetch(AI_PROVIDERS.openai.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('OpenAI API error:', response.status, errorData);
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

/**
 * Calls Google Gemini API
 */
async function callGoogleAPI(prompt, apiKey, model) {
  const url = `${AI_PROVIDERS.google.apiUrl}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: MAX_TOKENS,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Google API error:', response.status, errorData);
    return null;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

/**
 * Calls the appropriate AI provider API
 */
async function callProviderAPI(provider, prompt, apiKey, model) {
  switch (provider) {
    case 'anthropic':
      return callAnthropicAPI(prompt, apiKey, model);
    case 'openai':
      return callOpenAIAPI(prompt, apiKey, model);
    case 'google':
      return callGoogleAPI(prompt, apiKey, model);
    default:
      console.error('Unknown AI provider:', provider);
      return null;
  }
}

/**
 * Gets AI suggestions from the configured provider
 */
export async function getAISuggestions(context, userLabels) {
  const settings = await getStoredAISuggestionsSettings();

  if (!settings.enabled || !settings.apiKey) {
    return null;
  }

  const provider = settings.provider || 'anthropic';
  const model = settings.model || AI_PROVIDERS[provider]?.defaultModel;

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
    const prompt = buildPrompt(context, userLabels);
    const responseText = await callProviderAPI(provider, prompt, settings.apiKey, model);

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
 * Verifies an API key for the specified provider
 */
export async function verifyApiKey(provider, apiKey) {
  try {
    const testPrompt = 'Say "OK"';
    const model = AI_PROVIDERS[provider]?.defaultModel;

    if (!model) {
      return false;
    }

    const response = await callProviderAPI(provider, testPrompt, apiKey, model);
    return response !== null;
  } catch (error) {
    console.error('API key verification failed:', error);
    return false;
  }
}

// Legacy export for backwards compatibility
export const verifyAnthropicApiKey = (apiKey) => verifyApiKey('anthropic', apiKey);
