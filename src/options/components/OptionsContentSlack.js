import { useEffect, useState } from "react";

import {
  getStoredSlackSettings,
  setStoredSlackSettings,
} from "../../utils/storage";

const OptionsContentSlack = () => {
  const [enabled, setEnabled] = useState(true);
  const [scheduleForToday, setScheduleForToday] = useState(true);
  const [showInChannels, setShowInChannels] = useState(true);
  const [showInDMs, setShowInDMs] = useState(true);
  const [showInThreads, setShowInThreads] = useState(true);

  useEffect(() => {
    getStoredSlackSettings().then((settings) => {
      if (settings) {
        setEnabled(settings.enabled ?? true);
        setScheduleForToday(settings.scheduleForToday ?? true);
        setShowInChannels(settings.showInChannels ?? true);
        setShowInDMs(settings.showInDMs ?? true);
        setShowInThreads(settings.showInThreads ?? true);
      }
    });
  }, []);

  const saveSettings = (newSettings) => {
    setStoredSlackSettings(newSettings);
  };

  const handleEnabledChange = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    saveSettings({
      enabled: newValue,
      scheduleForToday,
      showInChannels,
      showInDMs,
      showInThreads,
    });
  };

  const handleScheduleForTodayChange = () => {
    const newValue = !scheduleForToday;
    setScheduleForToday(newValue);
    saveSettings({
      enabled,
      scheduleForToday: newValue,
      showInChannels,
      showInDMs,
      showInThreads,
    });
  };

  const handleShowInChannelsChange = () => {
    const newValue = !showInChannels;
    setShowInChannels(newValue);
    saveSettings({
      enabled,
      scheduleForToday,
      showInChannels: newValue,
      showInDMs,
      showInThreads,
    });
  };

  const handleShowInDMsChange = () => {
    const newValue = !showInDMs;
    setShowInDMs(newValue);
    saveSettings({
      enabled,
      scheduleForToday,
      showInChannels,
      showInDMs: newValue,
      showInThreads,
    });
  };

  const handleShowInThreadsChange = () => {
    const newValue = !showInThreads;
    setShowInThreads(newValue);
    saveSettings({
      enabled,
      scheduleForToday,
      showInChannels,
      showInDMs,
      showInThreads: newValue,
    });
  };

  return (
    <>
      <div className="rounded-lg bg-white shadow-lg text-sm">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Enable Slack Integration</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              When enabled, "Add to Marvin" buttons will appear on Slack messages
              allowing you to quickly create tasks from messages.
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
              When this setting is enabled, Slack messages sent to Marvin as tasks
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
          <h3 className="font-bold mb-3">Show in Channels</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button on messages in public and private
              channels.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={showInChannels}
                onChange={handleShowInChannelsChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Show in Direct Messages</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button on messages in direct messages (DMs)
              and group conversations.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={showInDMs}
                onChange={handleShowInDMsChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB]"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8 mb-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Show in Threads</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Display "Add to Marvin" button on messages in thread views and
              replies.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={showInThreads}
                onChange={handleShowInThreadsChange}
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

export default OptionsContentSlack;
