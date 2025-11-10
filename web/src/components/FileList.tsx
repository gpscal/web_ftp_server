import React from "react";
import { downloadUrl } from "../api/client";
import type { FileItem } from "../api/types";

interface FileListProps {
  items: FileItem[];
  onNavigate: (path: string) => void;
  onDelete: (item: FileItem) => void;
  onRename: (item: FileItem) => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(1)} ${units[index]}`;
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleString();
};

const FileList: React.FC<FileListProps> = ({ items, onNavigate, onDelete, onRename }) => {
  if (!items.length) {
    return <div className="empty-state">This folder is empty. Start by uploading files or creating a folder.</div>;
  }

  return (
    <table className="file-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Size</th>
          <th>Modified</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.path}>
            <td>
              {item.is_dir ? (
                <button
                  type="button"
                  className="link-like"
                  onClick={() => onNavigate(item.path)}
                >
                  📁 {item.name}
                </button>
              ) : (
                <span>📄 {item.name}</span>
              )}
            </td>
            <td>{item.is_dir ? "Folder" : item.mime_type ?? "File"}</td>
            <td>{item.is_dir ? "-" : formatBytes(item.size)}</td>
            <td>{formatDate(item.modified)}</td>
            <td>
                <div className="file-actions">
                  {!item.is_dir && (
                    <a className="button secondary" href={downloadUrl(item.path)} download>
                      Download
                    </a>
                  )}
                  <button type="button" onClick={() => onRename(item)}>
                    Rename
                  </button>
                  <button type="button" className="danger" onClick={() => onDelete(item)}>
                    Delete
                  </button>
                </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default FileList;
