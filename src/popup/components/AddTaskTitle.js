import React, { useState, useEffect, useRef, useCallback } from "react";
import { BsX, BsLightbulb, BsStars } from "react-icons/bs";
import { getStoredCategories, getStoredLabels } from "../../utils/storage";
import AutocompleteDropdown from "./AutocompleteDropdown";

const AddTaskTitle = ({
  title,
  setTaskTitle,
  onAutocompleteStateChange,
  suggestedTitle,
  taskContext,
  onApplySuggestion,
  aiSuggestions,
  aiLoading,
  aiError,
  onFillWithAI,
  onClearAIError,
}) => {
  const inputRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [labels, setLabels] = useState([]);

  const [autocomplete, setAutocomplete] = useState({
    visible: false,
    triggerType: null,
    triggerStartIndex: null,
    query: "",
    selectedIndex: 0,
  });

  // Load categories and labels on mount
  useEffect(() => {
    getStoredCategories().then((cats) => setCategories(cats || []));
    getStoredLabels().then((lbls) => setLabels(lbls || []));
  }, []);

  // Notify parent of autocomplete state changes
  useEffect(() => {
    if (onAutocompleteStateChange) {
      onAutocompleteStateChange(autocomplete.visible);
    }
  }, [autocomplete.visible, onAutocompleteStateChange]);

  const select = useCallback((e) => {
    e.target.select();
  }, []);

  // Detect trigger characters in the input
  const detectTrigger = useCallback((value, cursorPosition) => {
    const beforeCursor = value.slice(0, cursorPosition);

    // Don't trigger inside markdown links: [text](url)
    const lastOpenBracket = beforeCursor.lastIndexOf("[");
    const lastCloseBracket = beforeCursor.lastIndexOf("]");
    if (lastOpenBracket > lastCloseBracket) {
      return null; // Inside link text
    }
    const lastOpenParen = beforeCursor.lastIndexOf("(");
    const lastCloseParen = beforeCursor.lastIndexOf(")");
    if (lastOpenParen > lastCloseParen && lastOpenParen > lastCloseBracket) {
      return null; // Inside link URL
    }

    // Match trigger character followed by optional word characters
    const triggerMatch = beforeCursor.match(/([#@+])(\w*)$/);
    if (triggerMatch) {
      return {
        type: triggerMatch[1],
        query: triggerMatch[2],
        startIndex: cursorPosition - triggerMatch[0].length,
      };
    }
    return null;
  }, []);

  // Get filtered suggestions based on trigger type and query
  const getSuggestions = useCallback(
    (triggerType, query) => {
      let items = [];

      if (triggerType === "#" || triggerType === "+") {
        items = categories.map((cat) => ({ ...cat, type: "category" }));
      } else if (triggerType === "@") {
        items = labels.map((label) => ({ ...label, type: "label" }));
      }

      if (!query) return items.slice(0, 10);

      const lowerQuery = query.toLowerCase();
      return items
        .filter((item) => item.title.toLowerCase().includes(lowerQuery))
        .slice(0, 10);
    },
    [categories, labels]
  );

  // Handle input changes
  const handleChange = useCallback(
    (event) => {
      const value = event.target.value;
      const cursorPosition = event.target.selectionStart;

      setTaskTitle(value);

      const trigger = detectTrigger(value, cursorPosition);

      if (trigger) {
        const suggestions = getSuggestions(trigger.type, trigger.query);
        setAutocomplete({
          visible: suggestions.length > 0,
          triggerType: trigger.type,
          triggerStartIndex: trigger.startIndex,
          query: trigger.query,
          selectedIndex: 0,
        });
      } else {
        setAutocomplete((prev) => ({ ...prev, visible: false }));
      }
    },
    [setTaskTitle, detectTrigger, getSuggestions]
  );

  // Insert the selected suggestion into the title
  const insertSuggestion = useCallback(
    (suggestion) => {
      const { triggerStartIndex, triggerType, query } = autocomplete;
      const cursorPosition = triggerStartIndex + 1 + query.length;

      const before = title.substring(0, triggerStartIndex);
      const after = title.substring(cursorPosition);

      // Format: keep the trigger character + title + space
      const insertText = triggerType + suggestion.title + " ";
      const newTitle = before + insertText + after.trimStart();
      const newCursorPosition = before.length + insertText.length;

      setTaskTitle(newTitle);
      setAutocomplete((prev) => ({ ...prev, visible: false }));

      // Restore focus and cursor position
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(
            newCursorPosition,
            newCursorPosition
          );
        }
      }, 0);
    },
    [autocomplete, title, setTaskTitle]
  );

  // Handle keyboard events for dropdown navigation
  const handleKeyDown = useCallback(
    (event) => {
      if (!autocomplete.visible) return;

      const suggestions = getSuggestions(
        autocomplete.triggerType,
        autocomplete.query
      );

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setAutocomplete((prev) => ({
            ...prev,
            selectedIndex: Math.min(prev.selectedIndex + 1, suggestions.length - 1),
          }));
          break;

        case "ArrowUp":
          event.preventDefault();
          setAutocomplete((prev) => ({
            ...prev,
            selectedIndex: Math.max(prev.selectedIndex - 1, 0),
          }));
          break;

        case "Enter":
        case "Tab":
          if (suggestions.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            insertSuggestion(suggestions[autocomplete.selectedIndex]);
          }
          break;

        case "Escape":
          event.preventDefault();
          setAutocomplete((prev) => ({ ...prev, visible: false }));
          break;

        default:
          break;
      }
    },
    [autocomplete, getSuggestions, insertSuggestion]
  );

  // Close dropdown on blur (with delay to allow click on dropdown)
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setAutocomplete((prev) => ({ ...prev, visible: false }));
    }, 150);
  }, []);

  // Get current suggestions for rendering
  const currentSuggestions = autocomplete.visible
    ? getSuggestions(autocomplete.triggerType, autocomplete.query)
    : [];

  // Check if there's a suggested title that differs from the current title
  const hasSuggestion = suggestedTitle && suggestedTitle !== title && !title;
  const showSuggestionIndicator = suggestedTitle && title !== suggestedTitle;
  const isAISuggestion = aiSuggestions?.isAISuggestion;

  // Get platform label for tooltip
  const getPlatformLabel = () => {
    if (!taskContext?.platform) return "page";
    const labels = {
      github: "GitHub",
      jira: "Jira",
      slack: "Slack",
      gmail: "Gmail",
    };
    return labels[taskContext.platform] || taskContext.platform;
  };

  // Apply the suggested title
  const applySuggestedTitle = useCallback(() => {
    if (suggestedTitle && onApplySuggestion) {
      onApplySuggestion(suggestedTitle);
    }
  }, [suggestedTitle, onApplySuggestion]);

  return (
    <div>
      <div className="flex flex-row items-center gap-0.5 flex-wrap">
        <label className="label">
          <span className="label-text text-neutral">Task title</span>
        </label>

        {/* Fill with AI Button - shown when not loading and no error */}
        {onFillWithAI && !aiLoading && !aiError && (
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-all"
            onClick={onFillWithAI}
            data-hov="Generate task details using AI"
            data-pos="T"
          >
            <BsStars size={12} />
            <span>Fill with AI</span>
          </button>
        )}

        {/* AI Loading State */}
        {aiLoading && (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs text-purple-600 bg-purple-100 rounded-full">
            <span className="animate-spin">
              <BsStars size={12} />
            </span>
            <span>Generating...</span>
          </span>
        )}

        {/* AI Error State */}
        {aiError && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full max-w-[200px] truncate" title={aiError}>
              {aiError}
            </span>
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
              onClick={() => {
                onClearAIError?.();
                onFillWithAI?.();
              }}
              data-hov="Retry AI generation"
              data-pos="T"
            >
              Retry
            </button>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onClick={onClearAIError}
            >
              <BsX size={16} />
            </button>
          </div>
        )}

        {/* Show suggestion badge if AI succeeded and there's a suggestion */}
        {showSuggestionIndicator && !aiLoading && !aiError && (
          <button
            type="button"
            className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full hover:opacity-90 transition-opacity ${
              isAISuggestion
                ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white"
                : "bg-gradient-to-r from-[#26d6c4] to-[#10b1d3] text-white"
            }`}
            onClick={applySuggestedTitle}
            data-hov={isAISuggestion ? "AI-generated suggestion" : `Use suggested title from ${getPlatformLabel()}`}
            data-pos="T"
          >
            <BsLightbulb size={12} />
            <span>{isAISuggestion ? "AI Suggestion" : "Suggestion"}</span>
          </button>
        )}
      </div>
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={hasSuggestion ? suggestedTitle : "Enter task title"}
          className={`input input-bordered input-primary w-full text-base pr-[30px] ${
            hasSuggestion ? "placeholder:text-gray-400 placeholder:italic" : ""
          }`}
          autoFocus={!title}
          onFocus={select}
          autoComplete="off"
        />

        {title.length > 0 && (
          <button
            type="button"
            className="absolute right-[8px] top-1/2 padding-4 transform -translate-y-1/2 no-animation text-gray-500"
            data-hov="Clear title"
            data-pos="R"
            onClick={() => setTaskTitle("")}
          >
            <BsX size={24} />
          </button>
        )}

        <AutocompleteDropdown
          suggestions={currentSuggestions}
          selectedIndex={autocomplete.selectedIndex}
          onSelect={insertSuggestion}
          triggerType={autocomplete.triggerType}
          visible={autocomplete.visible}
        />
      </div>

      {/* Show suggestion preview when input is empty and there's a suggestion */}
      {hasSuggestion && !aiLoading && (
        <div className="mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <BsLightbulb size={10} className={isAISuggestion ? "text-purple-500" : "text-[#1CC5CB]"} />
            {isAISuggestion ? "AI-generated: " : ""}Click the placeholder or{" "}
            <button
              type="button"
              className={`${isAISuggestion ? "text-purple-500" : "text-[#1CC5CB]"} hover:underline`}
              onClick={applySuggestedTitle}
            >
              click here
            </button>{" "}
            to use suggested title
          </span>
        </div>
      )}
    </div>
  );
};

export default AddTaskTitle;
