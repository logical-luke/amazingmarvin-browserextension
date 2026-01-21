import React from "react";

const AutocompleteDropdown = ({
  suggestions,
  selectedIndex,
  onSelect,
  triggerType,
  visible,
}) => {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  const getTypeLabel = () => {
    switch (triggerType) {
      case "#":
        return "Categories";
      case "@":
        return "Labels";
      case "+":
        return "Projects";
      default:
        return "Suggestions";
    }
  };

  return (
    <div className="absolute z-20 bg-white rounded-lg shadow w-full max-h-48 overflow-y-auto mt-1 border border-gray-200">
      <div className="px-3 py-1 text-xs text-gray-500 border-b border-gray-100">
        {getTypeLabel()}
      </div>
      <ul>
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion._id}
            className={`p-2 cursor-pointer flex items-center ${
              index === selectedIndex ? "bg-gray-100" : "hover:bg-gray-50"
            }`}
            onClick={() => onSelect(suggestion)}
            onMouseDown={(e) => e.preventDefault()}
          >
            {triggerType === "@" && suggestion.color && (
              <span
                className="inline-block w-3 h-3 rounded-full mr-2 flex-shrink-0"
                style={{ backgroundColor: suggestion.color }}
              />
            )}
            <span className="text-sm text-gray-800 truncate">
              {suggestion.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutocompleteDropdown;
