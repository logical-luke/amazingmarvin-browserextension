import { useEffect, useState } from "react";
import { BsEye, BsEyeSlash, BsCheckCircle, BsXCircle } from "react-icons/bs";

import {
  getStoredAISuggestionsSettings,
  setStoredAISuggestionsSettings,
} from "../../utils/storage";
import { AI_PROVIDERS, verifyApiKey } from "../../utils/ai";

const OptionsContentAI = () => {
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('claude-3-haiku-20240307');
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
        setProvider(settings.provider ?? 'anthropic');
        setModel(settings.model ?? AI_PROVIDERS[settings.provider || 'anthropic']?.defaultModel);
        setApiKey(settings.apiKey ?? '');
        setShowTokenUsage(settings.showTokenUsage ?? false);
        setCacheEnabled(settings.cacheEnabled ?? true);
      }
    });
  }, []);

  const getAllSettings = () => ({
    enabled,
    provider,
    model,
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

    const isValid = await verifyApiKey(provider, apiKey);
    setVerificationStatus(isValid ? 'valid' : 'invalid');
    setVerifying(false);
  };

  const handleSaveApiKey = () => {
    saveSettings({ ...getAllSettings(), apiKey });
  };

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    // Reset to default model for the new provider
    const defaultModel = AI_PROVIDERS[newProvider]?.defaultModel;
    setModel(defaultModel);
    // Clear verification status when provider changes
    setVerificationStatus(null);
    saveSettings({ ...getAllSettings(), provider: newProvider, model: defaultModel });
  };

  const handleModelChange = (newModel) => {
    setModel(newModel);
    saveSettings({ ...getAllSettings(), model: newModel });
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

  const currentProvider = AI_PROVIDERS[provider];

  return (
    <>
      {/* Enable AI Suggestions */}
      <div className="rounded-lg bg-white shadow-lg text-sm">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Enable AI Suggestions</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <p>
              Use AI to generate intelligent task suggestions based on the source
              content. This provides smarter titles, time estimates, and label
              suggestions than the template-based autocomplete.
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
              Add your API key below to enable AI suggestions.
            </p>
          )}
        </div>
      </div>

      {/* Provider Selection */}
      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">AI Provider</h3>
          <p className="mb-4 text-gray-600">
            Choose your preferred AI provider. Each provider has different models
            with varying capabilities and pricing.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(AI_PROVIDERS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => handleProviderChange(key)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  provider === key
                    ? 'border-[#1CC5CB] bg-[#1CC5CB]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{config.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {config.models.length} models
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Model</h3>
          <p className="mb-4 text-gray-600">
            Select a model from {currentProvider?.name}. Faster models are more
            affordable but may produce slightly less accurate suggestions.
          </p>
          <div className="space-y-2">
            {currentProvider?.models.map((m) => (
              <button
                key={m.id}
                onClick={() => handleModelChange(m.id)}
                className={`w-full p-3 rounded-lg border-2 transition-all text-left flex justify-between items-center ${
                  model === m.id
                    ? 'border-[#1CC5CB] bg-[#1CC5CB]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.description}</div>
                </div>
                {model === m.id && (
                  <BsCheckCircle className="text-[#1CC5CB]" size={20} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="rounded-lg bg-white shadow-lg text-sm mt-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">{currentProvider?.name} API Key</h3>
          <p className="mb-4 text-gray-600">
            Enter your {currentProvider?.name} API key.
            Get your API key from{" "}
            <a
              href={currentProvider?.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1CC5CB] hover:underline"
            >
              {currentProvider?.docsUrl.replace('https://', '').split('/')[0]}
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
                placeholder={currentProvider?.keyPlaceholder}
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

      {/* Cost Information */}
      <div className="rounded-lg bg-white shadow-lg text-sm mt-8 mb-8">
        <div className="px-6 py-8">
          <h3 className="font-bold mb-3">Cost Information</h3>
          <div className="flex flex-row items-center justify-between w-full mt-3 mb-3">
            <div>
              <p>
                Show token usage information when AI generates suggestions.
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Costs vary by provider and model. A typical suggestion uses ~500 input
                and ~100 output tokens. Enable caching to reduce costs.
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
