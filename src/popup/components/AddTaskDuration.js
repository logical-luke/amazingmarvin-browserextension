import { BsLightbulb } from "react-icons/bs";

const AddTaskDuration = ({
  timeEstimate,
  setTimeEstimate,
  timeEstimateButtons,
  suggestedTimeEstimate,
  taskContext,
}) => {
  // Format milliseconds to human-readable duration
  const formatDuration = (ms) => {
    if (!ms) return "";
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Check if suggested estimate matches any button
  const suggestedMatchesButton = timeEstimateButtons.some(
    (btn) => btn.value === suggestedTimeEstimate
  );

  // Get platform label
  const getPlatformLabel = () => {
    if (!taskContext?.platform) return "context";
    const labels = {
      github: "GitHub",
      jira: "Jira",
      slack: "Slack",
      gmail: "Gmail",
    };
    return labels[taskContext.platform] || taskContext.platform;
  };

  // Get action label for tooltip
  const getActionLabel = () => {
    if (!taskContext?.action) return "";
    const actionLabels = {
      review: "code review",
      merge: "merging",
      "fix-pipeline": "fixing CI",
      "address-review": "addressing review",
      reply: "replying",
      "jira-bug": "bug fix",
      "jira-task": "task",
      "slack-reply": "Slack reply",
      "gmail-reply": "email reply",
    };
    return actionLabels[taskContext.action] || taskContext.action;
  };

  const buttons = timeEstimateButtons.map((button) => {
    const isChecked = timeEstimate === button.value;
    const isSuggested =
      suggestedTimeEstimate === button.value && !timeEstimate;

    let classes = `btn btn-primary btn-xs no-animation ${
      isChecked ? "text-white" : "btn-outline"
    }`;

    // Highlight suggested button with a subtle indicator
    if (isSuggested && !isChecked) {
      classes += " ring-2 ring-[#1CC5CB] ring-opacity-50";
    }

    return (
      <button
        key={button.value}
        className={classes}
        onClick={() => {
          if (timeEstimate === button.value) {
            setTimeEstimate(0);
            return;
          }

          setTimeEstimate(button.value);
        }}
        data-hov={
          isSuggested
            ? `Suggested for ${getActionLabel()}`
            : undefined
        }
        data-pos="T"
      >
        {button.text}
        {isSuggested && (
          <BsLightbulb size={10} className="ml-0.5 text-[#1CC5CB]" />
        )}
      </button>
    );
  });

  return (
    <div>
      <div className="flex flex-row items-center gap-0.5">
        <label className="label">
          <span className="label-text text-neutral">Time Estimate</span>
        </label>
        {suggestedTimeEstimate && !timeEstimate && !suggestedMatchesButton && (
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gradient-to-r from-[#26d6c4] to-[#10b1d3] text-white rounded-full hover:opacity-90 transition-opacity"
            onClick={() => setTimeEstimate(suggestedTimeEstimate)}
            data-hov={`Suggested ${formatDuration(suggestedTimeEstimate)} for ${getActionLabel()} from ${getPlatformLabel()}`}
            data-pos="T"
          >
            <BsLightbulb size={12} />
            <span>{formatDuration(suggestedTimeEstimate)}</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 px-1">{buttons}</div>
    </div>
  );
};

export default AddTaskDuration;
