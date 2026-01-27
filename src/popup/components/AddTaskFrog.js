const AddTaskFrog = ({ frogLevel, setFrogLevel }) => {
  const frogLevels = [
    { value: 1, label: "Frog", emoji: "\uD83D\uDC38", size: "text-base", description: "Mark as a frog task" },
    { value: 2, label: "Baby", emoji: "\uD83D\uDC38", size: "text-sm", description: "Small but important" },
    { value: 3, label: "Monster", emoji: "\uD83D\uDC38", size: "text-lg", description: "Big important task" },
  ];

  const handleFrogClick = (value) => {
    if (frogLevel === value) {
      setFrogLevel(null);
    } else {
      setFrogLevel(value);
    }
  };

  return (
    <div>
      <label className="label">
        <span className="label-text text-neutral">Frog Status</span>
      </label>
      <div className="flex flex-wrap gap-1 px-1">
        {frogLevels.map((f) => {
          const isSelected = frogLevel === f.value;

          return (
            <button
              key={f.value}
              type="button"
              className={`btn btn-xs no-animation flex items-center gap-1 ${
                isSelected
                  ? "btn-primary text-white"
                  : "btn-outline btn-primary"
              }`}
              onClick={() => handleFrogClick(f.value)}
              data-hov={f.description}
              data-pos="T"
            >
              <span className={f.size}>{f.emoji}</span>
              <span>{f.label}</span>
            </button>
          );
        })}
        {frogLevel && (
          <button
            type="button"
            className="btn btn-xs btn-ghost no-animation text-gray-400 hover:text-gray-600"
            onClick={() => setFrogLevel(null)}
            data-hov="Clear frog status"
            data-pos="T"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default AddTaskFrog;
