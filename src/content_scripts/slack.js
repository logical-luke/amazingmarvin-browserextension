import { getStoredSlackSettings, getStoredToken, getStoredAISuggestionsSettings } from "../utils/storage";
import { addTask } from "../utils/api";
import { formatDate } from "../utils/dates";
import { TITLE_TEMPLATES } from "../utils/taskContext";

/*
    ***************
    AI Suggestions
    ***************
*/

/**
 * Gets AI suggestions for content script button clicks
 * @param {Object} metadata - Platform-specific metadata
 * @param {string} action - Action type for context (reply, thread, dm)
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
            platform: 'slack',
            action,
            metadata,
            sourceUrl: window.location.href,
            templateKey: `slack-${action}`,
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
    button.style.opacity = '0.6';
    button.style.cursor = 'wait';
    button.style.pointerEvents = 'none';
  } else {
    button.style.opacity = '';
    button.style.cursor = '';
    button.style.pointerEvents = '';
  }
}

const logo = chrome.runtime.getURL("static/logo.png");

// Slack-specific selectors (Slack's DOM changes frequently, multiple fallbacks)
const SELECTORS = {
  // Virtual list containers
  virtualList: '[data-qa="virtual-list"]',
  virtualListItem: '[data-qa="virtual-list-item"]',

  // Message containers
  messageContainer: '[data-qa="message-container"]',
  messageKit: '.c-message_kit__message',
  messageListContainer: '.c-message_list',
  messageListItem: '.c-message_list__item',

  // Message actions toolbar (appears on hover)
  messageActions: '.c-message_actions__container',
  messageActionsGroup: '.c-message_actions__group',
  hoverMenu: '[data-qa="message_actions"]',

  // Message content elements
  messageBody: '.c-message_kit__text',
  richText: '.p-rich_text_section',
  messageContent: '.c-message__content',
  messageText: '.c-message_kit__blocks',

  // Metadata elements
  messageSender: '.c-message__sender',
  senderLink: '.c-message__sender_link',
  senderButton: '[data-qa="message_sender_name"]',
  timestamp: '.c-timestamp',
  timestampLabel: '.c-timestamp__label',
  timestampLink: '[data-qa="timestamp"]',

  // Context elements
  channelHeader: '.p-view_header__channel_title',
  channelHeaderButton: '[data-qa="channel_name"]',
  channelName: '[data-qa="channel-header-label"]',
  conversationHeader: '.p-conversation_header__title',
  workspaceSwitcher: '[data-qa="team-menu-trigger"]',

  // Thread elements
  threadView: '.p-flexpane',
  threadContainer: '[data-qa="thread-message-list"]',
  threadParent: '[data-qa="thread_parent_message"]',

  // Unreads view
  unreadsContainer: '[data-qa="unreads_view"]',
  activityItem: '.p-activity_bar_item',
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

/*
    ***************
    Metadata Extraction
    ***************
*/

/**
 * Gets the current channel or conversation name
 */
function getChannelName() {
  // Try multiple selectors as Slack's DOM varies
  const channelHeader =
    document.querySelector(SELECTORS.channelHeader) ||
    document.querySelector(SELECTORS.channelHeaderButton) ||
    document.querySelector(SELECTORS.channelName) ||
    document.querySelector(SELECTORS.conversationHeader);

  if (channelHeader) {
    return channelHeader.textContent.trim();
  }

  // Fallback: extract from URL if possible
  // URL format: https://app.slack.com/client/{workspace}/{channel}
  const urlParts = window.location.pathname.split("/");
  if (urlParts.length >= 4) {
    return urlParts[3]; // Channel ID
  }

  return "Slack";
}

/**
 * Gets sender name from a message element
 */
function getSenderName(messageElement) {
  const senderElement =
    messageElement.querySelector(SELECTORS.senderLink) ||
    messageElement.querySelector(SELECTORS.senderButton) ||
    messageElement.querySelector(SELECTORS.messageSender);

  if (senderElement) {
    return senderElement.textContent.trim();
  }

  // Try aria-label on avatar
  const avatar = messageElement.querySelector(".c-avatar");
  if (avatar) {
    const ariaLabel = avatar.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;
  }

  return "Unknown";
}

/**
 * Gets message text content
 */
function getMessageText(messageElement) {
  const textElement =
    messageElement.querySelector(SELECTORS.richText) ||
    messageElement.querySelector(SELECTORS.messageBody) ||
    messageElement.querySelector(SELECTORS.messageContent) ||
    messageElement.querySelector(SELECTORS.messageText);

  if (textElement) {
    return textElement.textContent.trim();
  }

  return "";
}

/**
 * Gets timestamp from a message element
 */
function getTimestamp(messageElement) {
  const timestampElement =
    messageElement.querySelector(SELECTORS.timestampLink) ||
    messageElement.querySelector(SELECTORS.timestamp);

  if (timestampElement) {
    // Try aria-label first (usually has full date/time)
    const ariaLabel = timestampElement.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;

    // Try the label inside
    const labelElement = timestampElement.querySelector(SELECTORS.timestampLabel);
    if (labelElement) return labelElement.textContent.trim();

    return timestampElement.textContent.trim();
  }

  return "";
}

/**
 * Constructs a permalink for the message
 */
function constructPermalink(messageElement) {
  // Try to get timestamp data attribute which Slack uses for permalinks
  const timestampElement = messageElement.querySelector(SELECTORS.timestamp) ||
                           messageElement.querySelector(SELECTORS.timestampLink);

  if (timestampElement) {
    // Check for href which is often the permalink
    const href = timestampElement.getAttribute("href");
    if (href && href.startsWith("/archives/")) {
      return `https://slack.com${href}`;
    }
  }

  // Fallback to current URL
  return window.location.href;
}

/**
 * Determines if message is in a thread view
 */
function isInThread(messageElement) {
  return !!messageElement.closest(SELECTORS.threadView) ||
         !!messageElement.closest(SELECTORS.threadContainer);
}

/**
 * Builds complete Slack message metadata
 */
function getSlackMessageMetadata(messageElement) {
  const messageText = getMessageText(messageElement);

  // Skip if no message text
  if (!messageText) return null;

  return {
    senderName: getSenderName(messageElement),
    channelName: getChannelName(),
    messageText,
    timestamp: getTimestamp(messageElement),
    permalink: constructPermalink(messageElement),
    isThread: isInThread(messageElement),
  };
}

/*
    ***************
    Button Creation
    ***************
*/

let scheduleForToday = true;

/**
 * Checks if extension context is still valid
 */
function isExtensionContextValid() {
  try {
    // This will throw if context is invalidated
    chrome.runtime.getURL("");
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Handles click on Marvin button
 * @param {Object} metadata - Slack message metadata
 * @param {HTMLElement} button - The clicked button element for loading state
 */
async function handleMarvinButtonClick(metadata, button) {
  // Check if extension context is still valid
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

  // Determine action type for AI context
  let action = 'reply';
  const channelName = metadata.channelName || '';
  const isDM = metadata.isDM || channelName.toLowerCase().includes('direct message');
  if (metadata.isThread) {
    action = 'thread';
  } else if (isDM) {
    action = 'dm';
  }

  // Show loading state
  setButtonLoading(button, true);

  // Try AI suggestions first
  const aiSuggestions = await getAISuggestionsForContent(metadata, action);

  // Reset loading state
  setButtonLoading(button, false);

  let title;
  if (aiSuggestions?.title) {
    // Use AI-generated title
    title = aiSuggestions.title;
  } else {
    // Fall back to template-based title
    const messagePreview =
      metadata.messageText.length > 50
        ? metadata.messageText.substring(0, 47) + "..."
        : metadata.messageText;

    const templateKey = action === 'thread' ? 'slack-thread' : (action === 'dm' ? 'slack-dm' : 'slack-reply');
    const template = TITLE_TEMPLATES[templateKey] || TITLE_TEMPLATES['slack-reply'];
    title = template
      .replace('{channel}', channelName)
      .replace('{messagePreview}', messagePreview)
      .replace('{senderName}', metadata.senderName || '');
  }

  const data = {
    title: metadata.permalink ? `[${title}](${metadata.permalink})` : title,
    done: false,
  };

  // Apply AI-suggested time estimate if available
  if (aiSuggestions?.timeEstimate) {
    data.timeEstimate = aiSuggestions.timeEstimate;
  }

  // Build note with message metadata
  let noteLines = [":::info"];
  noteLines.push(`From: ${metadata.senderName}`);
  noteLines.push(`Channel: ${channelName}`);
  if (metadata.timestamp) {
    noteLines.push(`Time: ${metadata.timestamp}`);
  }
  if (metadata.isThread) {
    noteLines.push("(Thread message)");
  }
  noteLines.push("");
  noteLines.push("Message:");
  noteLines.push(metadata.messageText);

  if (metadata.permalink) {
    noteLines.push("");
    noteLines.push(`[View in Slack](${metadata.permalink})`);
  }

  // Add AI note if provided
  if (aiSuggestions?.note) {
    noteLines.push("");
    noteLines.push("AI Summary:");
    noteLines.push(aiSuggestions.note);
  }

  data.note = noteLines.join("\n");

  if (scheduleForToday) {
    data.day = formatDate(new Date());
  }

  try {
    const result = await addTask(data);
    showSuccessMessage(result);
  } catch (error) {
    console.error("Failed to add task to Marvin:", error);
    if (error.message?.includes("Extension context invalidated")) {
      showSuccessMessage("reload");
    } else {
      showSuccessMessage("fail");
    }
  }
}

/**
 * Creates a Marvin button for Slack messages matching Slack's native button design
 */
function createMarvinButton(metadata) {
  const button = document.createElement("button");

  // Use Slack's native button classes for consistent styling
  button.className = "c-button-unstyled c-icon_button c-icon_button--size_small c-message_actions__button c-icon_button--default marvinButton";
  button.setAttribute("aria-label", "Add to Marvin");
  button.setAttribute("title", "Add to Marvin");
  button.setAttribute("data-qa", "add_to_marvin");
  button.setAttribute("type", "button");

  // Create img element with Marvin logo, sized to match Slack's icons
  const img = document.createElement("img");
  img.src = logo;
  img.alt = "Add to Marvin";
  img.setAttribute("aria-hidden", "true");
  img.style.cssText = "width: 18px; height: 18px; display: block;";

  button.appendChild(img);

  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleMarvinButtonClick(metadata, button);
  };

  return button;
}

/*
    ***************
    Button Injection
    ***************
*/

/**
 * Checks if Marvin button already exists in container
 */
function marvinButtonExists(container) {
  return container.querySelector(".marvinButton") !== null;
}

/**
 * Adds Marvin button to a message's actions toolbar
 */
function addButtonToMessage(messageElement) {
  // Skip if button already exists
  if (marvinButtonExists(messageElement)) return;

  const metadata = getSlackMessageMetadata(messageElement);
  if (!metadata) return; // Skip empty messages

  // Check view settings
  const isThread = metadata.isThread;
  const channelName = metadata.channelName.toLowerCase();
  const isDM = channelName.includes("direct message") || channelName.match(/^[a-z]+, [a-z]+/i);

  if (isThread && !showInThreads) return;
  if (isDM && !showInDMs) return;
  if (!isThread && !isDM && !showInChannels) return;

  // Only add to message actions toolbar (Slack's hover menu)
  const actionsContainer = messageElement.querySelector(SELECTORS.messageActions);
  if (!actionsContainer) return;

  const actionsGroup = actionsContainer.querySelector(SELECTORS.messageActionsGroup);
  if (!actionsGroup) return;

  // Skip if button already in this group
  if (actionsGroup.querySelector(".marvinButton")) return;

  const button = createMarvinButton(metadata);

  // Insert before "Save for later" button (data-qa="later") for natural placement
  const saveForLaterButton = actionsGroup.querySelector('[data-qa="later"]');
  if (saveForLaterButton) {
    actionsGroup.insertBefore(button, saveForLaterButton);
    return;
  }

  // Fallback: Insert before "More actions" button
  const moreActionsButton = actionsGroup.querySelector('[data-qa="more_message_actions"]');
  if (moreActionsButton) {
    actionsGroup.insertBefore(button, moreActionsButton);
    return;
  }

  // Final fallback: append to end
  actionsGroup.appendChild(button);
}

/**
 * Adds buttons to all visible messages
 */
function addButtonsToMessages() {
  // Query for various message container types
  const messageContainers = document.querySelectorAll(SELECTORS.messageContainer);
  const messageKits = document.querySelectorAll(SELECTORS.messageKit);
  const listItems = document.querySelectorAll(SELECTORS.messageListItem);
  const virtualItems = document.querySelectorAll(SELECTORS.virtualListItem);

  // Combine all message elements
  const allMessages = [
    ...Array.from(messageContainers),
    ...Array.from(messageKits),
    ...Array.from(listItems),
    ...Array.from(virtualItems),
  ];

  // Filter unique elements and those that contain message content
  const processedElements = new Set();
  const uniqueMessages = allMessages.filter((el) => {
    if (processedElements.has(el)) return false;
    processedElements.add(el);

    // Must have some message content
    const hasContent =
      el.querySelector(SELECTORS.richText) ||
      el.querySelector(SELECTORS.messageBody) ||
      el.querySelector(SELECTORS.messageText);
    return hasContent;
  });

  uniqueMessages.forEach((message) => {
    addButtonToMessage(message);
  });

  return uniqueMessages.length > 0;
}

/*
    ***************
    Main Logic
    ***************
*/

let enabled = true;
let showInChannels = true;
let showInDMs = true;
let showInThreads = true;
let isInitialized = false;
let observer = null;

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

const debouncedAddButtons = debounce(addButtonsToMessages, 250);

/**
 * Handles DOM mutations - watches for new messages
 */
function handleMutation(mutationsList) {
  for (const mutation of mutationsList) {
    if (mutation.type !== "childList" || mutation.addedNodes.length === 0)
      continue;

    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      // Check if this is or contains a message element
      if (
        node.matches?.(SELECTORS.messageContainer) ||
        node.matches?.(SELECTORS.messageKit) ||
        node.matches?.(SELECTORS.virtualListItem) ||
        node.querySelector?.(SELECTORS.messageContainer) ||
        node.querySelector?.(SELECTORS.messageKit) ||
        node.querySelector?.(SELECTORS.richText)
      ) {
        debouncedAddButtons();
        return;
      }

      // Check for message actions appearing (on hover)
      if (
        node.matches?.(SELECTORS.messageActions) ||
        node.querySelector?.(SELECTORS.messageActions)
      ) {
        debouncedAddButtons();
        return;
      }
    }
  }
}

/**
 * Checks if Slack has loaded
 */
function isSlackLoaded() {
  return (
    document.querySelector(SELECTORS.virtualList) ||
    document.querySelector(SELECTORS.messageListContainer) ||
    document.querySelector('[data-qa="message_list"]') ||
    document.querySelector('[data-qa="slack_kit_list"]')
  );
}

/**
 * Initializes the content script
 */
async function init() {
  // Load settings
  const settings = await getStoredSlackSettings();
  enabled = settings.enabled ?? true;
  scheduleForToday = settings.scheduleForToday ?? true;
  showInChannels = settings.showInChannels ?? true;
  showInDMs = settings.showInDMs ?? true;
  showInThreads = settings.showInThreads ?? true;

  // If disabled, don't proceed
  if (!enabled) {
    clearInterval(loopInterval);
    return;
  }

  // Wait for Slack to load
  if (!isSlackLoaded() && !isInitialized) {
    return;
  }

  // Add buttons to current messages
  addButtonsToMessages();

  if (!isInitialized) {
    isInitialized = true;

    // Set up MutationObserver for dynamic content
    observer = new MutationObserver(handleMutation);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Stop the initial interval
    clearInterval(loopInterval);

    console.log("Marvin Slack integration initialized");
  }
}

// Start initialization loop
const loopInterval = setInterval(init, 1000);

// Also try to initialize immediately if DOM is ready
if (document.readyState === "complete" || document.readyState === "interactive") {
  init();
}

/**
 * Gathers context from multiple recent messages
 * @param {number} count - Number of messages to gather
 * @returns {Array} Array of message objects with sender, text, timestamp
 */
function getRecentMessages(count = 5) {
  const messages = document.querySelectorAll(SELECTORS.messageContainer);
  const recentMessages = [];

  // Get the last N messages
  const startIndex = Math.max(0, messages.length - count);
  for (let i = startIndex; i < messages.length; i++) {
    const msg = messages[i];
    const metadata = getSlackMessageMetadata(msg);
    if (metadata && metadata.messageText) {
      recentMessages.push({
        sender: metadata.senderName,
        text: metadata.messageText.substring(0, 200), // Truncate long messages
        timestamp: metadata.timestamp,
        isThread: metadata.isThread,
      });
    }
  }

  return recentMessages;
}

/**
 * Message listener for popup context requests
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "getPageContext") {
    // Gather context from the current page for smart autocomplete
    const channelName = getChannelName();
    const isDM =
      channelName.toLowerCase().includes("direct message") ||
      channelName.match(/^[a-z]+, [a-z]+/i);

    // Check if we're in a thread view
    const isInThreadView = !!document.querySelector(SELECTORS.threadView) ||
                           !!document.querySelector(SELECTORS.threadContainer);

    // Get multiple recent messages for conversation context
    const conversationContext = getRecentMessages(5);

    // Get the most recent message as the primary context
    const messages = document.querySelectorAll(SELECTORS.messageContainer);
    let messageMetadata = null;

    if (messages.length > 0) {
      // Get the last visible message
      const lastMessage = messages[messages.length - 1];
      messageMetadata = getSlackMessageMetadata(lastMessage);
    }

    // Build conversation summary for AI context
    let conversationSummary = "";
    if (conversationContext.length > 0) {
      conversationSummary = conversationContext
        .map(m => `${m.sender}: ${m.text}`)
        .join("\n");
    }

    sendResponse({
      context: {
        type: "slack-message",
        platform: "slack",
        channelName,
        isDM,
        isThread: isInThreadView || messageMetadata?.isThread || false,
        senderName: messageMetadata?.senderName,
        messageText: messageMetadata?.messageText,
        messagePreview: messageMetadata?.messageText
          ? messageMetadata.messageText.substring(0, 50)
          : "",
        conversationContext: conversationContext,
        conversationSummary: conversationSummary.substring(0, 1000), // Limit for API
        messageCount: conversationContext.length,
        url: window.location.href,
        title: `${channelName} - Slack`,
      },
    });
    return true;
  }
});
