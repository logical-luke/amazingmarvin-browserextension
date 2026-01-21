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

  useEffect(() => {
    getStoredGitHubSettings().then((settings) => {
      if (settings) {
        setEnabled(settings.enabled ?? true);
        setScheduleForToday(settings.scheduleForToday ?? true);
        setDisplayInPRView(settings.displayInPRView ?? true);
        setDisplayInPRList(settings.displayInPRList ?? true);
        setUseSmartTitles(settings.useSmartTitles ?? true);
      }
    });
  }, []);

  const saveSettings = (newSettings) => {
    setStoredGitHubSettings(newSettings);
  };

  const handleEnabledChange = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    saveSettings({
      enabled: newValue,
      scheduleForToday,
      displayInPRView,
      displayInPRList,
      useSmartTitles,
    });
  };

  const handleScheduleForTodayChange = () => {
    const newValue = !scheduleForToday;
    setScheduleForToday(newValue);
    saveSettings({
      enabled,
      scheduleForToday: newValue,
      displayInPRView,
      displayInPRList,
      useSmartTitles,
    });
  };

  const handleDisplayInPRViewChange = () => {
    const newValue = !displayInPRView;
    setDisplayInPRView(newValue);
    saveSettings({
      enabled,
      scheduleForToday,
      displayInPRView: newValue,
      displayInPRList,
      useSmartTitles,
    });
  };

  const handleDisplayInPRListChange = () => {
    const newValue = !displayInPRList;
    setDisplayInPRList(newValue);
    saveSettings({
      enabled,
      scheduleForToday,
      displayInPRView,
      displayInPRList: newValue,
      useSmartTitles,
    });
  };

  const handleUseSmartTitlesChange = () => {
    const newValue = !useSmartTitles;
    setUseSmartTitles(newValue);
    saveSettings({
      enabled,
      scheduleForToday,
      displayInPRView,
      displayInPRList,
      useSmartTitles: newValue,
    });
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

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8 mb-8">
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
    </>
  );
};

export default OptionsContentGitHub;
