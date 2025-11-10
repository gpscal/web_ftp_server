import React, { useCallback, useEffect, useState } from "react";
import { createFolder, deletePath, getDirectory, renamePath } from "./api/client";
import type { DirectoryListing, FileItem } from "./api/types";
import FileList from "./components/FileList";
import Toolbar from "./components/Toolbar";
import UploadDropzone from "./components/UploadDropzone";

const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState("");
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(
    async (path = currentPath) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getDirectory(path);
        setListing(data);
        setCurrentPath(data.path ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load directory");
      } finally {
        setLoading(false);
      }
    },
    [currentPath]
  );

  useEffect(() => {
    void refresh("");
  }, []);

  const navigateTo = useCallback(
    (path: string) => {
      void refresh(path);
    },
    [refresh]
  );

  const handleCreateFolder = useCallback(async () => {
    const name = window.prompt("Folder name");
    if (!name) {
      return;
    }
    try {
      await createFolder(currentPath, name);
      setStatus(`Created folder "${name}"`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    }
  }, [currentPath, refresh]);

  const handleDelete = useCallback(
    async (item: FileItem) => {
      const confirmed = window.confirm(`Delete ${item.is_dir ? "folder" : "file"} "${item.name}"?`);
      if (!confirmed) return;
      try {
        await deletePath(item.path);
        setStatus(`Deleted "${item.name}"`);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    },
    [refresh]
  );

  const handleRename = useCallback(
    async (item: FileItem) => {
      const parentSegments = item.path.split("/").filter(Boolean);
      parentSegments.pop();
      const parent = parentSegments.join("/");
      const newName = window.prompt("New name", item.name);
      if (!newName || newName === item.name) return;
      const targetPath = [parent, newName].filter(Boolean).join("/");
      try {
        await renamePath(item.path, targetPath);
        setStatus(`Renamed to "${newName}"`);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename");
      }
    },
    [refresh]
  );

  const handleUploadComplete = useCallback(async () => {
    setStatus("Upload complete");
    await refresh();
  }, [refresh]);

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  const goUp = useCallback(() => {
    const parent = listing?.parent ?? "";
    void refresh(parent);
  }, [listing, refresh]);

  const crumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];

  return (
    <div className="app">
      <h1>Web File Manager</h1>

      <Toolbar
        currentPath={currentPath}
        onGoUp={goUp}
        onCreateFolder={handleCreateFolder}
        onRefresh={() => void refresh()}
        isRoot={!currentPath}
      />

      <div className="breadcrumbs">
        <button
          type="button"
          onClick={() => navigateTo("")}
          aria-label="Go to root directory"
        >
          Root
        </button>
        {crumbs.map((crumb, index) => {
          const path = crumbs.slice(0, index + 1).join("/");
          return (
            <React.Fragment key={path}>
              <span>/</span>
              <button type="button" onClick={() => navigateTo(path)}>
                {crumb}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <UploadDropzone currentPath={currentPath} onComplete={handleUploadComplete} onError={handleError} />

      {error && <div className="error">{error}</div>}
      {status && <div className="status-bar">{status}</div>}

      {loading ? (
        <div className="status-bar">Loading…</div>
      ) : (
        <FileList
          items={listing?.items ?? []}
          onNavigate={navigateTo}
          onDelete={handleDelete}
          onRename={handleRename}
        />
      )}
    </div>
  );
};

export default App;
