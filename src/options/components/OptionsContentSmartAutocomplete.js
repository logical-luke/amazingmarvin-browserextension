import { useEffect, useState } from "react";

import {
  getStoredSmartAutocompleteSettings,
  setStoredSmartAutocompleteSettings,
} from "../../utils/storage";

const OptionsContentSmartAutocomplete = () => {
  const [enabled, setEnabled] = useState(true);
  const [showSuggestedTitle, setShowSuggestedTitle] = useState(true);
  const [autoFillTitle, setAutoFillTitle] = useState(false);
  const [showTimeEstimate, setShowTimeEstimate] = useState(true);
  const [autoApplyTimeEstimate, setAutoApplyTimeEstimate] = useState(false);
  const [showLabelSuggestions, setShowLabelSuggestions] = useState(true);
  const [showPrioritySuggestions, setShowPrioritySuggestions] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [rememberChoices, setRememberChoices] = useState(true);

  useEffect(() => {
    getStoredSmartAutocompleteSettings().then((settings) => {
      if (settings) {
        setEnabled(settings.enabled ?? true);
        setShowSuggestedTitle(settings.showSuggestedTitle ?? true);
        setAutoFillTitle(settings.autoFillTitle ?? false);
        setShowTimeEstimate(settings.showTimeEstimate ?? true);
        setAutoApplyTimeEstimate(settings.autoApplyTimeEstimate ?? false);
        setShowLabelSuggestions(settings.showLabelSuggestions ?? true);
        setShowPrioritySuggestions(settings.showPrioritySuggestions ?? true);
        setShowQuickActions(settings.showQuickActions ?? true);
        setRememberChoices(settings.rememberChoices ?? true);
      }
    });
  }, []);

  const saveSettings = (newSettings) => {
    setStoredSmartAutocompleteSettings(newSettings);
  };

  const getAllSettings = () => ({
    enabled,
    showSuggestedTitle,
    autoFillTitle,
    showTimeEstimate,
    autoApplyTimeEstimate,
    showLabelSuggestions,
    showPrioritySuggestions,
    showQuickActions,
    rememberChoices,
    customEstimates: {},
    userPreferences: {},
  });

  const handleEnabledChange = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    saveSettings({ ...getAllSettings(), enabled: newValue });
  };

  const handleShowSuggestedTitleChange = () => {
    const newValue = !showSuggestedTitle;
    setShowSuggestedTitle(newValue);
    saveSettings({ ...getAllSettings(), showSuggestedTitle: newValue });
  };

  const handleAutoFillTitleChange = () => {
    const newValue = !autoFillTitle;
    setAutoFillTitle(newValue);
    saveSettings({ ...getAllSettings(), autoFillTitle: newValue });
  };

  const handleShowTimeEstimateChange = () => {
    const newValue = !showTimeEstimate;
    setShowTimeEstimate(newValue);
    saveSettings({ ...getAllSettings(), showTimeEstimate: newValue });
  };

  const handleAutoApplyTimeEstimateChange = () => {
    const newValue = !autoApplyTimeEstimate;
    setAutoApplyTimeEstimate(newValue);
    saveSettings({ ...getAllSettings(), autoApplyTimeEstimate: newValue });
  };

  const handleShowLabelSuggestionsChange = () => {
    const newValue = !showLabelSuggestions;
    setShowLabelSuggestions(newValue);
    saveSettings({ ...getAllSettings(), showLabelSuggestions: newValue });
  };

  const handleShowPrioritySuggestionsChange = () => {
    const newValue = !showPrioritySuggestions;
    setShowPrioritySuggestions(newValue);
    saveSettings({ ...getAllSettings(), showPrioritySuggestions: newValue });
  };

  const handleShowQuickActionsChange = () => {
    const newValue = !showQuickActions;
    setShowQuickActions(newValue);
    saveSettings({ ...getAllSettings(), showQuickActions: newValue });
  };

  const handleRememberChoicesChange = () => {
    const newValue = !rememberChoices;
    setRememberChoices(newValue);
    saveSettings({ ...getAllSettings(), rememberChoices: newValue });
  };

  return (
    <>
      <div className="rounded-lg bg-white shadow-lg text-sm">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Enable Smart Autocomplete</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              When enabled, the extension will detect context from platform
              integrations (GitHub, Jira, Slack, Gmail) and provide smart
              suggestions for task titles, time estimates, and labels based on
              the source content.
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
          <h3 className="font-bold mb-3">Title Suggestions</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Show suggested task titles based on the source context (e.g.,
              "Review PR #123: Title" for GitHub PRs needing review, "PROJ-123:
              Issue Title" for Jira issues).
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={showSuggestedTitle}
                onChange={handleShowSuggestedTitleChange}
                disabled={!enabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB] peer-disabled:opacity-50"></div>
            </label>
          </div>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3 pl-4 border-l-2 border-gray-200">
            <p className="text-gray-600">
              Automatically fill in the suggested title (instead of showing it
              as a placeholder). You can still edit it before creating the task.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={autoFillTitle}
                onChange={handleAutoFillTitleChange}
                disabled={!enabled || !showSuggestedTitle}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB] peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Time Estimate Suggestions</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Suggest time estimates based on the task type (e.g., 30 min for PR
              reviews, 5 min for merging, 1 hour for fixing CI pipelines).
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={showTimeEstimate}
                onChange={handleShowTimeEstimateChange}
                disabled={!enabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB] peer-disabled:opacity-50"></div>
            </label>
          </div>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3 pl-4 border-l-2 border-gray-200">
            <p className="text-gray-600">
              Automatically apply the suggested time estimate. You can still
              change it before creating the task.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={autoApplyTimeEstimate}
                onChange={handleAutoApplyTimeEstimateChange}
                disabled={!enabled || !showTimeEstimate}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB] peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Label Suggestions</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Suggest labels based on context keywords. For example, if a GitHub
              PR has failing CI, suggest your "bug" or "urgent" labels if you
              have them.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={showLabelSuggestions}
                onChange={handleShowLabelSuggestionsChange}
                disabled={!enabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB] peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-lg text-sm mt-8 mb-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Remember Preferences</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Remember your choices for each platform/action type. For example,
              if you always change the suggested time estimate for PR reviews,
              we'll learn your preference.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={rememberChoices}
                onChange={handleRememberChoicesChange}
                disabled={!enabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB] peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </div>
    </>
  );
};

export default OptionsContentSmartAutocomplete;
