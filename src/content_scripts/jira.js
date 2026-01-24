import { getStoredJiraSettings, getStoredToken } from "../utils/storage";
import { addTask } from "../utils/api";
import { formatDate } from "../utils/dates";
import { TITLE_TEMPLATES } from "../utils/taskContext";

const logo = chrome.runtime.getURL("static/logo.png");

// Jira-specific selectors (using data-testid for stability where possible)
const SELECTORS = {
  // Issue detail view (full /browse/ page)
  issueView: '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
  issueKey: '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
  issueTitle: '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
  issueDescription: '[data-testid="issue.views.field.rich-text.description"]',
  // Action items area (top right - watch, share, menu buttons)
  actionItems: '[role="group"][aria-label="Action items"]',
  shareButton: '[data-testid="share-dialog.ui.share-button"]',
  meatballMenu: '[data-testid="issue-meatball-menu.ui.dropdown-trigger.button"]',

  // Board view cards
  boardCard: '[data-testid="platform-board-kit.ui.card.card"]',
  cardKey: '[data-testid="platform-card.common.ui.key.key"]',
  cardSummary: '[data-testid="platform-card.common.ui.summary.summary"]',
  cardFooter: '[data-testid="platform-card.ui.card.card-footer"]',
  cardPriority: '[data-testid*="priority"]',

  // Backlog/list view
  backlogRow: '[data-testid="software-backlog.card-list.card"]',
  listIssueKey: '[data-testid="software-backlog.card-list.card.key"]',

  // Alternative selectors for different Jira versions
  issueKeyAlt: '[data-testid*="issue-key"], [data-testid*="breadcrumbs"] a',
  issueTitleAlt: 'h1[data-testid*="summary"], [data-testid*="summary"] h1',
  boardCardAlt: '[data-rbd-draggable-id], .ghx-issue',
  cardSummaryAlt: '[data-testid*="card-summary"], [data-testid*="summary"]',
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
 * Extracts issue key from URL (/browse/PROJ-123)
 */
function getIssueKeyFromUrl() {
  const browseMatch = window.location.href.match(/\/browse\/([A-Z][A-Z0-9]*-\d+)/i);
  return browseMatch ? browseMatch[1].toUpperCase() : null;
}

/**
 * Extracts issue key from a DOM element
 */
function getIssueKeyFromElement(element) {
  // Try data-testid selectors first
  const keyElement = element.querySelector(SELECTORS.cardKey) ||
                     element.querySelector(SELECTORS.issueKey) ||
                     element.querySelector(SELECTORS.listIssueKey) ||
                     element.querySelector(SELECTORS.issueKeyAlt);

  if (keyElement) {
    const text = keyElement.textContent.trim();
    const match = text.match(/[A-Z][A-Z0-9]*-\d+/i);
    if (match) return match[0].toUpperCase();
  }

  // Try to find any element with issue key pattern in links
  const links = element.querySelectorAll('a[href*="/browse/"]');
  for (const link of links) {
    const hrefMatch = link.href.match(/\/browse\/([A-Z][A-Z0-9]*-\d+)/i);
    if (hrefMatch) return hrefMatch[1].toUpperCase();
  }

  // Last resort: search text content
  const allText = element.textContent;
  const match = allText.match(/\b([A-Z][A-Z0-9]*-\d+)\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Gets issue summary/title from DOM
 */
function getIssueSummary(element) {
  // For card/list elements - check this first when element is provided
  if (element) {
    // Try primary selector
    let cardSummary = element.querySelector(SELECTORS.cardSummary);
    if (cardSummary) return cardSummary.textContent.trim();

    // Try alternative selectors
    cardSummary = element.querySelector(SELECTORS.cardSummaryAlt);
    if (cardSummary) return cardSummary.textContent.trim();

    // Try common patterns
    cardSummary = element.querySelector('[data-testid*="summary"]') ||
                  element.querySelector('.ghx-summary') ||
                  element.querySelector('span[class*="summary"]') ||
                  element.querySelector('[class*="title"]');

    if (cardSummary) return cardSummary.textContent.trim();

    // Last resort: look for any text that's not the issue key
    const issueKey = getIssueKeyFromElement(element);
    const allText = element.textContent.trim();
    if (issueKey && allText.includes(issueKey)) {
      // Try to extract text after the issue key
      const parts = allText.split(issueKey);
      if (parts[1]) {
        const summary = parts[1].trim().split('\n')[0].trim();
        if (summary && summary.length > 3) return summary;
      }
    }
  }

  // For issue detail view (/browse/ page)
  const titleElement = document.querySelector(SELECTORS.issueTitle) ||
                       document.querySelector(SELECTORS.issueTitleAlt) ||
                       document.querySelector('h1');

  if (titleElement) {
    return titleElement.textContent.trim();
  }

  return 'Jira Issue';
}

/**
 * Gets issue description (truncated to 500 chars)
 */
function getIssueDescription() {
  const descElement = document.querySelector(SELECTORS.issueDescription) ||
                      document.querySelector('[data-testid*="description"]');

  if (!descElement) return '';

  const text = descElement.textContent.trim();
  return text.length > 500 ? text.substring(0, 497) + '...' : text;
}

/**
 * Gets issue type from the page
 */
function getIssueType() {
  const typeElement = document.querySelector('[data-testid*="issue-type-icon"]') ||
                      document.querySelector('[data-testid*="issue-type"]') ||
                      document.querySelector('[aria-label*="Type:"]') ||
                      document.querySelector('[data-testid*="type"]');

  if (typeElement) {
    // Try aria-label first as it often has the type name
    const ariaLabel = typeElement.getAttribute('aria-label');
    if (ariaLabel) {
      const match = ariaLabel.match(/(?:Type:|Issue Type:)?\s*(.+)/i);
      if (match) return match[1].trim();
    }
    return typeElement.textContent.trim() || 'Task';
  }

  return 'Task';
}

/**
 * Gets issue priority from the page
 */
function getIssuePriority() {
  const priorityElement = document.querySelector('[data-testid*="priority"]') ||
                          document.querySelector('[aria-label*="Priority:"]');

  if (priorityElement) {
    const ariaLabel = priorityElement.getAttribute('aria-label');
    if (ariaLabel) {
      const match = ariaLabel.match(/Priority:\s*(.+)/i);
      if (match) return match[1].trim();
    }
    return priorityElement.textContent.trim();
  }

  return '';
}

/**
 * Extracts acceptance criteria from the issue description
 * Looks for common patterns like "Acceptance Criteria:", "AC:", checkbox lists
 * @returns {string} Acceptance criteria text or empty string
 */
function getAcceptanceCriteria() {
  const descElement = document.querySelector(SELECTORS.issueDescription) ||
                      document.querySelector('[data-testid*="description"]');

  if (!descElement) return '';

  const descText = descElement.textContent;

  // Look for acceptance criteria sections
  const acPatterns = [
    /acceptance\s*criteria[:\s]*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i,
    /\bac[:\s]*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i,
    /\bgiven[:\s]*([\s\S]*?)(?=\n\n|$)/i,
  ];

  for (const pattern of acPatterns) {
    const match = descText.match(pattern);
    if (match && match[1]) {
      const ac = match[1].trim();
      return ac.length > 500 ? ac.substring(0, 497) + '...' : ac;
    }
  }

  // Check for checkbox-style items (often used for AC)
  const checkboxItems = descElement.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
  if (checkboxItems.length > 0) {
    const items = Array.from(checkboxItems).map(cb => {
      const label = cb.closest('li, label, div')?.textContent.trim() || '';
      const checked = cb.checked ? '[x]' : '[ ]';
      return `${checked} ${label}`;
    }).join('\n');
    return items.substring(0, 500);
  }

  return '';
}

/**
 * Gets a summary of comments on the issue
 * @returns {Object} Comment summary
 */
function getCommentsSummary() {
  // Look for comment containers
  const commentContainers = document.querySelectorAll(
    '[data-testid*="comment"], .issue-comment, [id*="comment"]'
  );

  const summary = {
    count: commentContainers.length,
    hasComments: commentContainers.length > 0,
    latestCommentPreview: '',
  };

  if (commentContainers.length > 0) {
    // Get the last comment preview
    const lastComment = commentContainers[commentContainers.length - 1];
    const commentBody = lastComment.querySelector('[data-testid*="body"], .comment-body, p');
    if (commentBody) {
      const text = commentBody.textContent.trim();
      summary.latestCommentPreview = text.length > 150 ? text.substring(0, 147) + '...' : text;
    }
  }

  return summary;
}

/**
 * Gets linked issues from the issue sidebar
 * @returns {Array} Array of linked issue keys
 */
function getLinkedIssues() {
  const linkedIssues = [];

  // Look for linked issues section
  const linksSection = document.querySelector(
    '[data-testid*="links"], [data-testid*="linked-issues"], .links-section'
  );

  if (linksSection) {
    const issueLinks = linksSection.querySelectorAll('a[href*="/browse/"]');
    issueLinks.forEach(link => {
      const match = link.href.match(/\/browse\/([A-Z][A-Z0-9]*-\d+)/i);
      if (match) {
        linkedIssues.push({
          key: match[1].toUpperCase(),
          title: link.textContent.trim(),
        });
      }
    });
  }

  return linkedIssues.slice(0, 5); // Limit to 5
}

/**
 * Builds complete Jira issue metadata
 */
function getJiraMetadata(element = null) {
  const issueKey = element ? getIssueKeyFromElement(element) : getIssueKeyFromUrl();

  if (!issueKey) return null;

  const baseUrl = window.location.origin;
  const issueUrl = `${baseUrl}/browse/${issueKey}`;

  return {
    issueKey,
    summary: getIssueSummary(element),
    description: getIssueDescription(),
    issueUrl,
    issueType: getIssueType(),
    priority: getIssuePriority(),
    acceptanceCriteria: element ? '' : getAcceptanceCriteria(),
    commentsSummary: element ? null : getCommentsSummary(),
    linkedIssues: element ? [] : getLinkedIssues(),
  };
}

/*
    ***************
    Button Creation
    ***************
*/

let scheduleForToday = true;

/**
 * Generates smart title based on issue type
 */
function generateSmartTitle(metadata) {
  const issueType = (metadata.issueType || '').toLowerCase();
  let templateKey = 'jira-task';

  if (issueType.includes('bug')) {
    templateKey = 'jira-bug';
  } else if (issueType.includes('story')) {
    templateKey = 'jira-story';
  } else if (issueType.includes('epic')) {
    templateKey = 'jira-epic';
  }

  const template = TITLE_TEMPLATES[templateKey] || TITLE_TEMPLATES['jira-task'];
  const title = template
    .replace('{key}', metadata.issueKey || '')
    .replace('{summary}', metadata.summary || '');

  return `[${title}](${metadata.issueUrl})`;
}

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
    title: generateSmartTitle(metadata),
    done: false,
  };

  // Build note with issue metadata
  let noteLines = [':::info'];
  if (metadata.issueType) noteLines.push(`Issue Type: ${metadata.issueType}`);
  if (metadata.priority) noteLines.push(`Priority: ${metadata.priority}`);
  if (metadata.description) {
    noteLines.push('');
    noteLines.push('Description:');
    noteLines.push(metadata.description);
  }
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
 * Creates a Marvin button for Jira
 */
function createMarvinButton(metadata, style = 'toolbar') {
  const button = document.createElement('button');
  button.classList.add('marvinButton');
  button.setAttribute('data-marvin-issue', metadata.issueKey);
  button.setAttribute('aria-label', 'Add to Marvin');
  button.setAttribute('title', 'Add to Marvin');
  button.setAttribute('type', 'button');

  if (style === 'toolbar') {
    // Style for issue detail view toolbar - matches Jira's icon button style
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 20px 20px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      margin-left: 4px;
      transition: background-color 0.2s;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    `;
    button.onmouseenter = () => { button.style.backgroundColor = 'rgba(9, 30, 66, 0.08)'; };
    button.onmouseleave = () => { button.style.backgroundColor = 'transparent'; };
  } else if (style === 'card') {
    // Style for board cards - small inline button
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 14px 14px;
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s, background-color 0.2s;
      flex-shrink: 0;
      margin-left: 4px;
    `;
    button.onmouseenter = () => {
      button.style.opacity = '1';
      button.style.backgroundColor = 'rgba(9, 30, 66, 0.08)';
    };
    button.onmouseleave = () => {
      button.style.opacity = '0.7';
      button.style.backgroundColor = 'transparent';
    };
  } else if (style === 'list') {
    // Style for list/backlog rows
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 16px 16px;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      margin-left: 4px;
      opacity: 0.7;
      transition: opacity 0.2s;
    `;
    button.onmouseenter = () => { button.style.opacity = '1'; };
    button.onmouseleave = () => { button.style.opacity = '0.7'; };
  } else if (style === 'breadcrumb') {
    // Style for breadcrumb navigation - matches Jira's breadcrumb icons
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 16px 16px;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s, background-color 0.2s;
      flex-shrink: 0;
    `;
    button.onmouseenter = () => {
      button.style.opacity = '1';
      button.style.backgroundColor = 'rgba(9, 30, 66, 0.08)';
    };
    button.onmouseleave = () => {
      button.style.opacity = '0.7';
      button.style.backgroundColor = 'transparent';
    };
  } else if (style === 'action') {
    // Style for action items area - matches Jira's action buttons (watch, share, etc.)
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 16px 16px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      transition: background-color 0.2s;
      flex-shrink: 0;
    `;
    button.onmouseenter = () => {
      button.style.backgroundColor = 'rgba(9, 30, 66, 0.08)';
    };
    button.onmouseleave = () => {
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
 * Checks if Marvin button already exists for an issue
 */
function marvinButtonExists(container, issueKey) {
  return container.querySelector(`.marvinButton[data-marvin-issue="${issueKey}"]`) !== null;
}

/**
 * Adds Marvin button to issue detail view (/browse/ page)
 */
function addButtonToIssueView() {
  const metadata = getJiraMetadata();
  if (!metadata) return false;

  // Don't add if already exists
  if (marvinButtonExists(document.body, metadata.issueKey)) return true;

  const button = createMarvinButton(metadata, 'action');

  // Primary: Add to action items area (top right, before share button)
  const actionItems = document.querySelector(SELECTORS.actionItems);
  if (actionItems) {
    // Find the share button to insert before it
    const shareButton = actionItems.querySelector(SELECTORS.shareButton);
    if (shareButton) {
      const shareContainer = shareButton.closest('div[class]');
      if (shareContainer) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: inline-flex; align-items: center;';
        wrapper.appendChild(button);
        shareContainer.before(wrapper);
        return true;
      }
    }

    // Fallback: just append to action items
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: inline-flex; align-items: center;';
    wrapper.appendChild(button);
    actionItems.appendChild(wrapper);
    return true;
  }

  return false;
}

/**
 * Adds Marvin buttons to board cards
 */
function addButtonsToBoardCards() {
  const cards = document.querySelectorAll(SELECTORS.boardCard);
  const altCards = document.querySelectorAll(SELECTORS.boardCardAlt);
  const allCards = cards.length > 0 ? cards : altCards;

  if (!allCards || allCards.length === 0) return false;

  let addedAny = false;

  allCards.forEach(card => {
    const metadata = getJiraMetadata(card);
    if (!metadata) return;

    if (marvinButtonExists(card, metadata.issueKey)) return;

    const button = createMarvinButton(metadata, 'card');

    // Strategy 1: Find priority indicator and add button next to it
    const priorityEl = card.querySelector(SELECTORS.cardPriority) ||
                       card.querySelector('[aria-label*="Priority"]') ||
                       card.querySelector('[data-testid*="priority"]');

    if (priorityEl) {
      // Insert after priority element
      const parent = priorityEl.parentElement;
      if (parent) {
        // Ensure parent is flex for inline placement
        const parentStyle = getComputedStyle(parent);
        if (!parentStyle.display.includes('flex')) {
          parent.style.display = 'inline-flex';
          parent.style.alignItems = 'center';
        }
        priorityEl.after(button);
        addedAny = true;
        return;
      }
    }

    // Strategy 2: Find the footer area with issue key and place it there
    const footer = card.querySelector(SELECTORS.cardFooter);
    if (footer) {
      const issueKeyEl = footer.querySelector(SELECTORS.cardKey) ||
                         footer.querySelector('[data-testid*="key"]');
      if (issueKeyEl && issueKeyEl.parentElement) {
        // Add to the same row as the issue key
        issueKeyEl.parentElement.style.display = 'inline-flex';
        issueKeyEl.parentElement.style.alignItems = 'center';
        issueKeyEl.after(button);
        addedAny = true;
        return;
      }
      footer.appendChild(button);
      addedAny = true;
      return;
    }

    // Strategy 3: Find the issue key element and add next to it
    const keyElement = card.querySelector(SELECTORS.cardKey) ||
                       card.querySelector('[data-testid*="key"]');
    if (keyElement) {
      const parent = keyElement.parentElement;
      if (parent) {
        parent.style.display = 'inline-flex';
        parent.style.alignItems = 'center';
        keyElement.after(button);
        addedAny = true;
        return;
      }
    }

    // Fallback: append to card
    card.appendChild(button);
    addedAny = true;
  });

  return addedAny;
}

/**
 * Adds Marvin buttons to backlog/list rows
 */
function addButtonsToListView() {
  const rows = document.querySelectorAll(SELECTORS.backlogRow);

  if (!rows || rows.length === 0) return false;

  let addedAny = false;

  rows.forEach(row => {
    const metadata = getJiraMetadata(row);
    if (!metadata) return;

    if (marvinButtonExists(row, metadata.issueKey)) return;

    // Find or create row actions area
    let actionsArea = row.querySelector('.marvin-list-actions');

    if (!actionsArea) {
      actionsArea = document.createElement('div');
      actionsArea.classList.add('marvin-list-actions');
      actionsArea.style.cssText = `
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
      `;
      row.appendChild(actionsArea);
    }

    const button = createMarvinButton(metadata, 'list');
    actionsArea.appendChild(button);
    addedAny = true;
  });

  return addedAny;
}

/*
    ***************
    Main Logic
    ***************
*/

let displayInIssueView = true;
let displayInBoardView = true;
let displayInListView = true;
let isInitialized = false;
let observer = null;

/**
 * Determines current view type and adds appropriate buttons
 */
function addButtonsToCurrentView() {
  const url = window.location.href;
  let added = false;

  // Issue detail view (direct /browse/ page only)
  if (url.includes('/browse/') && displayInIssueView) {
    added = addButtonToIssueView() || added;
  }

  // Board view - cards only
  if ((url.includes('/board') || url.includes('/boards/')) && displayInBoardView) {
    added = addButtonsToBoardCards() || added;
  }

  // Backlog/list view
  if (url.includes('/backlog') && displayInListView) {
    added = addButtonsToListView() || added;
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
 * Handles DOM mutations - watches for new board cards
 */
function handleMutation(mutationsList) {
  for (const mutation of mutationsList) {
    if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) continue;

    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      // Check if this is or contains a board card
      if (node.matches?.(SELECTORS.boardCard) ||
          node.querySelector?.(SELECTORS.boardCard)) {
        debouncedAddButtons();
        return;
      }

      // Check if this is or contains action items (for /browse/ pages)
      if (node.matches?.(SELECTORS.actionItems) ||
          node.querySelector?.(SELECTORS.actionItems)) {
        debouncedAddButtons();
        return;
      }
    }
  }
}

/**
 * Checks if Jira has loaded
 */
function isJiraLoaded() {
  return document.querySelector('[data-testid*="navigation"]') ||
         document.querySelector('#jira-frontend') ||
         document.querySelector('[id*="jira"]') ||
         document.querySelector('[data-testid*="software"]');
}

/**
 * Initializes the content script
 */
async function init() {
  // Load settings
  const settings = await getStoredJiraSettings();
  displayInIssueView = settings.displayInIssueView ?? true;
  displayInBoardView = settings.displayInBoardView ?? true;
  displayInListView = settings.displayInListView ?? true;
  scheduleForToday = settings.scheduleForToday ?? true;

  // If all display options are disabled, don't proceed
  if (!displayInIssueView && !displayInBoardView && !displayInListView) {
    clearInterval(loopInterval);
    return;
  }

  // Wait for Jira to load
  if (!isJiraLoaded() && !isInitialized) {
    return;
  }

  // Add buttons to current view
  addButtonsToCurrentView();

  if (!isInitialized) {
    isInitialized = true;

    // Set up MutationObserver for dynamic content (new cards, page changes)
    observer = new MutationObserver(handleMutation);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Stop the initial interval
    clearInterval(loopInterval);

    console.log('Marvin Jira integration initialized');
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
    const metadata = getJiraMetadata();

    if (metadata) {
      sendResponse({
        context: {
          type: 'jira-issue',
          platform: 'jira',
          issueKey: metadata.issueKey,
          summary: metadata.summary,
          title: metadata.summary,
          description: metadata.description,
          issueType: metadata.issueType,
          priority: metadata.priority,
          url: metadata.issueUrl,
          // Enhanced context fields
          acceptanceCriteria: metadata.acceptanceCriteria,
          commentsSummary: metadata.commentsSummary,
          linkedIssues: metadata.linkedIssues,
        },
      });
    } else {
      sendResponse({ context: null });
    }
    return true;
  }
});
