import type { DirectoryListing } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ?? "";

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${input}`, init);
  if (!response.ok) {
    const message = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(message.detail ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export async function getDirectory(path: string): Promise<DirectoryListing> {
  const search = new URLSearchParams();
  if (path) {
    search.set("path", path);
  }
  return request<DirectoryListing>(`/api/files?${search.toString()}`);
}

export async function uploadFiles(path: string, files: FileList | File[]): Promise<string[]> {
  const formData = new FormData();
  if (files instanceof FileList) {
    Array.from(files).forEach((file) => formData.append("files", file));
  } else {
    files.forEach((file) => formData.append("files", file));
  }
  formData.append("destination", path);

  const response = await fetch(`${API_BASE}/api/files/upload`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail ?? "Upload failed");
  }

  const data = (await response.json()) as { uploaded: string[] };
  return data.uploaded;
}

export async function createFolder(parent: string, name: string): Promise<void> {
  await request("/api/files/folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parent, name })
  });
}

export async function renamePath(current_path: string, new_path: string): Promise<void> {
  await request("/api/files/rename", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_path, new_path })
  });
}

export async function deletePath(path: string): Promise<void> {
  const search = new URLSearchParams({ path });
  await request(`/api/files?${search.toString()}`, {
    method: "DELETE"
  });
}

export function downloadUrl(path: string): string {
  const search = new URLSearchParams({ path });
  return `${API_BASE}/api/files/download?${search.toString()}`;
}
