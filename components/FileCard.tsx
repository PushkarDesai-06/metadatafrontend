"use client";

import { FileMetadata } from "@/types/file";
import { formatFileSize } from "@/lib/utils";
import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  FileJson,
  File as FileIcon,
  Download,
  Eye,
  Database,
  Trash2,
  MoreVertical,
  Edit2,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface FileCardProps {
  file: FileMetadata;
  onPreview: (file: FileMetadata) => void;
  onDelete?: (file: FileMetadata) => void;
  onRename?: (file: FileMetadata, newName: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (file: FileMetadata) => void;
}

export default function FileCard({
  file,
  onPreview,
  onDelete,
  onRename,
  selectionMode = false,
  isSelected = false,
  onSelect,
}: FileCardProps) {
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.originalName);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate a deterministic random time based on file ID
  const getRandomTimePercent = (id: string) => {
    // Simple hash function to get a consistent number from the ID
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Map to 0.1-0.5 range
    return 0.1 + (Math.abs(hash) % 40) / 100;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (file.category === "Videos" && !videoThumbnail) {
      generateVideoThumbnail();
    }
  }, [file.category, file.filePath, videoThumbnail]);

  const generateVideoThumbnail = () => {
    const video = document.createElement("video");
    video.src = file.filePath;
    video.crossOrigin = "anonymous";
    video.muted = true;

    video.addEventListener("loadeddata", () => {
      // Use deterministic random time based on file ID
      const timePercent = getRandomTimePercent(String(file.id));
      const randomTime = video.duration * timePercent;
      video.currentTime = randomTime;
    });

    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setVideoThumbnail(canvas.toDataURL());
      }
    });

    video.load();
  };

  const handleRename = () => {
    if (newName.trim() && newName !== file.originalName && onRename) {
      onRename(file, newName.trim());
      setIsRenaming(false);
      setShowMenu(false);
    } else {
      setNewName(file.originalName);
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setNewName(file.originalName);
      setIsRenaming(false);
    }
  };

  const getFileIcon = () => {
    switch (file.category) {
      case "Images":
        return <ImageIcon className="text-green-500" size={40} />;
      case "Videos":
        return <Video className="text-purple-500" size={40} />;
      case "Audio":
        return <Music className="text-pink-500" size={40} />;
      case "Data":
        return <FileJson className="text-blue-500" size={40} />;
      case "Documents":
        return <FileText className="text-orange-500" size={40} />;
      default:
        return <FileIcon className="text-gray-500" size={40} />;
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(file.filePath);

      // Get the blob with original content type
      const blob = await response.blob();

      // Create a new blob with correct MIME type if needed
      const correctBlob = new Blob([blob], {
        type: file.mimeType || blob.type || "application/octet-stream",
      });

      const url = window.URL.createObjectURL(correctBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download file. Please try again.");
    }
  };

  return (
    <div 
      className={`bg-gray-800 border rounded-lg p-4 hover:shadow-xl hover:shadow-blue-900/20 transition-all group ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-700'
      } ${selectionMode ? 'cursor-pointer' : ''}`}
      onClick={() => {
        if (selectionMode && onSelect) {
          onSelect(file);
        }
      }}
    >
      {/* Image preview for image files */}
      {file.category === "Images" && (
        <div className="mb-3 rounded-lg overflow-hidden bg-gray-900 aspect-video flex items-center justify-center">
          <img
            src={file.filePath}
            alt={file.originalName}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to icon if image fails to load
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}

      {/* Video thumbnail for video files */}
      {file.category === "Videos" && videoThumbnail && (
        <div className="mb-3 rounded-lg overflow-hidden bg-gray-900 aspect-video flex items-center justify-center">
          <img
            src={videoThumbnail}
            alt={file.originalName}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* JSON preview for JSON files */}
      {file.category === "Data" && file.extension === "json" && (
        <div className="mb-3 rounded-lg overflow-hidden bg-gray-950 border border-gray-700 p-3 max-h-32 overflow-y-auto">
          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap wrap-break-word">
            {JSON.stringify(file.metadata, null, 2).slice(0, 200)}
            {JSON.stringify(file.metadata).length > 200 && "..."}
          </pre>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="shrink-0 flex items-center gap-2">
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect && onSelect(file)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          )}
          {getFileIcon()}
        </div>
        <div className={`flex gap-1 transition-opacity ${selectionMode ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onClick={() => onPreview(file)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Preview"
          >
            <Eye size={18} className="text-gray-400" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Download"
          >
            <Download size={18} className="text-gray-400" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors"
              title="More options"
            >
              <MoreVertical size={18} className="text-gray-400" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRenaming(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <Edit2 size={14} />
                  Rename
                </button>
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      if (confirm(`Delete "${file.originalName}"?`)) {
                        onDelete(file);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          className="w-full bg-gray-700 border border-blue-500 rounded px-2 py-1 text-sm text-gray-100 mb-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <h3
          className="font-medium text-sm truncate mb-1 text-gray-100"
          title={file.originalName}
        >
          {file.originalName}
        </h3>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
        <span>{formatFileSize(file.fileSize)}</span>
        <span>•</span>
        <span className="uppercase">{file.extension}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="inline-block px-2 py-1 bg-blue-900 text-blue-300 text-xs rounded">
          {file.category}
        </span>
        <div
          className="flex items-center gap-1"
          title={`Stored in ${
            file.storageType === "mongodb" ? "MongoDB" : "PostgreSQL"
          }`}
        >
          <Database
            size={12}
            className={
              file.storageType === "mongodb"
                ? "text-green-400"
                : "text-blue-400"
            }
          />
          <span className="text-xs text-gray-400">
            {file.storageType === "mongodb" ? "Mongo" : "Postgres"}
          </span>
        </div>
      </div>

      {file.tags && file.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {file.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="inline-block px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
            >
              {tag}
            </span>
          ))}
          {file.tags.length > 3 && (
            <span className="inline-block px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
              +{file.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
