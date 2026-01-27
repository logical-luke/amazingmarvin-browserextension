import { BsStar, BsStarFill } from "react-icons/bs";

const AddTaskPriority = ({ priority, setPriority }) => {
  const priorities = [
    { value: 1, label: "Low", color: "text-yellow-400", bgColor: "bg-yellow-400", hoverColor: "hover:text-yellow-500" },
    { value: 2, label: "Medium", color: "text-orange-400", bgColor: "bg-orange-400", hoverColor: "hover:text-orange-500" },
    { value: 3, label: "High", color: "text-red-400", bgColor: "bg-red-400", hoverColor: "hover:text-red-500" },
  ];

  const handlePriorityClick = (value) => {
    if (priority === value) {
      setPriority(null);
    } else {
      setPriority(value);
    }
  };

  return (
    <div>
      <label className="label">
        <span className="label-text text-neutral">Priority</span>
      </label>
      <div className="flex flex-wrap gap-1 px-1">
        {priorities.map((p) => {
          const isSelected = priority === p.value;

          return (
            <button
              key={p.value}
              type="button"
              className={`btn btn-xs no-animation flex items-center gap-1 ${
                isSelected
                  ? `btn-primary text-white ${p.bgColor} border-transparent hover:${p.bgColor}`
                  : `btn-outline btn-primary ${p.hoverColor}`
              }`}
              onClick={() => handlePriorityClick(p.value)}
              data-hov={`${p.label} priority`}
              data-pos="T"
            >
              {isSelected ? (
                <BsStarFill size={12} className={isSelected ? "text-white" : p.color} />
              ) : (
                <BsStar size={12} className={p.color} />
              )}
              <span>{p.label}</span>
            </button>
          );
        })}
        {priority && (
          <button
            type="button"
            className="btn btn-xs btn-ghost no-animation text-gray-400 hover:text-gray-600"
            onClick={() => setPriority(null)}
            data-hov="Clear priority"
            data-pos="T"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default AddTaskPriority;
