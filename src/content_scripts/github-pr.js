import { getStoredGitHubSettings, getStoredToken } from "../utils/storage";
import { addTask } from "../utils/api";
import { formatDate } from "../utils/dates";

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
  const match = window.location.pathname.match(/\/([^/]+)\/([^/]+)\/pull/);
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
 * Generates a smart task title based on PR state
 */
function getSuggestedTitle(metadata, useSmartTitles) {
  if (!useSmartTitles) {
    return `[PR #${metadata.prNumber}: ${metadata.prTitle}](${metadata.prUrl})`;
  }

  // If not own PR and no review yet, suggest reviewing
  if (!metadata.isOwnPR && metadata.reviewStatus !== 'approved') {
    return `[Review PR #${metadata.prNumber}: ${metadata.prTitle}](${metadata.prUrl})`;
  }

  if (metadata.isOwnPR) {
    // Own PR with failing checks
    if (metadata.checkStatus === 'failing') {
      return `[Fix pipeline for PR #${metadata.prNumber}: ${metadata.prTitle}](${metadata.prUrl})`;
    }

    // Own PR approved and ready to merge
    if (metadata.reviewStatus === 'approved' && metadata.checkStatus !== 'failing') {
      return `[Merge PR #${metadata.prNumber}: ${metadata.prTitle}](${metadata.prUrl})`;
    }

    // Own PR with changes requested
    if (metadata.reviewStatus === 'changes_requested') {
      return `[Address review for PR #${metadata.prNumber}: ${metadata.prTitle}](${metadata.prUrl})`;
    }
  }

  // Default format
  return `[PR #${metadata.prNumber}: ${metadata.prTitle}](${metadata.prUrl})`;
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
  const token = await getStoredToken();

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
    showSuccessMessage('fail');
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

/*
    ***************
    Main Logic
    ***************
*/

let enabled = true;
let displayInPRView = true;
let displayInPRList = true;
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
 * Handles DOM mutations - watches for new PR elements
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
    }
  }
}

/**
 * Checks if GitHub page has loaded
 */
function isGitHubLoaded() {
  return document.querySelector(SELECTORS.prTitle) ||
         document.querySelector(SELECTORS.prListRow) ||
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

  // If disabled, don't proceed
  if (!enabled) {
    clearInterval(loopInterval);
    return;
  }

  // If all display options are disabled, don't proceed
  if (!displayInPRView && !displayInPRList) {
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
