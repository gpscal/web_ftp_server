export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
  mime_type?: string | null;
}

export interface DirectoryListing {
  path: string;
  parent: string | null;
  items: FileItem[];
}
