import { getStoredSlackSettings, getStoredToken } from "../utils/storage";
import { addTask } from "../utils/api";
import { formatDate } from "../utils/dates";

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
 * Handles click on Marvin button
 */
async function handleMarvinButtonClick(metadata) {
  const token = await getStoredToken();

  if (!token) {
    showSuccessMessage("noToken");
    return;
  }

  // Format title: [Slack: Channel/DM] Message preview...
  const titlePreview =
    metadata.messageText.length > 60
      ? metadata.messageText.substring(0, 57) + "..."
      : metadata.messageText;

  const data = {
    title: `[Slack: ${metadata.channelName}] ${titlePreview}`,
    done: false,
  };

  // Build note with message metadata
  let noteLines = [":::info"];
  noteLines.push(`From: ${metadata.senderName}`);
  noteLines.push(`Channel: ${metadata.channelName}`);
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

  data.note = noteLines.join("\n");

  if (scheduleForToday) {
    data.day = formatDate(new Date());
  }

  try {
    const result = await addTask(data);
    showSuccessMessage(result);
  } catch (error) {
    console.error("Failed to add task to Marvin:", error);
    showSuccessMessage("fail");
  }
}

/**
 * Creates a Marvin button for Slack messages
 */
function createMarvinButton(metadata) {
  const button = document.createElement("button");
  button.classList.add("marvinButton");
  button.setAttribute("aria-label", "Add to Marvin");
  button.setAttribute("title", "Add to Marvin");
  button.setAttribute("type", "button");

  // Style to match Slack's action buttons
  button.style.cssText = `
    background: url(${logo}) no-repeat center center;
    background-size: 16px 16px;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s, background-color 0.1s;
    flex-shrink: 0;
    margin: 0 2px;
  `;

  button.onmouseenter = () => {
    button.style.opacity = "1";
    button.style.backgroundColor = "rgba(29, 28, 29, 0.04)";
  };
  button.onmouseleave = () => {
    button.style.opacity = "0.7";
    button.style.backgroundColor = "transparent";
  };

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
 * Checks if Marvin button already exists in container
 */
function marvinButtonExists(container) {
  return container.querySelector(".marvinButton") !== null;
}

/**
 * Adds Marvin button to a message element
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

  const button = createMarvinButton(metadata);

  // Strategy 1: Add to message actions toolbar (most reliable)
  const actionsContainer = messageElement.querySelector(SELECTORS.messageActions);
  if (actionsContainer) {
    const actionsGroup = actionsContainer.querySelector(SELECTORS.messageActionsGroup);
    if (actionsGroup) {
      actionsGroup.appendChild(button);
      return;
    }
    actionsContainer.appendChild(button);
    return;
  }

  // Strategy 2: Add to hover menu
  const hoverMenu = messageElement.querySelector(SELECTORS.hoverMenu);
  if (hoverMenu) {
    hoverMenu.appendChild(button);
    return;
  }

  // Strategy 3: Create a hover container on the message itself
  const messageKit =
    messageElement.querySelector(SELECTORS.messageKit) || messageElement;

  // Check if we already added a container
  if (messageKit.querySelector(".marvin-button-container")) return;

  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("marvin-button-container");
  buttonContainer.style.cssText = `
    position: absolute;
    right: 8px;
    top: 4px;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 100;
    background: white;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  `;
  buttonContainer.appendChild(button);

  // Make message position relative if not already
  const computedStyle = window.getComputedStyle(messageKit);
  if (computedStyle.position === "static") {
    messageKit.style.position = "relative";
  }

  messageKit.appendChild(buttonContainer);

  // Show on hover
  const showButton = () => {
    buttonContainer.style.opacity = "1";
  };
  const hideButton = () => {
    buttonContainer.style.opacity = "0";
  };

  messageKit.addEventListener("mouseenter", showButton);
  messageKit.addEventListener("mouseleave", hideButton);
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
