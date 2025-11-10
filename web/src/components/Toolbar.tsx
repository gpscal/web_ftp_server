import React from "react";

interface ToolbarProps {
  currentPath: string;
  onGoUp: () => void;
  onCreateFolder: () => void;
  onRefresh: () => void;
  isRoot: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ currentPath, onGoUp, onCreateFolder, onRefresh, isRoot }) => {
  const crumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];

  return (
    <div className="toolbar">
      <div>
        <button type="button" className="secondary" onClick={onRefresh}>
          Refresh
        </button>
        <button type="button" onClick={onCreateFolder}>
          New Folder
        </button>
        <button type="button" disabled={isRoot} onClick={onGoUp}>
          Up One Level
        </button>
      </div>
      <div className="status-bar">
        Path: /{crumbs.join("/") || ""}
      </div>
    </div>
  );
};

export default Toolbar;
