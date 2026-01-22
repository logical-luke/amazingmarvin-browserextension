import OptionsContentGeneral from "./OptionsContentGeneral";
import OptionsContentBadge from "./OptionsContentBadge";
import OptionsContentApi from "./OptionsContentApi";
import OptionsContentSync from "./OptionsContentSync";
import OptionsContentGmail from "./OptionsContentGmail";
import OptionsContentJira from "./OptionsContentJira";
import OptionsContentSlack from "./OptionsContentSlack";
import OptionsContentGitHub from "./OptionsContentGitHub";
import OptionsContentSmartAutocomplete from "./OptionsContentSmartAutocomplete";

const OptionsContent = ({ selectedSetting }) => {
  switch (selectedSetting) {
    case "general":
      return <OptionsContentGeneral />;
    case "badge":
      return <OptionsContentBadge />;
    case "api":
      return <OptionsContentApi />;
    case "sync":
      return <OptionsContentSync />;
    case "smartAutocomplete":
      return <OptionsContentSmartAutocomplete />;
    case "gmail":
      return <OptionsContentGmail />;
    case "jira":
      return <OptionsContentJira />;
    case "slack":
      return <OptionsContentSlack />;
    case "github":
      return <OptionsContentGitHub />;
    default:
      return <OptionsContentGeneral />;
  }
};

export default OptionsContent;
