import React, { useCallback, useRef, useState } from "react";
import { uploadFiles } from "../api/client";

interface UploadDropzoneProps {
  currentPath: string;
  onComplete: () => Promise<void> | void;
  onError: (message: string) => void;
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({ currentPath, onComplete, onError }) => {
  const [isActive, setIsActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!files || files.length === 0) return;
      setIsUploading(true);
      try {
        await uploadFiles(currentPath, files);
        await onComplete();
      } catch (error) {
        onError(error instanceof Error ? error.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [currentPath, onComplete, onError]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsActive(false);
      if (event.dataTransfer?.files?.length) {
        void handleFiles(event.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsActive(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsActive(false);
  }, []);

  const onFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files?.length) {
        void handleFiles(event.target.files);
        event.target.value = "";
      }
    },
    [handleFiles]
  );

  const triggerFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      className={`dropzone ${isActive ? "active" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      role="button"
      tabIndex={0}
      onClick={triggerFileDialog}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          triggerFileDialog();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={onFileInputChange}
      />
      {isUploading ? (
        <p>Uploading…</p>
      ) : (
        <>
          <p>Drag and drop files here, or click to browse.</p>
          <small>Current destination: /{currentPath}</small>
        </>
      )}
    </div>
  );
};

export default UploadDropzone;
