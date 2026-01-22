import { addTask, getTasks } from "../utils/api";
import {
  getStoredToken,
  getStoredLabels,
  setStoredLabels,
  setStoredCategories,
  getStoredCategories,
  setStoredGmailSettings,
  setStoredBadgeSettings,
  getStoredGmailSettings,
  getStoredGeneralSettings,
  setStoredGeneralSettings,
  getStoredBadgeSettings,
  setStoredSmartAutocompleteSettings,
  getStoredSmartAutocompleteSettings,
  setStoredTaskContext,
  clearStoredTaskContext,
} from "../utils/storage";
import {
  createTaskContext,
  detectPlatform,
} from "../utils/taskContext";
import { getLabels, getCategories } from "../utils/api";
import { formatDate } from "../utils/dates";
import { clearBadge, setBadge } from "../utils/badge";

console.log("background.js running");

// Create context menus - called on service worker startup
function setupContextMenus() {
  chrome.contextMenus.removeAll().then(() => {
    chrome.contextMenus.create({
      id: "addTask",
      title: "Add task to Marvin",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "addTaskToday",
      title: "Add task for today",
      contexts: ["selection"],
      parentId: "addTask",
    });
    chrome.contextMenus.create({
      id: "addTaskUnscheduled",
      title: "Add unscheduled task",
      contexts: ["selection"],
      parentId: "addTask",
    });
  });
}

// Setup context menus on service worker startup
setupContextMenus();

const addTaskAndSetMessage = (data) => {
  addTask(data).then((message) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message,
      });
    });
  });
};

const getTabTitleAsHyperlink = () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      let tab = tabs[0];
      resolve(`[${tab.title}](${tab.url})`);
    });
  });
};

chrome.runtime.onInstalled.addListener(() => {
  getStoredLabels().then((labels) => {
    if (!labels) {
      setStoredLabels([]);
    }
  });
  getStoredCategories().then((categories) => {
    if (!categories) {
      setStoredCategories([]);
    }
  });
  getStoredGmailSettings().then((gmailSettings) => {
    if (!gmailSettings) {
      setStoredGmailSettings({
        scheduleForToday: false,
        displayInInbox: true,
        displayInSingleEmail: true,
      });
    }
  });
  getStoredGeneralSettings().then((generalSettings) => {
    if (!generalSettings) {
      setStoredGeneralSettings({
        autoPopulateTaskTitle: false,
        autoPopulateTaskNote: false,
        groupByMethod: "none",
        displayTaskNoteInput: true,
        displayScheduleDatePicker: true,
        displayDueDatePicker: true,
        displayTimeEstimateButtons: true,
        displaySetParentPicker: true,
        displaySetLabelsPicker: true,
      });
    }
  });
  getStoredBadgeSettings().then((badgeSettings) => {
    if (!badgeSettings) {
      setStoredBadgeSettings({
        displayBadge: true,
        backgroundColor: "#1CC5CB",
      });
    }
  });
  getStoredSmartAutocompleteSettings().then((settings) => {
    if (!settings || Object.keys(settings).length === 0) {
      setStoredSmartAutocompleteSettings({
        enabled: true,
        showSuggestedTitle: true,
        autoFillTitle: false,
        showTimeEstimate: true,
        autoApplyTimeEstimate: false,
        showLabelSuggestions: true,
        showPrioritySuggestions: true,
        showQuickActions: true,
        rememberChoices: true,
        customEstimates: {},
        userPreferences: {},
      });
    }
  });

  chrome.alarms.create({
    periodInMinutes: 60,
  });

  chrome.alarms.create("updateBadge", { periodInMinutes: 10 });
});

chrome.contextMenus.onClicked.addListener((event) => {
  console.log("adding a task from context menu");
  getTabTitleAsHyperlink().then((title) => {
    if (event.menuItemId === "addTaskToday") {
      let data = {
        done: false,
        day: formatDate(new Date()),
        title: title,
        note: `${event.selectionText}`,
      };

      console.log("scheduled", data);
      addTaskAndSetMessage(data);
    }

    if (event.menuItemId === "addTaskUnscheduled") {
      let data = {
        done: false,
        title: title,
        note: `${event.selectionText}`,
      };

      console.log("unscheduled", data);
      addTaskAndSetMessage(data);
    }
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const token = await getStoredToken();
  if (!token) {
    return;
  }

  if (alarm.name === "updateBadge") {
    const badgeSettings = await getStoredBadgeSettings();

    if (!badgeSettings?.displayBadge) {
      return;
    }

    const { ok, status, tasks } = await getTasks(token, new Date());
    if (ok) {
      setBadge(tasks.length);
    } else {
      clearBadge();
    }

    return;
  }

  await getLabels();
  setTimeout(() => {
    getCategories();
  }, 1000);
});

chrome.runtime.onMessage.addListener(async function (
  request,
  sender,
  sendResponse
) {
  let token = await getStoredToken();
  let data = {
    done: false,
  };

  let scheduleForToday = await getStoredGmailSettings().then(
    (gmailSettings) => gmailSettings.scheduleForToday
  );

  if (scheduleForToday) data.day = formatDate(new Date());

  const getTabUrl = () => {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        let url = tabs[0].url;
        resolve(url);
      });
    });
  };

  if (request.message === "sendTaskFromTable") {
    getTabUrl().then((url) => {
      let emailUrl = url.split("#")[0] + "#inbox/" + request.emailLink;
      data.title = `[${request.emailSubject}](${emailUrl})`;
      addTask(data).then((message) => {
        if (message === "success") {
          Promise.resolve();
        }
      });
    });
  }

  if (request.message === "sendTaskFromSingleView") {
    getTabUrl().then((url) => {
      data.title = `[${request.emailSubject}](${url})`;
      addTask(data).then((message) => {
        if (message === "success") {
          Promise.resolve();
        }
      });
    });
  }

  if (request.message === "toggleBadge") {
    const badgeSettings = await getStoredBadgeSettings();

    if (!badgeSettings?.displayBadge || !token) {
      clearBadge();
      return;
    }

    const { ok, status, tasks } = await getTasks(token, new Date());
    if (ok) {
      setBadge(tasks.length);
    } else {
      clearBadge();
    }
  }

  // Smart context detection messages
  if (request.message === "setTaskContext") {
    // Content script is sending context metadata for the popup
    const settings = await getStoredSmartAutocompleteSettings();
    if (settings.enabled) {
      const context = createTaskContext(
        request.sourceUrl,
        request.metadata,
        settings
      );
      await setStoredTaskContext(context);
      sendResponse({ success: true, context });
    } else {
      sendResponse({ success: false, reason: "disabled" });
    }
    return true; // Keep message channel open for async response
  }

  if (request.message === "clearTaskContext") {
    await clearStoredTaskContext();
    sendResponse({ success: true });
    return true;
  }

  if (request.message === "getTaskContext") {
    // Popup is requesting the current context
    const settings = await getStoredSmartAutocompleteSettings();
    if (!settings.enabled) {
      sendResponse({ success: false, context: null, reason: "disabled" });
      return true;
    }

    // If no context is stored, try to detect from current tab
    chrome.storage.local.get(["currentTaskContext"], async (result) => {
      if (result.currentTaskContext) {
        sendResponse({ success: true, context: result.currentTaskContext });
      } else {
        // Try to get context from the active tab's content script
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (tabs[0]) {
            const tabUrl = tabs[0].url;
            const platform = detectPlatform(tabUrl);

            if (platform) {
              // Try to get rich context from content script first
              try {
                chrome.tabs.sendMessage(
                  tabs[0].id,
                  { message: "getPageContext" },
                  async (response) => {
                    if (chrome.runtime.lastError || !response?.context) {
                      // Fallback to basic context from URL
                      const context = createTaskContext(tabUrl, {
                        title: tabs[0].title,
                        url: tabUrl,
                      }, settings);
                      sendResponse({ success: true, context });
                    } else {
                      // Create context from content script response
                      const context = createTaskContext(
                        tabUrl,
                        response.context,
                        settings
                      );
                      sendResponse({ success: true, context });
                    }
                  }
                );
              } catch (err) {
                // Fallback to basic context
                const context = createTaskContext(tabUrl, {
                  title: tabs[0].title,
                  url: tabUrl,
                }, settings);
                sendResponse({ success: true, context });
              }
            } else {
              sendResponse({ success: false, context: null });
            }
          } else {
            sendResponse({ success: false, context: null });
          }
        });
      }
    });
    return true; // Keep message channel open for async response
  }

  if (request.message === "updateSmartAutocompletePreference") {
    // User made a choice, remember it if enabled
    const settings = await getStoredSmartAutocompleteSettings();
    if (settings.rememberChoices) {
      const { platform, action, preference } = request;
      if (!settings.userPreferences) {
        settings.userPreferences = {};
      }
      if (!settings.userPreferences[platform]) {
        settings.userPreferences[platform] = {};
      }
      settings.userPreferences[platform][action] = preference;
      await setStoredSmartAutocompleteSettings(settings);
    }
    sendResponse({ success: true });
    return true;
  }
});
