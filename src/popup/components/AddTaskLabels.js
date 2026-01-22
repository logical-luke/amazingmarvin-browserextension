import { useEffect, useState } from "react";
import { BsLightbulb } from "react-icons/bs";
import { getStoredLabels } from "../../utils/storage";
import MarvinLabel from "../../components/MarvinLabel";
import AddTaskLabelsDropdown from "./AddTaskLabelsDropdown";

const AddTaskLabels = ({
  labels,
  setLabels,
  suggestedLabels,
  taskContext,
}) => {
  const [allLabels, setAllLabels] = useState([]);

  useEffect(() => {
    getStoredLabels().then((storedLabels) => {
      if (!storedLabels || storedLabels.length === 0) {
        return;
      }

      let allLabels = storedLabels.map((storedLabel) => {
        storedLabel.selected = false;
        return storedLabel;
      });

      setAllLabels(allLabels);
    });
  }, []);

  const checkLabel = (label) => {
    if (label.selected) {
      uncheckLabel(label._id);

      return;
    }

    setLabels((prevLabels) => {
      if (prevLabels.find((prevLabel) => prevLabel._id === label._id)) {
        return prevLabels;
      }

      return [...prevLabels, label];
    });

    setAllLabels((prevAllLabels) => {
      return prevAllLabels.map((prevLabel) => {
        if (prevLabel._id === label._id) {
          prevLabel.selected = true;
        }
        return prevLabel;
      });
    });
  };
  const uncheckLabel = (id) => {
    setLabels((prevLabels) => {
      return prevLabels.filter((label) => label._id !== id);
    });

    setAllLabels((prevAllLabels) => {
      return prevAllLabels.map((label) => {
        if (label._id === id) {
          label.selected = false;
        }
        return label;
      });
    });
  };

  // Apply all suggested labels
  const applySuggestedLabels = () => {
    if (!suggestedLabels || suggestedLabels.length === 0) return;

    suggestedLabels.forEach((suggestedLabel) => {
      // Find the label in allLabels and check it
      const label = allLabels.find((l) => l._id === suggestedLabel._id);
      if (label && !label.selected) {
        checkLabel(label);
      }
    });
  };

  // Check if suggested labels are already applied
  const suggestedLabelsApplied =
    !suggestedLabels ||
    suggestedLabels.length === 0 ||
    suggestedLabels.every((sl) =>
      labels.some((l) => l._id === sl._id)
    );

  // Get platform label
  const getPlatformLabel = () => {
    if (!taskContext?.platform) return "context";
    const platformLabels = {
      github: "GitHub",
      jira: "Jira",
      slack: "Slack",
      gmail: "Gmail",
    };
    return platformLabels[taskContext.platform] || taskContext.platform;
  };

  return (
    <div>
      <div className="flex flex-row items-center gap-0.5">
        <label className="label">
          <span className="label-text text-neutral">Set Labels</span>
        </label>
        {suggestedLabels &&
          suggestedLabels.length > 0 &&
          !suggestedLabelsApplied && (
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gradient-to-r from-[#26d6c4] to-[#10b1d3] text-white rounded-full hover:opacity-90 transition-opacity"
              onClick={applySuggestedLabels}
              data-hov={`Apply suggested labels from ${getPlatformLabel()}`}
              data-pos="T"
            >
              <BsLightbulb size={12} />
              <span>
                {suggestedLabels.length === 1
                  ? suggestedLabels[0].title
                  : `${suggestedLabels.length} labels`}
              </span>
            </button>
          )}
      </div>
      <div className="flex flex-wrap gap-y-2">
        {labels.length > 0 &&
          labels.map((label) => {
            if (!label.selected) {
              return;
            }

            return (
              <MarvinLabel
                key={label._id}
                label={label}
                uncheckLabel={uncheckLabel}
              />
            );
          })}
      </div>
      <AddTaskLabelsDropdown
        allLabels={allLabels}
        checkLabel={checkLabel}
        labels={labels}
        suggestedLabels={suggestedLabels}
      />
    </div>
  );
};

export default AddTaskLabels;
