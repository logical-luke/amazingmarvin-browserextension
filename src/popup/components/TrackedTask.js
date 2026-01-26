import { useState, useEffect, useCallback } from "react";
import { HiClock, HiStop, HiArrowTopRightOnSquare } from "react-icons/hi2";

import { getTrackedItem, stopTracking } from "../../utils/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const TrackedTask = ({ onTrackingStopped }) => {
  const [trackedTask, setTrackedTask] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStopping, setIsStopping] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(null);

  // Fetch tracked task on mount
  useEffect(() => {
    fetchTrackedTask();
  }, []);

  // Update elapsed time every second
  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedTime(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const fetchTrackedTask = useCallback(async () => {
    setIsLoading(true);
    const task = await getTrackedItem();
    if (task) {
      setTrackedTask(task);
      // startTime comes from API in milliseconds
      if (task.startTime) {
        setStartTime(task.startTime);
        setElapsedTime(Math.floor((Date.now() - task.startTime) / 1000));
      }
    } else {
      setTrackedTask(null);
    }
    setIsLoading(false);
  }, []);

  const handleStopTracking = useCallback(async () => {
    if (!trackedTask) return;

    setIsStopping(true);
    const success = await stopTracking(trackedTask._id);
    if (success) {
      setTrackedTask(null);
      setStartTime(null);
      setElapsedTime(0);
      if (onTrackingStopped) {
        onTrackingStopped();
      }
    }
    setIsStopping(false);
  }, [trackedTask, onTrackingStopped]);

  const formatElapsedTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Don't render anything if loading or no tracked task
  if (isLoading) {
    return null;
  }

  if (!trackedTask) {
    return null;
  }

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <HiClock className="text-primary flex-shrink-0" size={18} />
          <span className="font-mono text-sm text-primary font-medium">
            {formatElapsedTime(elapsedTime)}
          </span>
          <span className="truncate text-sm" title={trackedTask.title}>
            {trackedTask.title}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={`https://app.amazingmarvin.com/#t=${trackedTask._id}`}
            target="_blank"
            className="p-1.5 hover:bg-primary/20 rounded transition-colors"
            title="Open in Marvin"
          >
            <HiArrowTopRightOnSquare size={16} className="text-primary" />
          </a>
          <button
            onClick={handleStopTracking}
            disabled={isStopping}
            className="p-1.5 hover:bg-red-100 rounded transition-colors"
            title="Stop tracking"
          >
            {isStopping ? (
              <LoadingSpinner height="h-4" width="w-4" />
            ) : (
              <HiStop size={16} className="text-red-500" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackedTask;
