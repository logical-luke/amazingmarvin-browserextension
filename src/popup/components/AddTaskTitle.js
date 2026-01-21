import React, { useState, useEffect, useRef, useCallback } from "react";
import { BsX } from "react-icons/bs";
import { getStoredCategories, getStoredLabels } from "../../utils/storage";
import AutocompleteDropdown from "./AutocompleteDropdown";

const AddTaskTitle = ({ title, setTaskTitle, onAutocompleteStateChange }) => {
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

  return (
    <div>
      <div className="flex flex-row items-center gap-0.5">
        <label className="label">
          <span className="label-text text-neutral">Task title</span>
        </label>
      </div>
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Enter task title"
          className="input input-bordered input-primary w-full text-base pr-[30px]"
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
    </div>
  );
};

export default AddTaskTitle;
