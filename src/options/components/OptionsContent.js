import OptionsContentGeneral from "./OptionsContentGeneral";
import OptionsContentBadge from "./OptionsContentBadge";
import OptionsContentApi from "./OptionsContentApi";
import OptionsContentSync from "./OptionsContentSync";
import OptionsContentGmail from "./OptionsContentGmail";
import OptionsContentJira from "./OptionsContentJira";

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
    case "gmail":
      return <OptionsContentGmail />;
    case "jira":
      return <OptionsContentJira />;
    default:
      return <OptionsContentGeneral />;
  }
};

export default OptionsContent;
