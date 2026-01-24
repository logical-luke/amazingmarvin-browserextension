import { getStoredGitHubSettings, getStoredToken } from "../utils/storage";
import { addTask } from "../utils/api";
import { formatDate } from "../utils/dates";
import { TITLE_TEMPLATES } from "../utils/taskContext";

const logo = chrome.runtime.getURL("static/logo.png");

// GitHub-specific selectors
const SELECTORS = {
  // PR Detail View
  prHeader: '.gh-header-actions',
  prHeaderMeta: '.gh-header-meta',
  prTitle: '.js-issue-title',
  prTitleLink: '.js-issue-title-link',
  prNumber: '.gh-header-number',
  prState: '.State',
  prDescription: '.js-comment-body',
  prAuthor: '.pull-header-author .author, .author.pull-header-link',

  // Merge status and checks
  mergeStatusList: '.merge-status-list',
  statusHeading: '.status-heading',
  mergeStatusItem: '.merge-status-item',
  statusIcon: '.octicon',

  // Review status
  reviewStatus: '.review-status-item',
  reviewersStatus: '.reviewers-status-icon',

  // PR List View (github.com/pulls and repo pulls page)
  prListRow: '.js-issue-row',
  prListTitle: '.Link--primary',
  prListNumber: '.opened-by',
  prListRepo: '.text-small a[data-hovercard-type="repository"]',

  // User detection
  userLogin: 'meta[name="user-login"]',
  userAvatar: '.AppHeader-user',

  // Timeline Comments (PR/Issue discussion)
  timelineComment: '.timeline-comment',
  timelineCommentContainer: '.js-comment-container',
  timelineCommentHeader: '.timeline-comment-header',
  timelineCommentBody: '.comment-body',
  timelineCommentActions: '.timeline-comment-actions',
  commentAuthor: '.timeline-comment-header .author',
  commentTimestamp: '.timeline-comment-header .timestamp, .timeline-comment-header relative-time',

  // Review Comments (inline diff)
  reviewComment: '.review-comment',
  reviewThread: '.js-resolvable-timeline-thread-container',
  reviewCommentBody: '.review-comment .comment-body',
  suggestionBlock: '.suggestion, .blob-code-suggestion',
  fileHeader: '.file-header',
  filePath: '.file-info a',

  // Notifications Page
  notificationsList: '.notifications-list',
  notificationItem: '.notifications-list-item, [data-notification-id]',
  notificationLink: '.notification-list-item-link',
  notificationTitle: '.markdown-title',
  notificationReason: '.notification-reason',
  notificationRepo: '.notification-list-item-repo',
  notificationMeta: '.notification-list-item-meta',
};

/*
    ***************
    Success Message
    ***************
*/

const marvinSuccessMessage = document.createElement("div");
document.body.appendChild(marvinSuccessMessage);

let marvinSuccessStyles = document.createElement("style");
marvinSuccessStyles.appendChild(
  document.createTextNode(`
    .marvinSuccessMessageVisible {
        display: grid;
        place-items: center;
    }

    .marvinSuccessMessageHidden {
        display: none;
    }

    .marvinSuccessMessage {
        background: linear-gradient(165deg, #26d6c4 0%, #10b1d3 100%);
        box-shadow: 0 10px 15px -3px #0000001a, 0 4px 6px -4px #0000001a;
        color: white;
        font-size: 18px;
        position: fixed !important;
        bottom: 5%;
        left: 50%;
        transform: translate(-50%, 0);
        width: 350px;
        height: 75px;
        z-index: 9999;
        border-radius: 10px;
        text-align: center;
        padding: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
    }`)
);
document.getElementsByTagName("head")[0].appendChild(marvinSuccessStyles);

marvinSuccessMessage.classList.add(
  "marvinSuccessMessage",
  "marvinSuccessMessageHidden"
);

function showSuccessMessage(status) {
  if (status === "success") {
    marvinSuccessMessage.textContent = "Task successfully added to Marvin!";
  } else if (status === "noToken") {
    marvinSuccessMessage.textContent =
      "Failed to add Task to Marvin! Please add your Marvin API token in the extension settings.";
  } else if (status === "reload") {
    marvinSuccessMessage.textContent =
      "Extension was updated. Please reload this page to continue using Marvin.";
  } else {
    marvinSuccessMessage.textContent = "Failed to add Task to Marvin!";
  }

  marvinSuccessMessage.classList.remove("marvinSuccessMessageHidden");
  marvinSuccessMessage.classList.add("marvinSuccessMessageVisible");
  setTimeout(
    () => {
      marvinSuccessMessage.classList.remove("marvinSuccessMessageVisible");
      marvinSuccessMessage.classList.add("marvinSuccessMessageHidden");
    },
    status === "noToken" || status === "reload" ? 6000 : 2000
  );
}

/**
 * Checks if extension context is still valid
 */
function isExtensionContextValid() {
  try {
    chrome.runtime.getURL("");
    return true;
  } catch (e) {
    return false;
  }
}

/*
    ***************
    Metadata Extraction
    ***************
*/

/**
 * Gets the logged-in user's username
 */
function getLoggedInUser() {
  const metaTag = document.querySelector(SELECTORS.userLogin);
  if (metaTag) {
    return metaTag.getAttribute('content');
  }
  return null;
}

/**
 * Extracts PR number from URL
 */
function getPRNumberFromUrl() {
  const match = window.location.pathname.match(/\/pull\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extracts repository info from URL
 */
function getRepositoryFromUrl() {
  // Match both /pull/ and /issues/ URLs
  const match = window.location.pathname.match(/\/([^/]+)\/([^/]+)\/(pull|issues)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
      fullName: `${match[1]}/${match[2]}`,
    };
  }
  return null;
}

/**
 * Gets check status from merge status area
 */
function getCheckStatus() {
  const mergeStatus = document.querySelector(SELECTORS.mergeStatusList);
  if (!mergeStatus) return null;

  // Check for failing status
  if (mergeStatus.querySelector('.octicon-x, .color-fg-danger')) {
    return 'failing';
  }

  // Check for pending status
  if (mergeStatus.querySelector('.octicon-dot-fill, .color-fg-attention')) {
    return 'pending';
  }

  // Check for passing status
  if (mergeStatus.querySelector('.octicon-check, .color-fg-success')) {
    return 'passing';
  }

  // Try status heading text
  const statusHeading = document.querySelector(SELECTORS.statusHeading);
  if (statusHeading) {
    const text = statusHeading.textContent.toLowerCase();
    if (text.includes('failing') || text.includes('failed')) return 'failing';
    if (text.includes('pending') || text.includes('waiting')) return 'pending';
    if (text.includes('passing') || text.includes('passed') || text.includes('success')) return 'passing';
  }

  return null;
}

/**
 * Gets review status from reviewers area
 */
function getReviewStatus() {
  const reviewItems = document.querySelectorAll(SELECTORS.reviewStatus);
  if (!reviewItems.length) return null;

  // Check for changes requested
  for (const item of reviewItems) {
    if (item.querySelector('.octicon-file-diff, .color-fg-danger')) {
      return 'changes_requested';
    }
  }

  // Check for approved
  for (const item of reviewItems) {
    if (item.querySelector('.octicon-check, .color-fg-success')) {
      return 'approved';
    }
  }

  // Check for pending review
  for (const item of reviewItems) {
    if (item.querySelector('.octicon-eye')) {
      return 'pending';
    }
  }

  return null;
}

/**
 * Gets PR description (first comment body, truncated)
 */
function getPRDescription() {
  const descElement = document.querySelector(SELECTORS.prDescription);
  if (!descElement) return '';

  const text = descElement.textContent.trim();
  return text.length > 500 ? text.substring(0, 497) + '...' : text;
}

/**
 * Extracts linked Jira/issue references from PR title and description
 * Looks for patterns like PROJ-123, PROJECT-456, etc.
 * @returns {Array} Array of linked issue references
 */
function extractLinkedIssues() {
  const linkedIssues = new Set();

  // Get PR title
  const titleElement = document.querySelector(SELECTORS.prTitle) ||
                       document.querySelector(SELECTORS.prTitleLink);
  if (titleElement) {
    const titleMatches = titleElement.textContent.match(/[A-Z][A-Z0-9]+-\d+/gi);
    if (titleMatches) {
      titleMatches.forEach(m => linkedIssues.add(m.toUpperCase()));
    }
  }

  // Get PR description
  const descElement = document.querySelector(SELECTORS.prDescription);
  if (descElement) {
    const descMatches = descElement.textContent.match(/[A-Z][A-Z0-9]+-\d+/gi);
    if (descMatches) {
      descMatches.forEach(m => linkedIssues.add(m.toUpperCase()));
    }
  }

  // Also check for GitHub issue references like #123
  const repository = getRepositoryFromUrl();
  if (repository) {
    // Look for issue links in the sidebar
    const linkedIssueElements = document.querySelectorAll('[data-hovercard-type="issue"], [data-hovercard-type="pull_request"]');
    linkedIssueElements.forEach(el => {
      const href = el.getAttribute('href') || '';
      const match = href.match(/\/issues\/(\d+)|\/pull\/(\d+)/);
      if (match) {
        const num = match[1] || match[2];
        linkedIssues.add(`#${num}`);
      }
    });
  }

  return Array.from(linkedIssues).slice(0, 10); // Limit to 10
}

/**
 * Gets a summary of review comments
 * @returns {Object} Summary of review activity
 */
function getReviewCommentsSummary() {
  const reviewComments = document.querySelectorAll(SELECTORS.reviewComment);
  const timelineComments = document.querySelectorAll(SELECTORS.timelineComment);

  const summary = {
    reviewCommentCount: reviewComments.length,
    timelineCommentCount: timelineComments.length,
    hasUnresolvedThreads: false,
    hasSuggestions: false,
    unresolvedCount: 0,
  };

  // Check for unresolved threads
  const unresolvedThreads = document.querySelectorAll('.js-resolvable-thread-container:not(.is-resolved)');
  summary.hasUnresolvedThreads = unresolvedThreads.length > 0;
  summary.unresolvedCount = unresolvedThreads.length;

  // Check for suggestions
  summary.hasSuggestions = document.querySelectorAll('.suggestion, .blob-code-suggestion').length > 0;

  return summary;
}

/**
 * Gets PR metadata from the detail view
 */
function getPRMetadataFromDetailView() {
  const prNumber = getPRNumberFromUrl();
  if (!prNumber) return null;

  const repository = getRepositoryFromUrl();

  // Get PR title
  const titleElement = document.querySelector(SELECTORS.prTitle) ||
                       document.querySelector(SELECTORS.prTitleLink);
  const prTitle = titleElement ? titleElement.textContent.trim() : 'Pull Request';

  // Get author
  const authorElement = document.querySelector(SELECTORS.prAuthor);
  const author = authorElement ? authorElement.textContent.trim() : null;

  // Determine if this is the user's own PR
  const loggedInUser = getLoggedInUser();
  const isOwnPR = loggedInUser && author && loggedInUser.toLowerCase() === author.toLowerCase();

  return {
    prNumber,
    prTitle,
    prUrl: window.location.href,
    author,
    repository: repository ? repository.fullName : null,
    checkStatus: getCheckStatus(),
    reviewStatus: getReviewStatus(),
    isOwnPR,
    description: getPRDescription(),
    linkedIssues: extractLinkedIssues(),
    reviewSummary: getReviewCommentsSummary(),
  };
}

/**
 * Gets PR metadata from a list row
 */
function getPRMetadataFromListRow(row) {
  // Get PR title and URL from the link
  const titleLink = row.querySelector(SELECTORS.prListTitle);
  if (!titleLink) return null;

  const prTitle = titleLink.textContent.trim();
  const prUrl = titleLink.href;

  // Extract PR number from URL or text
  const urlMatch = prUrl.match(/\/pull\/(\d+)/);
  const prNumber = urlMatch ? urlMatch[1] : null;
  if (!prNumber) return null;

  // Extract repository from URL
  const repoMatch = prUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull/);
  const repository = repoMatch ? repoMatch[1] : null;

  // Get author - usually in the "opened by" section
  const openedByElement = row.querySelector(SELECTORS.prListNumber);
  let author = null;
  if (openedByElement) {
    const authorLink = openedByElement.querySelector('a.Link--muted');
    if (authorLink) {
      author = authorLink.textContent.trim();
    }
  }

  // Determine if this is the user's own PR
  const loggedInUser = getLoggedInUser();
  const isOwnPR = loggedInUser && author && loggedInUser.toLowerCase() === author.toLowerCase();

  // Check for status icons in the row
  let checkStatus = null;
  if (row.querySelector('.octicon-x, .color-fg-danger')) {
    checkStatus = 'failing';
  } else if (row.querySelector('.octicon-dot-fill, .color-fg-attention')) {
    checkStatus = 'pending';
  } else if (row.querySelector('.octicon-check, .color-fg-success')) {
    checkStatus = 'passing';
  }

  return {
    prNumber,
    prTitle,
    prUrl,
    author,
    repository,
    checkStatus,
    reviewStatus: null, // Not easily available in list view
    isOwnPR,
    description: '', // Not available in list view
  };
}

/**
 * Gets context type and number from current URL
 */
function getContextFromUrl() {
  const prMatch = window.location.pathname.match(/\/pull\/(\d+)/);
  if (prMatch) return { type: 'pr', number: prMatch[1] };

  const issueMatch = window.location.pathname.match(/\/issues\/(\d+)/);
  if (issueMatch) return { type: 'issue', number: issueMatch[1] };

  return null;
}

/**
 * Gets comment metadata from a timeline comment element
 */
function getCommentMetadata(commentElement) {
  const context = getContextFromUrl();
  if (!context) return null;

  // Get author
  const authorEl = commentElement.querySelector('.author');
  const author = authorEl ? authorEl.textContent.trim() : 'Unknown';

  // Get comment content (truncated)
  const bodyEl = commentElement.querySelector('.comment-body');
  const content = bodyEl ? bodyEl.textContent.trim() : '';
  const truncatedContent = content.length > 500
    ? content.substring(0, 497) + '...'
    : content;

  // Get permalink from timestamp link
  const timestampEl = commentElement.querySelector('.timestamp');
  const permalink = timestampEl?.href || window.location.href;

  const repository = getRepositoryFromUrl();

  return {
    author,
    content: truncatedContent,
    contextType: context.type,
    contextNumber: context.number,
    permalink,
    repository: repository ? repository.fullName : null,
    isReviewComment: false,
    hasSuggestion: false,
    filePath: null,
  };
}

/**
 * Gets review comment metadata (inline diff comments)
 */
function getReviewCommentMetadata(commentElement) {
  const context = getContextFromUrl();
  if (!context) return null;

  // Get author
  const authorEl = commentElement.querySelector('.author');
  const author = authorEl ? authorEl.textContent.trim() : 'Unknown';

  // Get comment content (truncated)
  const bodyEl = commentElement.querySelector('.comment-body');
  const content = bodyEl ? bodyEl.textContent.trim() : '';
  const truncatedContent = content.length > 500
    ? content.substring(0, 497) + '...'
    : content;

  // Check for suggestion
  const hasSuggestion = !!commentElement.querySelector('.suggestion, .blob-code-suggestion');

  // Get file path if available
  const fileContainer = commentElement.closest('.file');
  const fileHeader = fileContainer?.querySelector('.file-header');
  const filePath = fileHeader?.querySelector('.file-info a')?.textContent.trim() || null;

  // Get permalink
  const timestampEl = commentElement.querySelector('.timestamp, relative-time');
  const parentLink = timestampEl?.closest('a');
  const permalink = parentLink?.href || window.location.href;

  const repository = getRepositoryFromUrl();

  return {
    author,
    content: truncatedContent,
    contextType: context.type,
    contextNumber: context.number,
    permalink,
    repository: repository ? repository.fullName : null,
    isReviewComment: true,
    hasSuggestion,
    filePath,
  };
}

/**
 * Gets notification metadata from a notification row element
 */
function getNotificationMetadata(notificationElement) {
  // Get title
  const titleEl = notificationElement.querySelector(SELECTORS.notificationTitle);
  const title = titleEl ? titleEl.textContent.trim() : 'Notification';

  // Get URL
  const linkEl = notificationElement.querySelector(SELECTORS.notificationLink);
  const url = linkEl?.href || window.location.href;

  // Get notification type/reason
  const reasonEl = notificationElement.querySelector(SELECTORS.notificationReason);
  const reason = reasonEl?.getAttribute('title') || reasonEl?.textContent.trim().toLowerCase().replace(/\s+/g, '_') || 'notification';

  // Get repository
  const repoEl = notificationElement.querySelector(SELECTORS.notificationRepo);
  const repository = repoEl ? repoEl.textContent.trim() : null;

  // Check if unread
  const isUnread = notificationElement.classList.contains('is-unread');

  // Extract PR/Issue number from URL
  const numberMatch = url.match(/\/(pull|issues)\/(\d+)/);
  const contextType = numberMatch ? (numberMatch[1] === 'pull' ? 'pr' : 'issue') : null;
  const contextNumber = numberMatch ? numberMatch[2] : null;

  return {
    title,
    url,
    reason,
    repository,
    isUnread,
    contextType,
    contextNumber,
  };
}

/**
 * Generates a smart task title based on PR state using shared templates
 */
function getSuggestedTitle(metadata, useSmartTitles) {
  const formatTitle = (templateKey) => {
    const template = TITLE_TEMPLATES[templateKey] || TITLE_TEMPLATES['github-pr'];
    const title = template
      .replace('{number}', metadata.prNumber || '')
      .replace('{title}', metadata.prTitle || '');
    return `[${title}](${metadata.prUrl})`;
  };

  if (!useSmartTitles) {
    return formatTitle('github-pr');
  }

  // Not own PR - always suggest review
  if (!metadata.isOwnPR) {
    return formatTitle('github-review');
  }

  // Own PR with failing checks
  if (metadata.checkStatus === 'failing') {
    return formatTitle('github-fix-pipeline');
  }

  // Own PR with changes requested
  if (metadata.reviewStatus === 'changes_requested') {
    return formatTitle('github-address-review');
  }

  // Own PR approved and ready to merge
  if (metadata.reviewStatus === 'approved') {
    return formatTitle('github-merge');
  }

  // Default format for own PR
  return formatTitle('github-pr');
}

/**
 * Generates smart title for a comment using shared templates
 */
function getCommentSuggestedTitle(metadata, useSmartTitles) {
  const formatTitle = (templateKey, overrides = {}) => {
    const template = TITLE_TEMPLATES[templateKey] || TITLE_TEMPLATES['github-comment'];
    const title = template
      .replace('{number}', metadata.contextNumber || '')
      .replace('{author}', metadata.author || '')
      .replace('{contextType}', metadata.contextType === 'pr' ? 'PR' : 'Issue')
      .replace('{title}', overrides.title || '');
    return `[${title}](${metadata.permalink})`;
  };

  if (!useSmartTitles) {
    return formatTitle('github-comment');
  }

  if (metadata.isReviewComment && metadata.hasSuggestion) {
    // Custom title for suggestions - not in templates
    return `[Apply suggestion on PR #${metadata.contextNumber}](${metadata.permalink})`;
  }

  if (metadata.isReviewComment) {
    // Custom title for review comments
    return `[Address review comment on PR #${metadata.contextNumber}](${metadata.permalink})`;
  }

  // Use template for reply
  return formatTitle(metadata.contextType === 'pr' ? 'github-reply' : 'github-comment');
}

/**
 * Generates smart title for a notification using shared templates
 * All titles start with action verbs
 */
function getNotificationSuggestedTitle(metadata, useSmartTitles) {
  const formatTitle = (templateKey) => {
    const template = TITLE_TEMPLATES[templateKey] || TITLE_TEMPLATES['github-notification'];
    const title = template
      .replace('{number}', metadata.contextNumber || '')
      .replace('{title}', metadata.title || '')
      .replace('{contextType}', metadata.contextType === 'pr' ? 'PR' : 'Issue');
    return `[${title}](${metadata.url})`;
  };

  if (!useSmartTitles) {
    return formatTitle('github-notification');
  }

  switch (metadata.reason) {
    case 'review_requested':
      return formatTitle('github-notification-review');
    case 'mention':
      return formatTitle('github-notification-mention');
    case 'assign':
      return formatTitle('github-notification-assign');
    case 'ci_activity':
      return formatTitle('github-notification-ci');
    case 'comment':
      // Custom - respond to comment
      return `[Respond to comment on #${metadata.contextNumber || ''}](${metadata.url})`;
    case 'state_change':
      // Custom - check state change
      return `[Check state change on #${metadata.contextNumber || ''}](${metadata.url})`;
    case 'author':
      // You're the author - check your PR
      return `[Check your PR #${metadata.contextNumber || ''}: ${metadata.title || ''}](${metadata.url})`;
    default:
      return formatTitle('github-notification');
  }
}

/*
    ***************
    Button Creation
    ***************
*/

let scheduleForToday = true;
let useSmartTitles = true;

/**
 * Handles click on Marvin button
 */
async function handleMarvinButtonClick(metadata) {
  if (!isExtensionContextValid()) {
    showSuccessMessage("reload");
    return;
  }

  let token;
  try {
    token = await getStoredToken();
  } catch (error) {
    if (error.message?.includes("Extension context invalidated")) {
      showSuccessMessage("reload");
      return;
    }
    throw error;
  }

  if (!token) {
    showSuccessMessage("noToken");
    return;
  }

  const data = {
    title: getSuggestedTitle(metadata, useSmartTitles),
    done: false,
  };

  // Build note with PR metadata
  let noteLines = [':::info'];
  if (metadata.repository) noteLines.push(`Repository: ${metadata.repository}`);
  if (metadata.author) noteLines.push(`Author: ${metadata.author}`);

  // Status line
  const statusParts = [];
  if (metadata.checkStatus) {
    const checkLabels = { passing: 'Checks passing', failing: 'Checks failing', pending: 'Checks pending' };
    statusParts.push(checkLabels[metadata.checkStatus]);
  }
  if (metadata.reviewStatus) {
    const reviewLabels = { approved: 'Approved', changes_requested: 'Changes requested', pending: 'Review pending' };
    statusParts.push(reviewLabels[metadata.reviewStatus]);
  }
  if (statusParts.length > 0) {
    noteLines.push(`Status: ${statusParts.join(' | ')}`);
  }

  if (metadata.description) {
    noteLines.push('');
    noteLines.push('Description:');
    noteLines.push(metadata.description);
  }

  noteLines.push('');
  noteLines.push(`[View on GitHub](${metadata.prUrl})`);

  data.note = noteLines.join('\n');

  if (scheduleForToday) {
    data.day = formatDate(new Date());
  }

  try {
    const result = await addTask(data);
    showSuccessMessage(result);
  } catch (error) {
    console.error('Failed to add task to Marvin:', error);
    if (error.message?.includes("Extension context invalidated")) {
      showSuccessMessage("reload");
    } else {
      showSuccessMessage('fail');
    }
  }
}

/**
 * Handles click on Marvin button for comments
 */
async function handleCommentMarvinButtonClick(metadata) {
  if (!isExtensionContextValid()) {
    showSuccessMessage("reload");
    return;
  }

  let token;
  try {
    token = await getStoredToken();
  } catch (error) {
    if (error.message?.includes("Extension context invalidated")) {
      showSuccessMessage("reload");
      return;
    }
    throw error;
  }

  if (!token) {
    showSuccessMessage("noToken");
    return;
  }

  const data = {
    title: getCommentSuggestedTitle(metadata, useSmartTitles),
    done: false,
  };

  // Build note
  let noteLines = [':::info'];
  if (metadata.repository) noteLines.push(`Repository: ${metadata.repository}`);
  noteLines.push(`Author: ${metadata.author}`);
  noteLines.push(`Type: ${metadata.isReviewComment ? 'Review Comment' : 'Comment'}`);
  if (metadata.filePath) noteLines.push(`File: ${metadata.filePath}`);
  if (metadata.hasSuggestion) noteLines.push('Contains code suggestion');
  noteLines.push('');
  noteLines.push('Comment:');
  noteLines.push(metadata.content);
  noteLines.push('');
  noteLines.push(`[View on GitHub](${metadata.permalink})`);

  data.note = noteLines.join('\n');

  if (scheduleForToday) {
    data.day = formatDate(new Date());
  }

  try {
    const result = await addTask(data);
    showSuccessMessage(result);
  } catch (error) {
    console.error('Failed to add task to Marvin:', error);
    if (error.message?.includes("Extension context invalidated")) {
      showSuccessMessage("reload");
    } else {
      showSuccessMessage('fail');
    }
  }
}

/**
 * Handles click on Marvin button for notifications
 */
async function handleNotificationMarvinButtonClick(metadata) {
  if (!isExtensionContextValid()) {
    showSuccessMessage("reload");
    return;
  }

  let token;
  try {
    token = await getStoredToken();
  } catch (error) {
    if (error.message?.includes("Extension context invalidated")) {
      showSuccessMessage("reload");
      return;
    }
    throw error;
  }

  if (!token) {
    showSuccessMessage("noToken");
    return;
  }

  const data = {
    title: getNotificationSuggestedTitle(metadata, useSmartTitles),
    done: false,
  };

  // Build note
  let noteLines = [':::info'];
  if (metadata.repository) noteLines.push(`Repository: ${metadata.repository}`);
  noteLines.push(`Type: ${metadata.reason.replace(/_/g, ' ')}`);
  noteLines.push(`Status: ${metadata.isUnread ? 'Unread' : 'Read'}`);
  noteLines.push('');
  noteLines.push(`[View on GitHub](${metadata.url})`);

  data.note = noteLines.join('\n');

  if (scheduleForToday) {
    data.day = formatDate(new Date());
  }

  try {
    const result = await addTask(data);
    showSuccessMessage(result);
  } catch (error) {
    console.error('Failed to add task to Marvin:', error);
    if (error.message?.includes("Extension context invalidated")) {
      showSuccessMessage("reload");
    } else {
      showSuccessMessage('fail');
    }
  }
}

/**
 * Creates a Marvin button for GitHub
 */
function createMarvinButton(metadata, style = 'header') {
  const button = document.createElement('button');
  button.classList.add('marvinButton');
  button.setAttribute('data-marvin-pr', metadata.prNumber);
  button.setAttribute('aria-label', 'Add to Marvin');
  button.setAttribute('type', 'button');

  // Build tooltip with check status
  let tooltip = 'Add to Marvin';
  if (metadata.checkStatus) {
    const statusText = { passing: 'Checks passing', failing: 'Checks failing', pending: 'Checks pending' };
    tooltip += ` (${statusText[metadata.checkStatus]})`;
  }
  button.setAttribute('title', tooltip);

  if (style === 'header') {
    // Style for PR detail view header - matches GitHub's button style
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 16px 16px;
      width: 32px;
      height: 32px;
      border: 1px solid var(--borderColor-default, rgba(31, 35, 40, 0.15));
      border-radius: 6px;
      cursor: pointer;
      margin-left: 8px;
      transition: background-color 0.2s;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      background-color: var(--bgColor-default, #ffffff);
    `;
    button.onmouseenter = () => {
      button.style.backgroundColor = 'var(--bgColor-muted, #f6f8fa)';
    };
    button.onmouseleave = () => {
      button.style.backgroundColor = 'var(--bgColor-default, #ffffff)';
    };
  } else if (style === 'list') {
    // Style for PR list rows - smaller, inline button
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 14px 14px;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s, background-color 0.2s;
      flex-shrink: 0;
      margin-left: 8px;
    `;
    button.onmouseenter = () => {
      button.style.opacity = '1';
      button.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
    };
    button.onmouseleave = () => {
      button.style.opacity = '0.6';
      button.style.backgroundColor = 'transparent';
    };
  }

  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleMarvinButtonClick(metadata);
  };

  return button;
}

/*
    ***************
    Button Injection
    ***************
*/

/**
 * Checks if Marvin button already exists
 */
function marvinButtonExists(container, prNumber) {
  return container.querySelector(`.marvinButton[data-marvin-pr="${prNumber}"]`) !== null;
}

/**
 * Adds Marvin button to PR detail view
 */
function addButtonToPRDetailView() {
  const metadata = getPRMetadataFromDetailView();
  if (!metadata) return false;

  // Don't add if already exists
  if (marvinButtonExists(document.body, metadata.prNumber)) return true;

  const button = createMarvinButton(metadata, 'header');

  // Primary: Add to header actions area
  const headerActions = document.querySelector(SELECTORS.prHeader);
  if (headerActions) {
    headerActions.appendChild(button);
    return true;
  }

  // Fallback: Add near PR title/number
  const prMeta = document.querySelector(SELECTORS.prHeaderMeta);
  if (prMeta) {
    const wrapper = document.createElement('span');
    wrapper.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px;';
    wrapper.appendChild(button);
    prMeta.appendChild(wrapper);
    return true;
  }

  return false;
}

/**
 * Adds Marvin buttons to PR list rows
 */
function addButtonsToPRList() {
  const rows = document.querySelectorAll(SELECTORS.prListRow);

  if (!rows || rows.length === 0) return false;

  let addedAny = false;

  rows.forEach(row => {
    const metadata = getPRMetadataFromListRow(row);
    if (!metadata) return;

    if (marvinButtonExists(row, metadata.prNumber)) return;

    const button = createMarvinButton(metadata, 'list');

    // Find the title element and add button after it
    const titleElement = row.querySelector(SELECTORS.prListTitle);
    if (titleElement && titleElement.parentElement) {
      titleElement.parentElement.style.display = 'inline-flex';
      titleElement.parentElement.style.alignItems = 'center';
      titleElement.after(button);
      addedAny = true;
      return;
    }

    // Fallback: append to row
    row.appendChild(button);
    addedAny = true;
  });

  return addedAny;
}

/**
 * Adds Marvin button to timeline comments
 */
function addButtonsToTimelineComments() {
  const comments = document.querySelectorAll(SELECTORS.timelineComment);

  if (!comments || comments.length === 0) return false;

  let addedAny = false;

  comments.forEach(comment => {
    // Skip if button already exists
    if (comment.querySelector('.marvinButton')) return;

    const metadata = getCommentMetadata(comment);
    if (!metadata || !metadata.content) return;

    const actionsArea = comment.querySelector(SELECTORS.timelineCommentActions);
    if (!actionsArea) return;

    const button = document.createElement('button');
    button.classList.add('marvinButton');
    button.setAttribute('aria-label', 'Add to Marvin');
    button.setAttribute('title', 'Add to Marvin');
    button.setAttribute('type', 'button');

    // Apply comment style
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 14px 14px;
      width: 26px;
      height: 26px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin-left: 4px;
      transition: background-color 0.2s;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    `;
    button.onmouseenter = () => {
      button.style.backgroundColor = 'var(--bgColor-muted, #f6f8fa)';
    };
    button.onmouseleave = () => {
      button.style.backgroundColor = 'transparent';
    };

    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleCommentMarvinButtonClick(metadata);
    };

    // Insert before the overflow menu (details element)
    const overflowMenu = actionsArea.querySelector('details');
    if (overflowMenu) {
      overflowMenu.before(button);
    } else {
      actionsArea.appendChild(button);
    }

    addedAny = true;
  });

  return addedAny;
}

/**
 * Adds Marvin button to review comments (inline diff comments)
 */
function addButtonsToReviewComments() {
  const reviewComments = document.querySelectorAll(SELECTORS.reviewComment);

  if (!reviewComments || reviewComments.length === 0) return false;

  let addedAny = false;

  reviewComments.forEach(comment => {
    // Skip if button already exists
    if (comment.querySelector('.marvinButton')) return;

    const metadata = getReviewCommentMetadata(comment);
    if (!metadata || !metadata.content) return;

    const header = comment.querySelector('.timeline-comment-header');
    if (!header) return;

    const button = document.createElement('button');
    button.classList.add('marvinButton');
    button.setAttribute('aria-label', 'Add to Marvin');
    button.setAttribute('title', metadata.hasSuggestion ? 'Add suggestion to Marvin' : 'Add to Marvin');
    button.setAttribute('type', 'button');

    // Apply review comment style - smaller
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 12px 12px;
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 4px;
      opacity: 0.7;
      transition: opacity 0.2s, background-color 0.2s;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    `;
    button.onmouseenter = () => {
      button.style.opacity = '1';
      button.style.backgroundColor = 'var(--bgColor-muted, #f6f8fa)';
    };
    button.onmouseleave = () => {
      button.style.opacity = '0.7';
      button.style.backgroundColor = 'transparent';
    };

    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleCommentMarvinButtonClick(metadata);
    };

    // Append to header
    header.appendChild(button);
    addedAny = true;
  });

  return addedAny;
}

/**
 * Adds Marvin button to notification rows
 */
function addButtonsToNotifications() {
  const notifications = document.querySelectorAll(SELECTORS.notificationItem);

  if (!notifications || notifications.length === 0) return false;

  let addedAny = false;

  notifications.forEach(notification => {
    // Skip if button already exists
    if (notification.querySelector('.marvinButton')) return;

    const metadata = getNotificationMetadata(notification);
    if (!metadata) return;

    const button = document.createElement('button');
    button.classList.add('marvinButton');
    button.setAttribute('aria-label', 'Add to Marvin');
    button.setAttribute('title', 'Add to Marvin');
    button.setAttribute('type', 'button');

    // Apply notification style - smaller inline button
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 14px 14px;
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 6px;
      opacity: 0.6;
      transition: opacity 0.2s, background-color 0.2s;
      flex-shrink: 0;
      display: inline-block;
      vertical-align: middle;
      position: relative;
      top: 7px;
    `;
    button.onmouseenter = () => {
      button.style.opacity = '1';
      button.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
    };
    button.onmouseleave = () => {
      button.style.opacity = '0.6';
      button.style.backgroundColor = 'transparent';
    };

    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleNotificationMarvinButtonClick(metadata);
    };

    // Insert before the title link to keep it inline
    const titleLink = notification.querySelector(SELECTORS.notificationLink);
    if (titleLink) {
      titleLink.parentElement.insertBefore(button, titleLink);
      addedAny = true;
    } else {
      // Fallback: try to find the title element
      const title = notification.querySelector(SELECTORS.notificationTitle);
      if (title && title.parentElement) {
        title.parentElement.insertBefore(button, title);
        addedAny = true;
      }
    }
  });

  return addedAny;
}

/*
    ***************
    Main Logic
    ***************
*/

let enabled = true;
let displayInPRView = true;
let displayInPRList = true;
let displayInComments = true;
let displayInReviewComments = true;
let displayInNotifications = true;
let isInitialized = false;
let observer = null;

/**
 * Determines current view type and adds appropriate buttons
 */
function addButtonsToCurrentView() {
  const url = window.location.href;
  let added = false;

  // PR detail view (github.com/owner/repo/pull/123)
  if (url.match(/\/pull\/\d+/) && displayInPRView) {
    added = addButtonToPRDetailView() || added;
  }

  // PR list view (github.com/pulls or github.com/owner/repo/pulls)
  if ((url.includes('/pulls') || url.endsWith('/pulls')) && displayInPRList) {
    added = addButtonsToPRList() || added;
  }

  // Timeline comments in PR/Issue views
  if ((url.match(/\/pull\/\d+/) || url.match(/\/issues\/\d+/)) && displayInComments) {
    added = addButtonsToTimelineComments() || added;
  }

  // Review comments in PR views (inline diff comments)
  if (url.match(/\/pull\/\d+/) && displayInReviewComments) {
    added = addButtonsToReviewComments() || added;
  }

  // Notifications page
  if (url.includes('/notifications') && displayInNotifications) {
    added = addButtonsToNotifications() || added;
  }

  return added;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const debouncedAddButtons = debounce(addButtonsToCurrentView, 250);

/**
 * Handles DOM mutations - watches for new PR, comment, and notification elements
 */
function handleMutation(mutationsList) {
  for (const mutation of mutationsList) {
    if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) continue;

    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      // Check if this is or contains PR-related elements
      if (node.matches?.(SELECTORS.prHeader) ||
          node.matches?.(SELECTORS.prListRow) ||
          node.querySelector?.(SELECTORS.prHeader) ||
          node.querySelector?.(SELECTORS.prListRow) ||
          node.querySelector?.(SELECTORS.prTitle)) {
        debouncedAddButtons();
        return;
      }

      // Check for comment elements
      if (node.matches?.(SELECTORS.timelineComment) ||
          node.matches?.(SELECTORS.reviewComment) ||
          node.querySelector?.(SELECTORS.timelineComment) ||
          node.querySelector?.(SELECTORS.reviewComment) ||
          node.querySelector?.(SELECTORS.timelineCommentActions)) {
        debouncedAddButtons();
        return;
      }

      // Check for notification elements
      if (node.matches?.(SELECTORS.notificationItem) ||
          node.querySelector?.(SELECTORS.notificationItem) ||
          node.querySelector?.(SELECTORS.notificationsList)) {
        debouncedAddButtons();
        return;
      }
    }
  }
}

/**
 * Checks if GitHub page has loaded
 */
function isGitHubLoaded() {
  return document.querySelector(SELECTORS.prTitle) ||
         document.querySelector(SELECTORS.prListRow) ||
         document.querySelector(SELECTORS.timelineComment) ||
         document.querySelector(SELECTORS.notificationsList) ||
         document.querySelector('.repository-content') ||
         document.querySelector('[data-turbo-body]');
}

/**
 * Initializes the content script
 */
async function init() {
  // Load settings
  const settings = await getStoredGitHubSettings();
  enabled = settings.enabled ?? true;
  scheduleForToday = settings.scheduleForToday ?? true;
  displayInPRView = settings.displayInPRView ?? true;
  displayInPRList = settings.displayInPRList ?? true;
  useSmartTitles = settings.useSmartTitles ?? true;
  displayInComments = settings.displayInComments ?? true;
  displayInReviewComments = settings.displayInReviewComments ?? true;
  displayInNotifications = settings.displayInNotifications ?? true;

  // If disabled, don't proceed
  if (!enabled) {
    clearInterval(loopInterval);
    return;
  }

  // If all display options are disabled, don't proceed
  if (!displayInPRView && !displayInPRList && !displayInComments && !displayInReviewComments && !displayInNotifications) {
    clearInterval(loopInterval);
    return;
  }

  // Wait for GitHub to load
  if (!isGitHubLoaded() && !isInitialized) {
    return;
  }

  // Add buttons to current view
  addButtonsToCurrentView();

  if (!isInitialized) {
    isInitialized = true;

    // Set up MutationObserver for dynamic content
    observer = new MutationObserver(handleMutation);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Handle Turbo navigation (GitHub's SPA-like navigation)
    document.addEventListener('turbo:load', () => {
      debouncedAddButtons();
    });

    document.addEventListener('turbo:render', () => {
      debouncedAddButtons();
    });

    // Also listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      debouncedAddButtons();
    });

    // Stop the initial interval
    clearInterval(loopInterval);

    console.log('Marvin GitHub PR integration initialized');
  }
}

// Start initialization loop
const loopInterval = setInterval(init, 1000);

// Also try to initialize immediately if DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
}

/**
 * Message listener for popup context requests
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getPageContext') {
    // Gather context from the current page for smart autocomplete
    const url = window.location.href;
    let context = null;

    // Check for PR detail view
    if (url.match(/\/pull\/\d+/)) {
      const metadata = getPRMetadataFromDetailView();
      if (metadata) {
        context = {
          type: 'pr',
          platform: 'github',
          ...metadata,
          url: metadata.prUrl,
          title: metadata.prTitle,
          needsReview: !metadata.isOwnPR && metadata.reviewStatus !== 'approved',
        };
      }
    }

    // Check for issue view
    else if (url.match(/\/issues\/\d+/)) {
      const ctx = getContextFromUrl();
      const repository = getRepositoryFromUrl();
      const titleElement = document.querySelector('.js-issue-title');
      context = {
        type: 'issue',
        platform: 'github',
        issueNumber: ctx?.number,
        title: titleElement?.textContent?.trim() || 'Issue',
        url: url,
        repository: repository?.fullName,
      };
    }

    // Check for notifications page - don't auto-fill context
    // since we don't know which notification user wants and
    // notifications lack full PR metadata (isOwnPR, reviewStatus, etc.)
    // User should click the Marvin button on specific notification instead
    else if (url.includes('/notifications')) {
      context = null;
    }

    sendResponse({ context });
    return true;
  }
});
