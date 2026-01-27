import { BsTrophy } from "react-icons/bs";

const AddTaskRewardPoints = ({ rewardPoints, setRewardPoints }) => {
  const quickPoints = [1, 2, 3, 5, 10];

  const handlePointsClick = (value) => {
    if (rewardPoints === value) {
      setRewardPoints(null);
    } else {
      setRewardPoints(value);
    }
  };

  return (
    <div>
      <label className="label">
        <span className="label-text text-neutral">Reward Points</span>
      </label>
      <div className="flex flex-wrap gap-1 px-1 items-center">
        {quickPoints.map((points) => {
          const isSelected = rewardPoints === points;

          return (
            <button
              key={points}
              type="button"
              className={`btn btn-xs no-animation flex items-center gap-1 ${
                isSelected
                  ? "btn-primary text-white"
                  : "btn-outline btn-primary"
              }`}
              onClick={() => handlePointsClick(points)}
              data-hov={`${points} reward point${points > 1 ? "s" : ""}`}
              data-pos="T"
            >
              <BsTrophy size={10} />
              <span>{points}</span>
            </button>
          );
        })}
        {rewardPoints && (
          <button
            type="button"
            className="btn btn-xs btn-ghost no-animation text-gray-400 hover:text-gray-600"
            onClick={() => setRewardPoints(null)}
            data-hov="Clear reward points"
            data-pos="T"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default AddTaskRewardPoints;
