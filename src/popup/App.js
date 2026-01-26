import { useEffect, useState } from "react";

import { getStoredToken, getStoredGeneralSettings } from "../utils/storage";

import OnboardingPage from "./components/OnboardingPage";
import BottomMenu from "./components/BottomMenu";
import TaskList from "./components/TaskList";
import AddTask from "./components/AddTask";
import TrackedTask from "./components/TrackedTask";

let initialApiToken = null;
try {
  if (localStorage.apiToken) {
    initialApiToken = JSON.parse(localStorage.apiToken);
    if (!initialApiToken["X-API-Token"] && !initialApiToken["X-Full-Access-Token"]) {
      initialApiToken = null;
    }
  }
} catch (err) {
}

const App = () => {
  const [activeTab, setActiveTab] = useState("add-task");
  const [apiToken, setApiToken] = useState(initialApiToken);
  const [onboarded, setOnboarded] = useState(!!initialApiToken);
  const [showTrackedTask, setShowTrackedTask] = useState(true);

  // Load settings on mount
  useEffect(() => {
    getStoredGeneralSettings().then((settings) => {
      if (settings && typeof settings.showTrackedTask === "boolean") {
        setShowTrackedTask(settings.showTrackedTask);
      }
    });
  }, []);

  return (
    <div className="flex flex-col w-[400px] min-h-[400px] max-h-[600px] justify-between">
      {!onboarded ? (
        <OnboardingPage setApiToken={setApiToken} setOnboarded={setOnboarded} />
      ) : (
        <>
          {showTrackedTask && <TrackedTask />}
          {activeTab === "today" && <TaskList apiToken={apiToken} setOnboarded={setOnboarded} />}
          {activeTab === "add-task" && <AddTask setOnboarded={setOnboarded} />}
          <BottomMenu activeTab={activeTab} setActiveTab={setActiveTab} />
        </>
      )}
    </div>
  );
};

export default App;
