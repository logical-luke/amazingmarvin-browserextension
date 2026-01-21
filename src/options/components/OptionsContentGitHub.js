import { useEffect, useState } from "react";

import {
  getStoredGitHubSettings,
  setStoredGitHubSettings,
} from "../../utils/storage";

const OptionsContentGitHub = () => {
  const [enabled, setEnabled] = useState(true);
  const [scheduleForToday, setScheduleForToday] = useState(true);
  const [displayInPRView, setDisplayInPRView] = useState(true);
  const [displayInPRList, setDisplayInPRList] = useState(true);
  const [useSmartTitles, setUseSmartTitles] = useState(true);
  const [displayInComments, setDisplayInComments] = useState(true);
  const [displayInReviewComments, setDisplayInReviewComments] = useState(true);
  const [displayInNotifications, setDisplayInNotifications] = useState(true);

  useEffect(() => {
    getStoredGitHubSettings().then((settings) => {
      if (settings) {
        setEnabled(settings.enabled ?? true);
        setScheduleForToday(settings.scheduleForToday ?? true);
        setDisplayInPRView(settings.displayInPRView ?? true);
        setDisplayInPRList(settings.displayInPRList ?? true);
        setUseSmartTitles(settings.useSmartTitles ?? true);
        setDisplayInComments(settings.displayInComments ?? true);
        setDisplayInReviewComments(settings.displayInReviewComments ?? true);
        setDisplayInNotifications(settings.displayInNotifications ?? true);
      }
    });
  }, []);

  const saveSettings = (newSettings) => {
    setStoredGitHubSettings(newSettings);
  };

  const getAllSettings = () => ({
    enabled,
    scheduleForToday,
    displayInPRView,
    displayInPRList,
    useSmartTitles,
    displayInComments,
    displayInReviewComments,
    displayInNotifications,
  });

  const handleEnabledChange = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    saveSettings({ ...getAllSettings(), enabled: newValue });
  };

  const handleScheduleForTodayChange = () => {
    const newValue = !scheduleForToday;
    setScheduleForToday(newValue);
    saveSettings({ ...getAllSettings(), scheduleForToday: newValue });
  };

  const handleDisplayInPRViewChange = () => {
    const newValue = !displayInPRView;
    setDisplayInPRView(newValue);
    saveSettings({ ...getAllSettings(), displayInPRView: newValue });
  };

  const handleDisplayInPRListChange = () => {
    const newValue = !displayInPRList;
    setDisplayInPRList(newValue);
    saveSettings({ ...getAllSettings(), displayInPRList: newValue });
  };

  const handleUseSmartTitlesChange = () => {
    const newValue = !useSmartTitles;
    setUseSmartTitles(newValue);
    saveSettings({ ...getAllSettings(), useSmartTitles: newValue });
  };

  const handleDisplayInCommentsChange = () => {
    const newValue = !displayInComments;
    setDisplayInComments(newValue);
    saveSettings({ ...getAllSettings(), displayInComments: newValue });
  };

  const handleDisplayInReviewCommentsChange = () => {
    const newValue = !displayInReviewComments;
    setDisplayInReviewComments(newValue);
    saveSettings({ ...getAllSettings(), displayInReviewComments: newValue });
  };

  const handleDisplayInNotificationsChange = () => {
    const newValue = !displayInNotifications;
    setDisplayInNotifications(newValue);
    saveSettings({ ...getAllSettings(), displayInNotifications: newValue });
  };

  return (
    <>
      <div className="rounded-lg bg-white shadow-lg text-sm">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Enable GitHub Integration</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              When enabled, "Add to Marvin" buttons will appear on GitHub pull
              request pages allowing you to quickly create tasks from PRs.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={enabled}
                onChange={handleEnabledChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Automatically schedule for Today</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              When this setting is enabled, GitHub PRs sent to Marvin as tasks
              will automatically get scheduled for today.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={scheduleForToday}
                onChange={handleScheduleForTodayChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Display in PR Detail View</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button when viewing individual pull
              requests. The button appears in the PR header area next to other
              actions.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={displayInPRView}
                onChange={handleDisplayInPRViewChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Display in PR List View</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button in pull request list views
              (github.com/pulls and repository PR lists). The button appears
              next to each PR title.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={displayInPRList}
                onChange={handleDisplayInPRListChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Use Smart Titles</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Generate context-aware task titles based on PR state. For example:
              "Review PR #123" for PRs needing review, "Fix pipeline for PR
              #123" for your PRs with failing checks, or "Merge PR #123" for
              approved PRs.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={useSmartTitles}
                onChange={handleUseSmartTitlesChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Display in Comments</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button on PR and issue discussion
              comments. Creates tasks like "Reply to @author on PR #123".
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={displayInComments}
                onChange={handleDisplayInCommentsChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Display in Review Comments</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button on inline code review comments
              in PR diff views. Creates tasks like "Address review comment on PR #123"
              or "Apply suggestion on PR #123" for comments with code suggestions.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={displayInReviewComments}
                onChange={handleDisplayInReviewCommentsChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8 mb-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Display in Notifications</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button on each notification row at
              github.com/notifications. Creates context-aware tasks based on
              notification type (review requests, mentions, assignments, etc.).
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={displayInNotifications}
                onChange={handleDisplayInNotificationsChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>
    </>
  );
};

export default OptionsContentGitHub;
