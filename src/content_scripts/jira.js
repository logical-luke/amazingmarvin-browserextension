import { getStoredJiraSettings, getStoredToken } from "../utils/storage";
import { addTask } from "../utils/api";
import { formatDate } from "../utils/dates";

const logo = chrome.runtime.getURL("static/logo.png");

// Jira-specific selectors (using data-testid for stability where possible)
const SELECTORS = {
  // Issue detail view
  issueView: '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
  issueKey: '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
  issueTitle: '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
  issueDescription: '[data-testid="issue.views.field.rich-text.description"]',
  issueToolbar: '[data-testid="issue.views.issue-base.foundation.quick-add.button"]',

  // Board view cards
  boardCard: '[data-testid="platform-board-kit.ui.card.card"]',
  cardKey: '[data-testid="platform-card.common.ui.key.key"]',
  cardSummary: '[data-testid="platform-card.common.ui.summary.card-summary"]',

  // Backlog/list view
  backlogRow: '[data-testid="software-backlog.card-list.card"]',
  listIssueKey: '[data-testid="software-backlog.card-list.card.key"]',

  // Alternative selectors for different Jira versions
  issueKeyAlt: '[data-testid*="issue-key"], [data-testid*="breadcrumbs"] a',
  issueTitleAlt: 'h1[data-testid*="summary"], [data-testid*="summary"] h1',
  boardCardAlt: '[data-rbd-draggable-id], .ghx-issue',
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
  marvinSuccessMessage.textContent =
    status === "success"
      ? "Task successfully added to Marvin!"
      : "Failed to add Task to Marvin!";

  if (status === "noToken") {
    marvinSuccessMessage.textContent +=
      " Please add your Marvin API token in the extension settings.";
  }

  marvinSuccessMessage.classList.remove("marvinSuccessMessageHidden");
  marvinSuccessMessage.classList.add("marvinSuccessMessageVisible");
  setTimeout(
    () => {
      marvinSuccessMessage.classList.remove("marvinSuccessMessageVisible");
      marvinSuccessMessage.classList.add("marvinSuccessMessageHidden");
    },
    status === "noToken" ? 6000 : 2000
  );
}

/*
    ***************
    Metadata Extraction
    ***************
*/

/**
 * Extracts issue key from URL
 */
function getIssueKeyFromUrl() {
  // Check for /browse/PROJ-123 pattern
  const browseMatch = window.location.href.match(/\/browse\/([A-Z][A-Z0-9]*-\d+)/i);
  if (browseMatch) return browseMatch[1].toUpperCase();

  // Check for selectedIssue in query params (board view detail panel)
  const params = new URLSearchParams(window.location.search);
  const selectedIssue = params.get('selectedIssue');
  if (selectedIssue && /^[A-Z][A-Z0-9]*-\d+$/i.test(selectedIssue)) {
    return selectedIssue.toUpperCase();
  }

  return null;
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
  // For issue detail view
  const titleElement = document.querySelector(SELECTORS.issueTitle) ||
                       document.querySelector(SELECTORS.issueTitleAlt) ||
                       document.querySelector('h1');

  if (titleElement && !element) {
    return titleElement.textContent.trim();
  }

  // For card/list elements
  if (element) {
    const cardSummary = element.querySelector(SELECTORS.cardSummary) ||
                        element.querySelector('[data-testid*="summary"]') ||
                        element.querySelector('.ghx-summary');

    if (cardSummary) return cardSummary.textContent.trim();

    // Try to find summary in nearby elements
    const summarySpan = element.querySelector('span[class*="summary"], [class*="title"]');
    if (summarySpan) return summarySpan.textContent.trim();
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
  };
}

/*
    ***************
    Button Creation
    ***************
*/

let scheduleForToday = true;

/**
 * Handles click on Marvin button
 */
async function handleMarvinButtonClick(metadata) {
  const token = await getStoredToken();

  if (!token) {
    showSuccessMessage("noToken");
    return;
  }

  const data = {
    title: `[${metadata.issueKey}: ${metadata.summary}](${metadata.issueUrl})`,
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
    showSuccessMessage('fail');
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
    // Style for issue detail view toolbar
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 20px 20px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 8px;
      transition: background-color 0.2s;
      flex-shrink: 0;
    `;
    button.onmouseenter = () => { button.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'; };
    button.onmouseleave = () => { button.style.backgroundColor = 'transparent'; };
  } else if (style === 'card') {
    // Style for board cards
    button.style.cssText = `
      background: url(${logo}) no-repeat center center;
      background-size: 16px 16px;
      background-color: white;
      width: 24px;
      height: 24px;
      border: 1px solid #dfe1e6;
      border-radius: 3px;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s, box-shadow 0.2s;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    `;
    button.onmouseenter = () => {
      button.style.opacity = '1';
      button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    };
    button.onmouseleave = () => {
      button.style.opacity = '0.8';
      button.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
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
 * Adds Marvin button to issue detail view
 */
function addButtonToIssueView() {
  // Find the issue view header/summary area
  const issueView = document.querySelector(SELECTORS.issueView) ||
                    document.querySelector(SELECTORS.issueTitleAlt);

  if (!issueView) return false;

  const metadata = getJiraMetadata();
  if (!metadata) return false;

  // Don't add if already exists
  if (marvinButtonExists(document.body, metadata.issueKey)) return true;

  // Find the header area containing the title
  const headerArea = issueView.closest('[data-testid*="header"]') ||
                     issueView.closest('[data-testid*="foundation"]') ||
                     issueView.parentElement?.parentElement;

  if (!headerArea) return false;

  // Look for action buttons area or create insertion point
  let actionArea = headerArea.querySelector('[data-testid*="actions"]') ||
                   headerArea.querySelector('[role="group"]') ||
                   headerArea.querySelector('div:last-child');

  const button = createMarvinButton(metadata, 'toolbar');

  // Try to find a good place to insert
  if (actionArea && actionArea !== headerArea) {
    actionArea.appendChild(button);
  } else {
    // Insert after the title element
    issueView.parentElement.appendChild(button);
  }

  return true;
}

/**
 * Adds Marvin buttons to board cards
 */
function addButtonsToBoardCards() {
  const cards = document.querySelectorAll(SELECTORS.boardCard) ||
                document.querySelectorAll(SELECTORS.boardCardAlt);

  if (!cards || cards.length === 0) return false;

  let addedAny = false;

  cards.forEach(card => {
    const metadata = getJiraMetadata(card);
    if (!metadata) return;

    if (marvinButtonExists(card, metadata.issueKey)) return;

    // Find or create card actions area
    let actionsArea = card.querySelector('.marvin-actions-area');

    if (!actionsArea) {
      actionsArea = document.createElement('div');
      actionsArea.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        display: none;
        z-index: 10;
      `;
      actionsArea.classList.add('marvin-actions-area');

      // Make card position relative if not already
      const cardStyle = getComputedStyle(card);
      if (cardStyle.position === 'static') {
        card.style.position = 'relative';
      }

      card.appendChild(actionsArea);

      // Show on hover
      card.addEventListener('mouseenter', () => {
        actionsArea.style.display = 'block';
      });
      card.addEventListener('mouseleave', () => {
        actionsArea.style.display = 'none';
      });
    }

    const button = createMarvinButton(metadata, 'card');
    actionsArea.appendChild(button);
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

  // Issue detail view (browse page or selected issue in side panel)
  if ((url.includes('/browse/') || url.includes('selectedIssue=')) && displayInIssueView) {
    added = addButtonToIssueView() || added;
  }

  // Board view
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
 * Debounce function to limit frequent calls
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedAddButtons = debounce(addButtonsToCurrentView, 300);

/**
 * Handles DOM mutations
 */
function handleMutation(mutationsList) {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      debouncedAddButtons();
      break; // Only need to trigger once per batch
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
    return; // Wait for Jira to load
  }

  // Add buttons to current view
  addButtonsToCurrentView();

  if (!isInitialized) {
    isInitialized = true;

    // Set up MutationObserver for SPA navigation
    observer = new MutationObserver(handleMutation);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also listen for URL changes (popstate for back/forward navigation)
    window.addEventListener('popstate', debouncedAddButtons);

    // Listen for hashchange as well
    window.addEventListener('hashchange', debouncedAddButtons);

    // Stop the initial interval
    clearInterval(loopInterval);
  }
}

// Start initialization loop
const loopInterval = setInterval(init, 1000);

// Also try to initialize immediately if DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
}
