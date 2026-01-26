import { getStoredGmailSettings, getStoredToken, getStoredAISuggestionsSettings } from "../utils/storage";
import { addTask } from "../utils/api";
import { formatDate } from "../utils/dates";

const logo = chrome.runtime.getURL("static/logo.png");

/**
 * Simple cache for expensive DOM queries
 * Cache is invalidated when the main view element changes
 */
const selectorCache = {
  mainDivElement: null,
  lastUrl: null,

  /**
   * Invalidates cache if URL or main element changed
   */
  checkValidity() {
    const currentUrl = window.location.href;
    if (this.lastUrl !== currentUrl) {
      this.clear();
      this.lastUrl = currentUrl;
    }
  },

  /**
   * Clears all cached values
   */
  clear() {
    this.mainDivElement = null;
  }
};

/*
    ***************
    AI Suggestions
    ***************
*/

/**
 * Gets AI suggestions for content script button clicks
 * @param {Object} metadata - Platform-specific metadata
 * @param {string} action - Action type for context (reply, followup)
 * @returns {Promise<Object|null>} AI suggestions or null
 */
async function getAISuggestionsForContent(metadata, action = 'reply') {
  try {
    const aiSettings = await getStoredAISuggestionsSettings();
    if (!aiSettings.enabled || !aiSettings.apiKey) {
      return null;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('AI suggestions timed out');
        resolve(null);
      }, 5000); // 5 second timeout

      chrome.runtime.sendMessage(
        {
          message: "getAISuggestions",
          context: {
            platform: 'gmail',
            action,
            metadata,
            sourceUrl: window.location.href,
            templateKey: `gmail-${action}`,
          }
        },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            console.log('AI suggestions error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          if (response?.success && response.suggestions) {
            resolve(response.suggestions);
          } else {
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.log('AI suggestions failed:', error);
    return null;
  }
}

/**
 * Sets loading state on a button
 * @param {HTMLElement} button - The button element
 * @param {boolean} isLoading - Whether loading is in progress
 */
function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.classList.add('marvinButtonLoading');
  } else {
    button.classList.remove('marvinButtonLoading');
  }
}

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
        position: absolute !important;
        bottom: 5%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 350px;
        height: 75px;
        z-index: 999;
        border-radius: 10px;
        text-align: center;
        padding: 10px;
    }

    .marvinTableButton {
        background-size: 20px;
        width: 20px;
        height: 20px;
        margin-right: 10px;
        margin-left: 10px;
        border-radius: 50%;
        background-repeat: no-repeat;
        background-position: center center;
    }

    .marvinSingleButton {
        background-size: 20px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-repeat: no-repeat;
        background-position: center center;
    }

    .marvinButtonLoading {
        opacity: 0.6;
        cursor: wait;
        pointer-events: none;
    }`)
);
document.getElementsByTagName("head")[0].appendChild(marvinSuccessStyles);

marvinSuccessMessage.classList.add(
  "marvinSuccessMessage",
  "marvinSuccessMessageHidden"
);

function changeSuccessMessageClasses(successMessage) {
  if (successMessage === "success") {
    marvinSuccessMessage.textContent = "Task successfully added to Marvin!";
  } else if (successMessage === "noToken") {
    marvinSuccessMessage.textContent =
      "Failed to add Task to Marvin! Please add your Marvin API token by clicking on the extension icon in the browser's toolbar.";
  } else if (successMessage === "reload") {
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
    successMessage === "noToken" || successMessage === "reload" ? 6000 : 2000
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

function getTableRows() {
  return document.querySelectorAll('tr[role="row"]');
}

/**
 * Debounce function to batch rapid calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const debouncedDetermineViewAndAddButtons = debounce((displayInInbox, displayInSingleEmail) => {
  determineViewAndAddButtons(displayInInbox, displayInSingleEmail);
}, 250);

function getLegacyThreadId(email) {
  const threadIdElements = email.querySelectorAll("[data-legacy-thread-id]");
  return threadIdElements.length > 0
    ? threadIdElements[0].getAttribute("data-legacy-thread-id")
    : null;
}

function getEmailSubject(email) {
  const subjectElement = email.querySelector("[data-legacy-thread-id]");
  return subjectElement?.textContent.trim();
}

function getSenderEmail(email) {
  const emailElement = email.querySelector("[email]");
  return emailElement ? emailElement.getAttribute("email") : null;
}

function getSenderName(email) {
  const nameElement = email.querySelector("[name][email]");
  return nameElement ? nameElement.getAttribute("name") : null;
}

/**
 * Extracts the email body content from a given HTML element.
 * Works for single email view, split pane view, and attempts to get
 * snippet/preview for list view.
 * @param {HTMLElement} email - DOM element containing the email
 * @returns {string} The email body text (truncated to 1000 chars)
 */
function getEmailBody(email) {
  // For single email or split pane view - look for main content area
  // The .a3s class contains the actual email content
  // The .ii.gt class is the message container

  // Try multiple selectors as Gmail's DOM can vary
  const bodyElement =
    email.querySelector('.a3s.aiL') ||           // Primary email content
    email.querySelector('.a3s') ||                // Fallback content area
    email.querySelector('.ii.gt') ||              // Message container
    email.querySelector('[data-message-id] .a3s'); // Message-specific

  if (bodyElement) {
    // Get text content and clean it up
    let bodyText = bodyElement.innerText || bodyElement.textContent || '';
    bodyText = bodyText.trim();

    // Truncate if too long (1000 chars max)
    if (bodyText.length > 1000) {
      bodyText = bodyText.substring(0, 997) + '...';
    }

    return bodyText;
  }

  // For list view (table rows), try to get the snippet/preview
  // Gmail shows a snippet in the list which we can capture
  const snippetElement = email.querySelector('.y2');  // Snippet in list view
  if (snippetElement) {
    let snippet = snippetElement.textContent || '';
    return snippet.trim();
  }

  return '';
}

/**
 * Extracts email metadata from a given HTML element.
 *
 * @function getEmailMetadata
 * @param {HTMLElement} email - DOM element whose children contain email metadata.
 * @returns {EmailMetadata} An object containing the email metadata.
 *
 * @typedef {Object} EmailMetadata
 * @property {string} legacyThreadId - Legacy thread ID of the email.
 * @property {string} emailSubject - Email subject.
 * @property {string} senderEmail - Sender's email address.
 * @property {string} senderName - Sender's name.
 * @property {string} emailBody - Email body content (truncated to 1000 chars).
 */

function getEmailMetadata(email) {
  return {
    legacyThreadId: getLegacyThreadId(email),
    emailSubject: getEmailSubject(email),
    senderEmail: getSenderEmail(email),
    senderName: getSenderName(email),
    emailBody: getEmailBody(email),
  };
}

function isNotMarvinButton(element) {
  return !element.classList.contains("marvinButton");
}

/**
 * Handles click on Marvin button
 * @param {Object} emailData - Gmail email metadata
 * @param {HTMLElement} button - The clicked button element for loading state
 */
async function handleMarvinButtonClick(emailData, button) {
  if (!isExtensionContextValid()) {
    changeSuccessMessageClasses("reload");
    return;
  }

  let token;
  try {
    token = await getStoredToken();
  } catch (error) {
    if (error.message?.includes("Extension context invalidated")) {
      changeSuccessMessageClasses("reload");
      return;
    }
    throw error;
  }

  if (!token) {
    changeSuccessMessageClasses("noToken");
    return;
  }

  // Show loading state
  setButtonLoading(button, true);

  // Try AI suggestions first
  const aiSuggestions = await getAISuggestionsForContent(emailData, 'reply');

  // Reset loading state
  setButtonLoading(button, false);

  let emailUrl =
    window.location.href.split("#")[0] + "#inbox/" + emailData.legacyThreadId;

  let title;
  if (aiSuggestions?.title) {
    // Use AI-generated title
    title = aiSuggestions.title;
  } else {
    // Fall back to email subject
    title = emailData.emailSubject;
  }

  let data = {
    title: `[${title}](${emailUrl})`,
    done: false,
  };

  // Apply AI-suggested time estimate if available
  if (aiSuggestions?.timeEstimate) {
    data.timeEstimate = aiSuggestions.timeEstimate;
  }

  // Build note with email metadata (following Slack/Jira pattern)
  let noteLines = [':::info'];
  noteLines.push(`Sender: ${emailData.senderName} <${emailData.senderEmail}>`);

  if (emailData.emailBody) {
    noteLines.push('');
    noteLines.push('Email Content:');
    noteLines.push(emailData.emailBody);
  }

  noteLines.push('');
  noteLines.push(`[View Email](${emailUrl})`);

  // Add AI note if provided
  if (aiSuggestions?.note) {
    noteLines.push('');
    noteLines.push('AI Summary:');
    noteLines.push(aiSuggestions.note);
  }

  data.note = noteLines.join('\n');

  if (scheduleForToday) data.day = formatDate(new Date());

  try {
    const message = await addTask(data);
    if (message === "success") {
      changeSuccessMessageClasses("success");
    } else {
      changeSuccessMessageClasses("fail");
    }
  } catch (error) {
    console.error("Failed to add task to Marvin:", error);
    if (error.message?.includes("Extension context invalidated")) {
      changeSuccessMessageClasses("reload");
    } else {
      changeSuccessMessageClasses("fail");
    }
  }
}

function createTableMarvinButton(emailData) {
  let tableMarvinButton = document.createElement("li");
  tableMarvinButton.classList.add("bqX", "marvinButton", "marvinTableButton");
  tableMarvinButton.style.backgroundImage = `url(${logo})`;
  tableMarvinButton.setAttribute("data-tooltip", "Add to Marvin");

  tableMarvinButton.onclick = () => {
    handleMarvinButtonClick(emailData, tableMarvinButton);
  };

  return tableMarvinButton;
}

function createSingleEmailMarvinButton(emailData) {
  let marvinButtonContainer = document.createElement("div");
  marvinButtonContainer.classList.add(
    "T-I",
    "J-J5-Ji",
    "T-I-Js-Gs",
    "T-I-ax7",
    "T-I-Js-IF",
    "marvinButton"
  );
  marvinButtonContainer.setAttribute("data-tooltip", "Add to Marvin");
  marvinButtonContainer.setAttribute("role", "button");
  marvinButtonContainer.setAttribute("tabIndex", "0");
  marvinButtonContainer.setAttribute("aria-haspopup", "false");
  marvinButtonContainer.setAttribute("aria-expanded", "false");
  marvinButtonContainer.setAttribute("aria-label", "Add to Marvin");
  marvinButtonContainer.setAttribute("data-email-id", emailData.legacyThreadId);
  const asaDiv = document.createElement("div");
  asaDiv.classList.add("asa");
  marvinButtonContainer.appendChild(asaDiv);

  marvinButtonContainer.onmouseenter = () => {
    marvinButtonContainer.classList.add("T-I-JW");
  };
  marvinButtonContainer.onmouseleave = () => {
    marvinButtonContainer.classList.remove("T-I-JW");
  };

  marvinButtonContainer.onclick = () => {
    handleMarvinButtonClick(emailData, marvinButtonContainer);
  };

  let singleMarvinButton = document.createElement("div");
  singleMarvinButton.classList.add("ase", "T-I-J3", "J-J5-Ji", "marvinSingleButton");
  singleMarvinButton.style.backgroundImage = `url(${logo})`;

  asaDiv.appendChild(singleMarvinButton);

  return marvinButtonContainer;
}

function addMarvinButtonToToolbarButtons() {
  try {
    const tableRows = getTableRows();

    if (tableRows.length === 0) {
      return;
    }

    tableRows.forEach((tableRow) => {
      // Selects element containing "Archive", "Delete, "Mark as read", "Snooze", etc. buttons.
      const toolbar = tableRow.querySelector('ul[role="toolbar"]');

      // Skip rows without toolbar (e.g., header rows, footer rows)
      if (!toolbar) {
        return;
      }

      const emailData = getEmailMetadata(tableRow);

      let noMarvinButton = [...toolbar.childNodes].every(isNotMarvinButton);

      if (noMarvinButton) {
        toolbar.appendChild(createTableMarvinButton(emailData));
      }
    });

    isDoneDeterminingView = true;
  } catch (error) {
    console.error('Marvin Gmail toolbar button error:', error);
  }
}

/**
 * Checks if a button with a specific emailId exists within a given parent element.
 * @function checkIfButtonExists
 * @param {string} emailId - The Legacy thread ID of the email stored in custom data-email-id data attribute.
 * @param {HTMLElement} element - The parent element where the button should be located.
 * @returns {boolean} True if the button exists, false otherwise.
 */
function checkIfButtonExists(emailId, element) {
  const existingButton = element.querySelector(
    `.marvinButton[data-email-id="${emailId}"]`
  );
  return existingButton !== null;
}

// Adds "Add to Marvin" button to a single email which can be displayed:
// - on its own (https://mail.google.com/mail/u/0/#inbox/RANDOMEMAILIDSTRING)
// - in horizontal or vertical split pane, under or on the right side of the list of emails
function addMarvinButtonToSingleEmail() {
  try {
    // Element containing all buttons at the top: Back to Inbox, Archive, Report Spam, ..., More.
    const allButtonsContainers = document.querySelectorAll(".G-tF");
    if (allButtonsContainers.length === 0) {
      return;
    }

    let buttonsContainer;

    // Since it's possible for there to be multiple buttons containers,
    // here we're selecting the one that is visible. The one that is visible
    // will have offsetParent property set to a DOM element.
    // There are some other properties on the element that is visible that are not null:
    // offsetHeight, offsetWidth, offsetLeft, offsetTop, clientHeight and clientWidth.
    allButtonsContainers.forEach((el) => {
      if (el.offsetParent !== null) {
        buttonsContainer = el;
      }
    });

    // Find div element containing "Move to" and "Labels" buttons
    const insertIntoElement = buttonsContainer && buttonsContainer.childNodes[3];

    // Early return if the expected button container element is not found
    if (!insertIntoElement) {
      return;
    }

    let noMarvinButton = [...insertIntoElement.childNodes].every(
      isNotMarvinButton
    );

    // When e-mail is displayed in split pane mode, buttonsContainer
    // will be the same as when viewing a single email. So we have to
    // handle the case when an email is displayed in the split pane
    // and there's also a list of emails. In that case we have to
    // get email metadata from the split pane.

    // When using split pane mode (vertical or horizontal split)
    // the email in the pane will be displayed in a table whose
    // parent is a div with a width style attribute.
    let splitPaneEmail = [...document.querySelectorAll("table")].filter((el) => {
      let isDiv = el.parentNode.nodeName === "DIV";
      let hasWidthStyle = el.parentNode.getAttribute("style")?.includes("width");
      return isDiv && hasWidthStyle;
    })[0];

    // If split pane exists, check that "No conversations selected" is not displayed
    // by querying for data-legacy-thread-id attribute
    let splitPaneEmailContainsEmail =
      splitPaneEmail &&
      splitPaneEmail.querySelectorAll("[data-legacy-thread-id]").length > 0;

    // If email is displayed in split pane we have to replace the Marvin button.
    // If we don't, it will contain email metadata for the first email in displayed tab (Primary, Social, Updates, etc.)
    if (splitPaneEmail && splitPaneEmailContainsEmail) {
      const emailData = getEmailMetadata(splitPaneEmail);

      if (!checkIfButtonExists(emailData.legacyThreadId, insertIntoElement)) {
        let marvinButtonForReplacement =
          insertIntoElement.querySelector(".marvinButton");
        const newButton = createSingleEmailMarvinButton(emailData);
        insertIntoElement.replaceChild(newButton, marvinButtonForReplacement);
      }

      isDoneDeterminingView = true;
      return;
    }

    // When only one email is displayed, we don't have to check
    // if the button already exists using data-email-id attribute.
    // It's enough to just check if the button exists.
    if (!noMarvinButton) {
      return;
    }

    // Get emailData and create Marvin button
    const emailData = getEmailMetadata(
      document.querySelector('div[role="main"]')
    );
    const marvinButton = createSingleEmailMarvinButton(emailData);

    // Insert Marvin button into the target element
    insertIntoElement.appendChild(marvinButton);

    isDoneDeterminingView = true;
  } catch (error) {
    console.error('Marvin Gmail single email button error:', error);
  }
}

async function handleMutation(mutationsList, observer) {
  try {
    for (const mutation of mutationsList) {
      // Monitor for changes made to the div we're observing (div with role set to main).
      // For example, when the user opens an email, Gmail will keep this element
      // in the DOM, but will remove role="main" from it and create a new div
      // with role="main".
      if (
        mutation.target === mainDivElement &&
        mutation.type === "attributes" &&
        mutation.attributeName === "role"
      ) {
        const role = mainDivElement.getAttribute("role");
        if (role !== "main") {
          // Remove the observer from the currently monitored div element
          observer.disconnect();

          // Re-add buttons to handle the case when single email view is displayed.
          // When we open an email from table view, we need to display Marvin button.
          // Just setting an observer won't work as it's possible no mutations will be
          // made resulting in the Marvin button not getting added.
          debouncedDetermineViewAndAddButtons(displayInInbox, displayInSingleEmail);

          // Find the new div with role="main" and start observing it
          mainDivElement = document.querySelector('div[role="main"]');
          const observerConfig = {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["role"],
          };
          observer.observe(mainDivElement, observerConfig);

          break;
        }
      }

      // Debounce button rendering for childList mutations
      if (mutation.type === "childList") {
        debouncedDetermineViewAndAddButtons(displayInInbox, displayInSingleEmail);
        break; // Exit early - debounce will handle batching
      }
    }
  } catch (error) {
    console.error('Marvin Gmail mutation handler error:', error);
  }
}

/**
 * Determines the current email view (single email or list of emails)
 * and adds the Marvin button(s) to the appropriate location(s).
 * @function determineViewAndAddButtons
 * @param {boolean} displayInInbox - Indicates whether the Marvin button should be added to the emails in the list.
 * @param {boolean} displayInSingleEmail - Indicates whether the Marvin button should be added to the single email.
 */
function determineViewAndAddButtons(displayInInbox, displayInSingleEmail) {
  selectorCache.checkValidity();
  // Initially I was scanning for divs with role="tabpanel" but it turns out that
  // there are cases when those are not displayed. Instead, div with role="grid"
  // is displayed everywhere, including lists like Starred, Snoozed, etc.
  let emailGrid = document.querySelectorAll('table[role="grid"]');
  // Select back to (Inbox) list button
  let backToListButton;
  let allBackToListButtons = document.querySelectorAll('div[act="19"]');
  if (allBackToListButtons.length > 0) {
    // Select the last button in the list since it's the one that is visible
    backToListButton = allBackToListButtons[allBackToListButtons.length - 1];
  }

  // Single email is displayed - either on its own or in split pane
  if (backToListButton !== null && displayInSingleEmail) {
    addMarvinButtonToSingleEmail();
  }
  // List of emails is displayed
  if (emailGrid.length > 0 && getTableRows().length > 0 && displayInInbox) {
    addMarvinButtonToToolbarButtons();
  }
}

let mainDivElement;
let scheduleForToday = false;
let displayInInbox = false;
let displayInSingleEmail = false;
let isDoneDeterminingView = false;

async function init() {
  try {
    let gmailSettings = await getStoredGmailSettings();
    displayInInbox = gmailSettings.displayInInbox;
    displayInSingleEmail = gmailSettings.displayInSingleEmail;
    scheduleForToday = gmailSettings.scheduleForToday;

    if (!displayInInbox && !displayInSingleEmail) {
      clearInterval(loopInterval);
      return;
    }

    // Selects panels (email container lists, for example Primary, Social, Promotions, etc. )
    // or the element containing a single email
    mainDivElement = document.querySelector('div[role="main"]');

    determineViewAndAddButtons(displayInInbox, displayInSingleEmail);

    if (mainDivElement && isDoneDeterminingView) {
      const observer = new MutationObserver(handleMutation);
      const observerConfig = {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["role"],
      };
      observer.observe(mainDivElement, observerConfig);

      // Stop the loopInterval as the mutation observer is now handling the changes
      clearInterval(loopInterval);
    }
  } catch (error) {
    console.error('Marvin Gmail init error:', error);
    // Don't stop the interval - Gmail might load later
  }
}

let loopInterval = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 30; // 30 seconds max

/**
 * Start initialization with event-based approach
 */
function startInit() {
  // Try immediately if DOM is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  }

  // Fall back to polling with reduced frequency
  if (!loopInterval) {
    loopInterval = setInterval(() => {
      initAttempts++;
      if (initAttempts >= MAX_INIT_ATTEMPTS) {
        clearInterval(loopInterval);
        console.log('Marvin Gmail: Max init attempts reached');
        return;
      }
      init();
    }, 500); // 500ms instead of 1000ms for faster initial load
  }
}

// Initialize on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startInit);
} else {
  startInit();
}

/**
 * Message listener for popup context requests
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "getPageContext") {
    // Check if we're viewing a single email
    const mainDiv = document.querySelector('div[role="main"]');
    if (!mainDiv) {
      sendResponse({ context: null });
      return true;
    }

    // Try to get email metadata from the current view
    const emailData = getEmailMetadata(mainDiv);

    if (emailData.emailSubject) {
      // Build email URL
      let emailUrl = window.location.href;
      if (emailData.legacyThreadId && !emailUrl.includes(emailData.legacyThreadId)) {
        emailUrl = window.location.href.split("#")[0] + "#inbox/" + emailData.legacyThreadId;
      }

      // Try to get email body excerpt
      let bodyExcerpt = "";
      const emailBody = mainDiv.querySelector('[data-message-id] .a3s, .ii.gt');
      if (emailBody) {
        const bodyText = emailBody.textContent.trim();
        bodyExcerpt = bodyText.length > 300 ? bodyText.substring(0, 297) + "..." : bodyText;
      }

      // Check if this is a thread (multiple messages)
      const messageCount = mainDiv.querySelectorAll('[data-message-id]').length;
      const isThread = messageCount > 1;

      sendResponse({
        context: {
          type: "gmail-email",
          platform: "gmail",
          subject: emailData.emailSubject,
          senderName: emailData.senderName,
          senderEmail: emailData.senderEmail,
          bodyExcerpt: bodyExcerpt,
          isThread: isThread,
          messageCount: messageCount,
          url: emailUrl,
          title: emailData.emailSubject,
        },
      });
    } else {
      sendResponse({ context: null });
    }
    return true;
  }

  if (request.message === "getPageTitle") {
    sendResponse({
      title: document.title,
      url: window.location.href,
    });
    return true;
  }

  if (request.message === "getSelectedText") {
    sendResponse({
      selectedText: window.getSelection().toString(),
    });
    return true;
  }
});
