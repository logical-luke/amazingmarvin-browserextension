/**
 * Task Context Detection and Smart Autocomplete Utility
 *
 * Detects source context when task modal opens (which platform/page it came from)
 * and provides context-aware suggestions for task title, time estimate, labels, and priority.
 */

// Title templates per context type - all start with action verbs
export const TITLE_TEMPLATES = {
  // GitHub contexts
  'github-review': 'Review PR #{number}: {title}',
  'github-merge': 'Merge PR #{number}: {title}',
  'github-fix-pipeline': 'Fix pipelines for PR #{number}: {title}',
  'github-address-review': 'Address review for PR #{number}: {title}',
  'github-reply': 'Respond to @{author} on PR #{number}',
  'github-comment': 'Respond to @{author} on {contextType} #{number}',
  'github-notification-review': 'Review PR #{number}: {title}',
  'github-notification-mention': 'Respond to mention in #{number}',
  'github-notification-assign': 'Work on {contextType} #{number}: {title}',
  'github-notification-ci': 'Check CI for PR #{number}: {title}',
  'github-notification': 'Handle {title}',
  'github-issue': 'Work on Issue #{number}: {title}',
  'github-pr': 'Check PR #{number}: {title}',

  // Jira contexts - all start with action verbs
  'jira-task': 'Complete {key}: {summary}',
  'jira-bug': 'Fix {key}: {summary}',
  'jira-story': 'Implement {key}: {summary}',
  'jira-epic': 'Complete {key}: {summary}',

  // Slack contexts - action verbs, no "Re:"
  'slack-reply': 'Respond to [{channel}] {messagePreview}',
  'slack-thread': 'Continue thread in [{channel}]',
  'slack-dm': 'Message {senderName}',

  // Gmail contexts
  'gmail-reply': 'Reply to: {subject}',
  'gmail-followup': 'Follow up on: {subject}',

  // Generic
  'generic': '{title}',
};

// Default time estimates in milliseconds per action type
export const DEFAULT_TIME_ESTIMATES = {
  // GitHub
  'review': 30 * 60 * 1000,           // 30 min
  'merge': 5 * 60 * 1000,             // 5 min
  'fix-pipeline': 60 * 60 * 1000,     // 1 hour
  'address-review': 45 * 60 * 1000,   // 45 min
  'reply': 15 * 60 * 1000,            // 15 min
  'comment': 10 * 60 * 1000,          // 10 min

  // Jira
  'jira-bug': 60 * 60 * 1000,         // 1 hour
  'jira-task': 30 * 60 * 1000,        // 30 min
  'jira-story': 2 * 60 * 60 * 1000,   // 2 hours

  // Slack
  'slack-reply': 10 * 60 * 1000,      // 10 min
  'slack-thread': 15 * 60 * 1000,     // 15 min

  // Gmail
  'gmail-reply': 15 * 60 * 1000,      // 15 min
  'gmail-followup': 20 * 60 * 1000,   // 20 min

  // Default
  'default': 30 * 60 * 1000,          // 30 min
};

// Label keyword mappings for auto-suggestion
export const LABEL_KEYWORDS = {
  // GitHub-related
  'review': ['review', 'code review', 'pr'],
  'bug': ['bug', 'fix', 'issue', 'error'],
  'feature': ['feature', 'enhancement', 'new'],
  'urgent': ['urgent', 'critical', 'high priority', 'blocker'],
  'documentation': ['docs', 'documentation', 'readme'],

  // Work contexts
  'meeting': ['meeting', 'call', 'sync'],
  'email': ['email', 'reply', 'respond'],
  'slack': ['slack', 'message', 'dm'],
};

// Priority mappings
export const PRIORITY_MAPPINGS = {
  // Jira priorities
  'highest': 3,    // Red star in Marvin
  'high': 2,       // Orange star
  'medium': 1,     // Yellow star
  'low': 0,
  'lowest': 0,

  // GitHub
  'failing-ci': 2, // Orange - needs attention
  'approved': 1,   // Yellow - ready to merge
  'review-requested': 2, // Orange - someone is waiting
};

/**
 * Detects the platform from a URL
 * @param {string} url - The URL to analyze
 * @returns {string|null} - Platform name or null
 */
export function detectPlatform(url) {
  if (!url) return null;

  if (url.includes('github.com')) return 'github';
  if (url.includes('atlassian.net') || url.includes('jira')) return 'jira';
  if (url.includes('slack.com') || url.includes('app.slack.com')) return 'slack';
  if (url.includes('mail.google.com')) return 'gmail';

  return null;
}

/**
 * Detects task context from source URL and metadata
 * @param {string} sourceUrl - The source URL
 * @param {Object} metadata - Additional metadata from the page
 * @returns {Object} - Context object with action, template key, and suggestions
 */
export function detectTaskContext(sourceUrl, metadata = {}) {
  const platform = detectPlatform(sourceUrl);

  if (!platform) {
    return {
      platform: null,
      action: 'generic',
      templateKey: 'generic',
      suggestedEstimate: DEFAULT_TIME_ESTIMATES.default,
      suggestedPriority: 0,
      labelKeywords: [],
    };
  }

  switch (platform) {
    case 'github':
      return detectGitHubContext(sourceUrl, metadata);
    case 'jira':
      return detectJiraContext(sourceUrl, metadata);
    case 'slack':
      return detectSlackContext(sourceUrl, metadata);
    case 'gmail':
      return detectGmailContext(sourceUrl, metadata);
    default:
      return {
        platform,
        action: 'generic',
        templateKey: 'generic',
        suggestedEstimate: DEFAULT_TIME_ESTIMATES.default,
        suggestedPriority: 0,
        labelKeywords: [],
      };
  }
}

/**
 * Detects GitHub-specific context
 */
function detectGitHubContext(sourceUrl, metadata) {
  const context = {
    platform: 'github',
    action: 'generic',
    templateKey: 'github-pr',
    suggestedEstimate: DEFAULT_TIME_ESTIMATES.default,
    suggestedPriority: 0,
    labelKeywords: [],
  };

  // Check for PR context
  if (sourceUrl.includes('/pull/') || metadata.type === 'pr') {
    // Not own PR - always suggest "Review" regardless of approval status
    if (!metadata.isOwnPR) {
      context.action = 'review';
      context.templateKey = 'github-review';
      context.suggestedEstimate = DEFAULT_TIME_ESTIMATES.review;
      context.suggestedPriority = 1;
      context.labelKeywords = ['review'];
      return context;
    }

    // Own PR - check various states
    // Check pipeline status first (highest priority)
    if (metadata.checkStatus === 'failing') {
      context.action = 'fix-pipeline';
      context.templateKey = 'github-fix-pipeline';
      context.suggestedEstimate = DEFAULT_TIME_ESTIMATES['fix-pipeline'];
      context.suggestedPriority = PRIORITY_MAPPINGS['failing-ci'];
      context.labelKeywords = ['bug', 'urgent'];
      return context;
    }

    // Check if changes requested on own PR
    if (metadata.reviewStatus === 'changes_requested') {
      context.action = 'address-review';
      context.templateKey = 'github-address-review';
      context.suggestedEstimate = DEFAULT_TIME_ESTIMATES['address-review'];
      context.suggestedPriority = PRIORITY_MAPPINGS['review-requested'];
      context.labelKeywords = ['review'];
      return context;
    }

    // Check if approved and ready to merge (own PR only)
    if (metadata.reviewStatus === 'approved') {
      context.action = 'merge';
      context.templateKey = 'github-merge';
      context.suggestedEstimate = DEFAULT_TIME_ESTIMATES.merge;
      context.suggestedPriority = PRIORITY_MAPPINGS.approved;
      return context;
    }

    // Default own PR context
    context.templateKey = 'github-pr';
    return context;
  }

  // Check for issue context
  if (sourceUrl.includes('/issues/') || metadata.type === 'issue') {
    context.action = 'issue';
    context.templateKey = 'github-issue';
    context.labelKeywords = ['bug'];
    return context;
  }

  // Check for comment context
  if (metadata.type === 'comment') {
    context.action = 'reply';
    context.templateKey = metadata.contextType === 'pr' ? 'github-reply' : 'github-comment';
    context.suggestedEstimate = DEFAULT_TIME_ESTIMATES.reply;
    context.labelKeywords = ['review'];
    return context;
  }

  // Check for notification context
  if (metadata.type === 'notification' || sourceUrl.includes('/notifications')) {
    switch (metadata.reason) {
      case 'review_requested':
        context.action = 'review';
        context.templateKey = 'github-notification-review';
        context.suggestedEstimate = DEFAULT_TIME_ESTIMATES.review;
        context.suggestedPriority = PRIORITY_MAPPINGS['review-requested'];
        context.labelKeywords = ['review'];
        break;
      case 'mention':
        context.action = 'respond';
        context.templateKey = 'github-notification-mention';
        context.suggestedEstimate = DEFAULT_TIME_ESTIMATES.reply;
        break;
      case 'assign':
        context.action = 'work';
        context.templateKey = 'github-notification-assign';
        context.suggestedEstimate = DEFAULT_TIME_ESTIMATES.default;
        break;
      case 'ci_activity':
        context.action = 'check-ci';
        context.templateKey = 'github-notification-ci';
        context.suggestedEstimate = DEFAULT_TIME_ESTIMATES['fix-pipeline'];
        break;
      default:
        context.templateKey = 'github-notification';
    }
    return context;
  }

  return context;
}

/**
 * Detects Jira-specific context
 */
function detectJiraContext(sourceUrl, metadata) {
  const context = {
    platform: 'jira',
    action: 'jira-task',
    templateKey: 'jira-task',
    suggestedEstimate: DEFAULT_TIME_ESTIMATES['jira-task'],
    suggestedPriority: 0,
    labelKeywords: [],
  };

  // Map issue type to template
  const issueType = (metadata.issueType || '').toLowerCase();

  if (issueType.includes('bug')) {
    context.action = 'jira-bug';
    context.templateKey = 'jira-bug';
    context.suggestedEstimate = DEFAULT_TIME_ESTIMATES['jira-bug'];
    context.labelKeywords = ['bug'];
  } else if (issueType.includes('story')) {
    context.action = 'jira-story';
    context.templateKey = 'jira-story';
    context.suggestedEstimate = DEFAULT_TIME_ESTIMATES['jira-story'];
    context.labelKeywords = ['feature'];
  } else if (issueType.includes('epic')) {
    context.templateKey = 'jira-epic';
  }

  // Map priority
  const priority = (metadata.priority || '').toLowerCase();
  if (priority.includes('highest') || priority.includes('critical')) {
    context.suggestedPriority = PRIORITY_MAPPINGS.highest;
    context.labelKeywords.push('urgent');
  } else if (priority.includes('high')) {
    context.suggestedPriority = PRIORITY_MAPPINGS.high;
  } else if (priority.includes('medium')) {
    context.suggestedPriority = PRIORITY_MAPPINGS.medium;
  }

  return context;
}

/**
 * Detects Slack-specific context
 */
function detectSlackContext(sourceUrl, metadata) {
  const context = {
    platform: 'slack',
    action: 'slack-reply',
    templateKey: 'slack-reply',
    suggestedEstimate: DEFAULT_TIME_ESTIMATES['slack-reply'],
    suggestedPriority: 0,
    labelKeywords: ['slack'],
  };

  if (metadata.isThread) {
    context.action = 'slack-thread';
    context.templateKey = 'slack-thread';
    context.suggestedEstimate = DEFAULT_TIME_ESTIMATES['slack-thread'];
  }

  // Check if DM
  const channelName = (metadata.channelName || '').toLowerCase();
  if (channelName.includes('direct message') || metadata.isDM) {
    context.action = 'slack-dm';
    context.templateKey = 'slack-dm';
  }

  return context;
}

/**
 * Detects Gmail-specific context
 */
function detectGmailContext(sourceUrl, metadata) {
  return {
    platform: 'gmail',
    action: 'gmail-reply',
    templateKey: 'gmail-reply',
    suggestedEstimate: DEFAULT_TIME_ESTIMATES['gmail-reply'],
    suggestedPriority: 0,
    labelKeywords: ['email'],
  };
}

/**
 * Generates a task title from template and metadata
 * @param {string} templateKey - The template key to use
 * @param {Object} metadata - The metadata to fill in the template
 * @returns {string} - The generated title
 */
export function generateTitle(templateKey, metadata) {
  const template = TITLE_TEMPLATES[templateKey] || TITLE_TEMPLATES.generic;

  let title = template;

  // Replace placeholders with metadata values
  const placeholders = {
    '{number}': metadata.prNumber || metadata.issueNumber || metadata.contextNumber || '',
    '{title}': metadata.prTitle || metadata.title || metadata.summary || '',
    '{author}': metadata.author || metadata.senderName || '',
    '{key}': metadata.issueKey || '',
    '{summary}': metadata.summary || metadata.title || '',
    '{channel}': metadata.channelName || '',
    '{messagePreview}': truncateText(metadata.messageText || metadata.messagePreview || '', 50),
    '{senderName}': metadata.senderName || '',
    '{subject}': metadata.emailSubject || metadata.subject || '',
    '{contextType}': metadata.contextType === 'pr' ? 'PR' : 'Issue',
  };

  for (const [placeholder, value] of Object.entries(placeholders)) {
    title = title.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  // Clean up any remaining empty placeholders
  title = title.replace(/\{[^}]+\}/g, '').trim();

  return title;
}

/**
 * Truncates text to a specified length
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generates a formatted title with URL link (Marvin markdown format)
 * @param {string} templateKey - The template key
 * @param {Object} metadata - The metadata
 * @param {string} url - The URL to link to
 * @returns {string} - The formatted title with link
 */
export function generateTitleWithLink(templateKey, metadata, url) {
  const title = generateTitle(templateKey, metadata);

  if (!url) return title;

  return `[${title}](${url})`;
}

/**
 * Suggests labels based on context keywords and user's existing labels
 * @param {Array} userLabels - The user's existing labels from Marvin
 * @param {Array} contextKeywords - Keywords from the context
 * @returns {Array} - Suggested label objects
 */
export function suggestLabels(userLabels, contextKeywords) {
  if (!userLabels || !userLabels.length || !contextKeywords || !contextKeywords.length) {
    return [];
  }

  const suggestions = [];

  for (const keyword of contextKeywords) {
    const keywordLower = keyword.toLowerCase();
    const keywordMappings = LABEL_KEYWORDS[keywordLower] || [keywordLower];

    for (const label of userLabels) {
      const labelTitle = (label.title || '').toLowerCase();

      // Check if label matches any of the keyword mappings
      for (const mapping of keywordMappings) {
        if (labelTitle.includes(mapping) || mapping.includes(labelTitle)) {
          if (!suggestions.find((s) => s._id === label._id)) {
            suggestions.push(label);
          }
          break;
        }
      }
    }
  }

  return suggestions.slice(0, 3); // Limit to 3 suggestions
}

/**
 * Creates a complete task context object from URL and metadata
 * @param {string} sourceUrl - The source URL
 * @param {Object} metadata - Page metadata
 * @param {Object} settings - User's smart autocomplete settings
 * @returns {Object} - Complete task context with all suggestions
 */
export function createTaskContext(sourceUrl, metadata = {}, settings = {}) {
  const context = detectTaskContext(sourceUrl, metadata);

  // Apply user's custom time estimates if available
  if (settings.customEstimates && settings.customEstimates[context.action]) {
    context.suggestedEstimate = settings.customEstimates[context.action];
  }

  // Generate suggested title
  context.suggestedTitle = generateTitle(context.templateKey, metadata);
  context.suggestedTitleWithLink = generateTitleWithLink(
    context.templateKey,
    metadata,
    metadata.url || metadata.prUrl || metadata.issueUrl || metadata.permalink || sourceUrl
  );

  // Add raw metadata for reference
  context.metadata = metadata;
  context.sourceUrl = sourceUrl;

  return context;
}

/**
 * Quick action buttons for common task types per platform
 */
export const QUICK_ACTIONS = {
  github: [
    { action: 'review', label: 'Review', icon: 'eye', templateKey: 'github-review' },
    { action: 'merge', label: 'Merge', icon: 'git-merge', templateKey: 'github-merge' },
    { action: 'fix-pipeline', label: 'Fix CI', icon: 'alert-circle', templateKey: 'github-fix-pipeline' },
    { action: 'reply', label: 'Reply', icon: 'message-circle', templateKey: 'github-reply' },
  ],
  jira: [
    { action: 'jira-task', label: 'Task', icon: 'check-square', templateKey: 'jira-task' },
    { action: 'jira-bug', label: 'Bug Fix', icon: 'bug', templateKey: 'jira-bug' },
  ],
  slack: [
    { action: 'slack-reply', label: 'Reply', icon: 'message-circle', templateKey: 'slack-reply' },
    { action: 'slack-thread', label: 'Thread', icon: 'message-square', templateKey: 'slack-thread' },
  ],
  gmail: [
    { action: 'gmail-reply', label: 'Reply', icon: 'mail', templateKey: 'gmail-reply' },
    { action: 'gmail-followup', label: 'Follow up', icon: 'clock', templateKey: 'gmail-followup' },
  ],
};

/**
 * Gets quick actions for a platform
 * @param {string} platform - The platform name
 * @returns {Array} - Array of quick action objects
 */
export function getQuickActions(platform) {
  return QUICK_ACTIONS[platform] || [];
}
