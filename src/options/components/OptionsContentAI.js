import { useEffect, useState } from "react";
import { BsEye, BsEyeSlash, BsCheckCircle, BsXCircle } from "react-icons/bs";

import {
  getStoredAISuggestionsSettings,
  setStoredAISuggestionsSettings,
} from "../../utils/storage";
import { verifyAnthropicApiKey } from "../../utils/ai";

const OptionsContentAI = () => {
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTokenUsage, setShowTokenUsage] = useState(false);
  const [cacheEnabled, setCacheEnabled] = useState(true);

  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    getStoredAISuggestionsSettings().then((settings) => {
      if (settings) {
        setEnabled(settings.enabled ?? false);
        setApiKey(settings.apiKey ?? '');
        setShowTokenUsage(settings.showTokenUsage ?? false);
        setCacheEnabled(settings.cacheEnabled ?? true);
      }
    });
  }, []);

  const getAllSettings = () => ({
    enabled,
    apiKey,
    showTokenUsage,
    cacheEnabled,
    cacheTTL: 3600000,
  });

  const saveSettings = (newSettings) => {
    setStoredAISuggestionsSettings(newSettings);
    setSaveMessage('Settings saved!');
    setTimeout(() => setSaveMessage(''), 2000);
  };

  const handleVerifyApiKey = async () => {
    if (!apiKey) return;

    setVerifying(true);
    setVerificationStatus(null);

    const isValid = await verifyAnthropicApiKey(apiKey);
    setVerificationStatus(isValid ? 'valid' : 'invalid');
    setVerifying(false);
  };

  const handleSaveApiKey = () => {
    saveSettings({ ...getAllSettings(), apiKey });
  };

  const handleEnabledChange = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    saveSettings({ ...getAllSettings(), enabled: newValue });
  };

  const handleShowTokenUsageChange = () => {
    const newValue = !showTokenUsage;
    setShowTokenUsage(newValue);
    saveSettings({ ...getAllSettings(), showTokenUsage: newValue });
  };

  const handleCacheEnabledChange = () => {
    const newValue = !cacheEnabled;
    setCacheEnabled(newValue);
    saveSettings({ ...getAllSettings(), cacheEnabled: newValue });
  };

  return (
    <>
      {/* Enable AI Suggestions */}
      <div className="rounded-lg bg-white shadow-lg text-sm">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Enable AI Suggestions</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Use Claude AI (Haiku model) to generate intelligent task suggestions
              based on the source content. This provides smarter titles, time estimates,
              and label suggestions than the template-based autocomplete.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={enabled}
                onChange={handleEnabledChange}
                disabled={!apiKey}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB] peer-disabled:opacity-50"></div>
            </label>
          </div>
          {!apiKey && (
            <p className="text-sm text-amber-600">
              Add your Anthropic API key below to enable AI suggestions.
            </p>
          )}
        </div>
      </div>

      {/* API Key */}
      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Anthropic API Key</h3>
          <p className="mb-4 text-gray-600">
            Enter your Anthropic API key to enable AI-powered suggestions.
            Get your API key from{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1CC5CB] hover:underline"
            >
              console.anthropic.com
            </a>
            . Your key is stored locally and never shared.
          </p>
          <div className="flex flex-row gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setVerificationStatus(null);
                }}
                placeholder="sk-ant-api..."
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1CC5CB]"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showApiKey ? <BsEyeSlash size={18} /> : <BsEye size={18} />}
              </button>
            </div>
            <button
              onClick={handleVerifyApiKey}
              disabled={!apiKey || verifying}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify"}
            </button>
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKey}
              className="px-4 py-2 bg-[#1CC5CB] text-white hover:bg-[#18b0b5] rounded-lg disabled:opacity-50"
            >
              Save
            </button>
          </div>
          {verificationStatus && (
            <div className={`mt-2 flex items-center gap-2 ${verificationStatus === 'valid' ? 'text-green-600' : 'text-red-600'}`}>
              {verificationStatus === 'valid' ? (
                <><BsCheckCircle /> API key is valid</>
              ) : (
                <><BsXCircle /> API key is invalid</>
              )}
            </div>
          )}
          {saveMessage && (
            <div className="mt-2 text-green-600">{saveMessage}</div>
          )}
        </div>
      </div>

      {/* Response Caching */}
      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Response Caching</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Cache AI responses to reduce API calls and costs. Cached suggestions
              are reused when you create tasks from the same source within an hour.
            </p>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={cacheEnabled}
                onChange={handleCacheEnabledChange}
                disabled={!enabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-offset-2 peer-focus:ring-[#1CC5CB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1CC5CB] peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Token Usage Display */}
      <div className="rounded-lg bg-white shadow-lg text-sm mt-8 mb-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Cost Information</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <div>
              <p>
                Show token usage information when AI generates suggestions.
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Claude Haiku costs approximately $0.00025 per 1K input tokens and
                $0.00125 per 1K output tokens. A typical suggestion uses ~500 input
                and ~100 output tokens (~$0.0003 per suggestion).
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={showTokenUsage}
                onChange={handleShowTokenUsageChange}
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

export default OptionsContentAI;
