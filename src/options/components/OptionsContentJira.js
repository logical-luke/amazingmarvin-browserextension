import { useEffect, useState } from "react";

import {
  getStoredJiraSettings,
  setStoredJiraSettings,
} from "../../utils/storage";

const OptionsContentJira = () => {
  const [scheduleForToday, setScheduleForToday] = useState(true);
  const [displayInIssueView, setDisplayInIssueView] = useState(true);
  const [displayInBoardView, setDisplayInBoardView] = useState(true);
  const [displayInListView, setDisplayInListView] = useState(true);

  useEffect(() => {
    getStoredJiraSettings().then((settings) => {
      if (settings) {
        setScheduleForToday(settings.scheduleForToday ?? true);
        setDisplayInIssueView(settings.displayInIssueView ?? true);
        setDisplayInBoardView(settings.displayInBoardView ?? true);
        setDisplayInListView(settings.displayInListView ?? true);
      }
    });
  }, []);

  const saveSettings = (newSettings) => {
    setStoredJiraSettings(newSettings);
  };

  const handleScheduleForTodayChange = () => {
    const newValue = !scheduleForToday;
    setScheduleForToday(newValue);
    saveSettings({
      scheduleForToday: newValue,
      displayInIssueView,
      displayInBoardView,
      displayInListView,
    });
  };

  const handleDisplayInIssueViewChange = () => {
    const newValue = !displayInIssueView;
    setDisplayInIssueView(newValue);
    saveSettings({
      scheduleForToday,
      displayInIssueView: newValue,
      displayInBoardView,
      displayInListView,
    });
  };

  const handleDisplayInBoardViewChange = () => {
    const newValue = !displayInBoardView;
    setDisplayInBoardView(newValue);
    saveSettings({
      scheduleForToday,
      displayInIssueView,
      displayInBoardView: newValue,
      displayInListView,
    });
  };

  const handleDisplayInListViewChange = () => {
    const newValue = !displayInListView;
    setDisplayInListView(newValue);
    saveSettings({
      scheduleForToday,
      displayInIssueView,
      displayInBoardView,
      displayInListView: newValue,
    });
  };

  return (
    <>
      <div className="rounded-lg bg-white shadow-lg text-sm">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Automatically schedule for Today</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              When this setting is enabled, Jira issues sent to Marvin as tasks
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
          <h3 className="font-bold mb-3">Display Marvin button in Issue View</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button when viewing individual Jira issues
              and epics. The button appears in the issue toolbar area.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={displayInIssueView}
                onChange={handleDisplayInIssueViewChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Display Marvin button on Board Cards</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button when hovering over cards on Jira
              boards (Kanban/Scrum boards). The button appears in the top-right
              corner of the card.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={displayInBoardView}
                onChange={handleDisplayInBoardViewChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8 mb-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Display Marvin button in Backlog/List View</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button in the backlog and list views.
              The button appears in the row actions area.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={displayInListView}
                onChange={handleDisplayInListViewChange}
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

export default OptionsContentJira;
