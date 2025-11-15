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
  CheckSquare,
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

  const generateVideoThumbnail = () => {
    const video = document.createElement("video");
    video.src = file.filePath;
    video.crossOrigin = "anonymous";
    video.muted = true;

    const handleLoadedData = () => {
      // Use deterministic random time based on file ID
      const timePercent = getRandomTimePercent(String(file.id));
      const randomTime = video.duration * timePercent;
      video.currentTime = randomTime;
    };

    const handleSeeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setVideoThumbnail(canvas.toDataURL());
      }
      
      // Cleanup
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
      video.src = "";
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("seeked", handleSeeked);

    video.load();
  };

  useEffect(() => {
    if (file.category === "Videos" && !videoThumbnail) {
      generateVideoThumbnail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.category, file.filePath, videoThumbnail]);

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
      className={`relative bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm border rounded-2xl p-5 transition-all duration-300 group overflow-hidden ${
        isSelected 
          ? 'border-blue-500 ring-2 ring-blue-500/50 shadow-xl shadow-blue-500/30 scale-105' 
          : 'border-gray-700/50 hover:border-gray-600 hover:shadow-2xl hover:shadow-blue-900/30 hover:scale-[1.02]'
      } ${selectionMode ? 'cursor-pointer' : ''}`}
      onClick={() => {
        if (selectionMode && onSelect) {
          onSelect(file);
        }
      }}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500 rounded-2xl"></div>
      
      {/* Content wrapper */}
      <div className="relative z-10">
      {/* Image preview for image files */}
      {file.category === "Images" && (
        <div className="mb-4 rounded-xl overflow-hidden bg-gray-950/50 aspect-video flex items-center justify-center border border-gray-700/50 shadow-inner group-hover:border-gray-600 transition-colors">
          <img
            src={file.filePath}
            alt={file.originalName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              // Fallback to icon if image fails to load
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}

      {/* Video thumbnail for video files */}
      {file.category === "Videos" && videoThumbnail && (
        <div className="mb-4 rounded-xl overflow-hidden bg-gray-950/50 aspect-video flex items-center justify-center border border-gray-700/50 shadow-inner relative group-hover:border-gray-600 transition-colors">
          <img
            src={videoThumbnail}
            alt={file.originalName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
            <Video size={32} className="text-white drop-shadow-lg" />
          </div>
        </div>
      )}

      {/* JSON preview for JSON files */}
      {file.category === "Data" && file.extension === "json" && (
        <div className="mb-4 rounded-xl overflow-hidden bg-gray-950/80 border border-gray-700/50 p-4 max-h-32 overflow-y-auto shadow-inner backdrop-blur-sm group-hover:border-green-500/30 transition-colors">
          <pre className="text-xs text-green-400/90 font-mono whitespace-pre-wrap wrap-break-word leading-relaxed">
            {JSON.stringify(file.metadata, null, 2).slice(0, 200)}
            {JSON.stringify(file.metadata).length > 200 && "..."}
          </pre>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="shrink-0 flex items-center gap-3">
          {selectionMode && (
            <div className="relative">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onSelect && onSelect(file)}
                onClick={(e) => e.stopPropagation()}
                className="w-6 h-6 text-blue-600 bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all duration-200 hover:border-blue-500"
              />
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <CheckSquare size={16} className="text-blue-400" />
                </div>
              )}
            </div>
          )}
          <div className="transform group-hover:scale-110 transition-transform duration-300">
            {getFileIcon()}
          </div>
        </div>
        <div className={`flex gap-2 transition-all duration-300 ${selectionMode ? 'opacity-0' : 'opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview(file);
            }}
            className="p-2 hover:bg-blue-500/20 rounded-lg transition-all duration-200 hover:scale-110 backdrop-blur-sm border border-transparent hover:border-blue-500/30"
            title="Preview"
            disabled={selectionMode}
          >
            <Eye size={16} className="text-gray-400 hover:text-blue-400 transition-colors" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="p-2 hover:bg-green-500/20 rounded-lg transition-all duration-200 hover:scale-110 backdrop-blur-sm border border-transparent hover:border-green-500/30"
            title="Download"
            disabled={selectionMode}
          >
            <Download size={16} className="text-gray-400 hover:text-green-400 transition-colors" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-2 hover:bg-purple-500/20 rounded-lg transition-all duration-200 hover:scale-110 backdrop-blur-sm border border-transparent hover:border-purple-500/30"
              title="More options"
              disabled={selectionMode}
            >
              <MoreVertical size={16} className="text-gray-400 hover:text-purple-400 transition-colors" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl z-10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRenaming(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-blue-500/10 hover:text-blue-400 transition-all duration-200"
                >
                  <Edit2 size={15} />
                  <span className="font-medium">Rename</span>
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
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 border-t border-gray-700/50"
                  >
                    <Trash2 size={15} />
                    <span className="font-medium">Delete</span>
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
          className="w-full bg-gray-700/50 border-2 border-blue-500 rounded-lg px-3 py-2 text-sm text-gray-100 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm transition-all"
        />
      ) : (
        <h3
          className="font-semibold text-sm truncate mb-2 text-gray-100 group-hover:text-white transition-colors"
          title={file.originalName}
        >
          {file.originalName}
        </h3>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <span className="font-medium">{formatFileSize(file.fileSize)}</span>
        <span>•</span>
        <span className="uppercase font-semibold tracking-wider">{file.extension}</span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-400 text-xs rounded-lg font-medium border border-blue-500/20 backdrop-blur-sm">
          {file.category}
        </span>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-700/30 backdrop-blur-sm border border-gray-600/30"
          title={`Stored in ${
            file.storageType === "mongodb" ? "MongoDB" : "PostgreSQL"
          }`}
        >
          <Database
            size={13}
            className={
              file.storageType === "mongodb"
                ? "text-green-400"
                : "text-blue-400"
            }
          />
          <span className="text-xs text-gray-400 font-medium">
            {file.storageType === "mongodb" ? "Mongo" : "Postgres"}
          </span>
        </div>
      </div>

      {file.tags && file.tags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700/50 flex flex-wrap gap-1.5">
          {file.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2.5 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-lg font-medium hover:bg-gray-600/50 transition-colors backdrop-blur-sm border border-gray-600/30"
            >
              {tag}
            </span>
          ))}
          {file.tags.length > 3 && (
            <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-400 text-xs rounded-lg font-medium border border-purple-500/20">
              +{file.tags.length - 3}
            </span>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
