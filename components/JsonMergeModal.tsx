"use client";

import { useState, useEffect } from "react";
import { FileMetadata } from "@/types/file";
import { X, FileJson, GitMerge, Eye } from "lucide-react";

interface JsonMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileMetadata[];
  onMergeComplete: () => void;
}

type MergeStrategy = "shallow" | "deep" | "override" | "combine";

export default function JsonMergeModal({
  isOpen,
  onClose,
  files,
  onMergeComplete,
}: JsonMergeModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<[FileMetadata | null, FileMetadata | null]>([null, null]);
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>("shallow");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter only JSON files
  const jsonFiles = files.filter(f => f.extension === "json");

  useEffect(() => {
    if (isOpen) {
      setSelectedFiles([null, null]);
      setMergeStrategy("shallow");
      setPreview(null);
      setError(null);
    }
  }, [isOpen]);

  const generatePreview = async () => {
    if (!selectedFiles[0] || !selectedFiles[1]) return;

    try {
      const [data1, data2] = await Promise.all([
        fetch(selectedFiles[0].filePath).then(r => r.json()),
        fetch(selectedFiles[1].filePath).then(r => r.json()),
      ]);

      let merged;
      switch (mergeStrategy) {
        case "shallow":
          merged = { ...data1, ...data2 };
          break;
        case "deep":
          merged = deepMerge(data1, data2);
          break;
        case "override":
          merged = data2; // Second file overrides completely
          break;
        case "combine":
          merged = { file1: data1, file2: data2 };
          break;
      }

      setPreview(merged);
    } catch (err) {
      console.error("Preview error:", err);
      setError("Failed to generate preview");
    }
  };

  useEffect(() => {
    if (selectedFiles[0] && selectedFiles[1]) {
      // Debounce preview generation to avoid race conditions
      const timer = setTimeout(() => {
        generatePreview();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles, mergeStrategy]);

  const deepMerge = (obj1: any, obj2: any): any => {
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      return [...obj1, ...obj2];
    }
    
    if (obj1 && typeof obj1 === "object" && obj2 && typeof obj2 === "object" && !Array.isArray(obj1) && !Array.isArray(obj2)) {
      const result = { ...obj1 };
      for (const key in obj2) {
        if (key in result) {
          result[key] = deepMerge(result[key], obj2[key]);
        } else {
          result[key] = obj2[key];
        }
      }
      return result;
    }
    
    return obj2; // Override with second value
  };

  const handleMerge = async () => {
    if (!selectedFiles[0] || !selectedFiles[1]) {
      setError("Please select two JSON files");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/files/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file1Id: selectedFiles[0].id,
          file1StorageType: selectedFiles[0].storageType,
          file2Id: selectedFiles[1].id,
          file2StorageType: selectedFiles[1].storageType,
          strategy: mergeStrategy,
        }),
      });

      if (response.ok) {
        onMergeComplete();
        onClose();
      } else {
        const error = await response.json();
        setError(error.error || "Merge failed");
      }
    } catch (err) {
      console.error("Merge error:", err);
      setError("Failed to merge files");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-700/50 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
              <GitMerge className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Merge JSON Files
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">Combine your JSON data intelligently</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-lg transition-all duration-200 hover:scale-110"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {error && (
            <div className="bg-gradient-to-r from-red-900/30 to-rose-900/30 border border-red-500/50 text-red-300 px-5 py-4 rounded-xl backdrop-blur-sm animate-in slide-in-from-top duration-300 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <X size={16} className="text-red-400" />
              </div>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {jsonFiles.length < 2 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="relative mb-6 inline-block">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"></div>
                <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-700/50">
                  <FileJson size={48} className="text-blue-400" />
                </div>
              </div>
              <p className="text-lg font-semibold text-gray-300">You need at least 2 JSON files to merge</p>
            </div>
          ) : (
            <>
              {/* File Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-400 font-bold border border-blue-500/30">1</span>
                    First File
                  </label>
                  <select
                    value={selectedFiles[0]?.id || ""}
                    onChange={(e) => {
                      const file = jsonFiles.find(f => String(f.id) === e.target.value);
                      setSelectedFiles([file || null, selectedFiles[1]]);
                    }}
                    className="w-full bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 text-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                  >
                    <option value="">Select a file...</option>
                    {jsonFiles.map((file) => (
                      <option key={`${file.storageType}-${file.id}`} value={file.id}>
                        {file.originalName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 font-bold border border-purple-500/30">2</span>
                    Second File
                  </label>
                  <select
                    value={selectedFiles[1]?.id || ""}
                    onChange={(e) => {
                      const file = jsonFiles.find(f => String(f.id) === e.target.value);
                      setSelectedFiles([selectedFiles[0], file || null]);
                    }}
                    className="w-full bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 text-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-medium"
                  >
                    <option value="">Select a file...</option>
                    {jsonFiles.map((file) => (
                      <option 
                        key={`${file.storageType}-${file.id}`} 
                        value={file.id}
                        disabled={file.id === selectedFiles[0]?.id}
                      >
                        {file.originalName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Merge Strategy */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-4">
                  Merge Strategy
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all duration-300 ${
                    mergeStrategy === "shallow" 
                      ? "border-blue-500 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/20 scale-105" 
                      : "border-gray-600/50 bg-gray-700/30 hover:border-gray-500 hover:bg-gray-700/50 backdrop-blur-sm"
                  }`}>
                    <input
                      type="radio"
                      name="strategy"
                      value="shallow"
                      checked={mergeStrategy === "shallow"}
                      onChange={(e) => setMergeStrategy(e.target.value as MergeStrategy)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-200">Shallow Merge</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Combine top-level keys. Second file overwrites conflicts.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all duration-300 ${
                    mergeStrategy === "deep" 
                      ? "border-blue-500 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/20 scale-105" 
                      : "border-gray-600/50 bg-gray-700/30 hover:border-gray-500 hover:bg-gray-700/50 backdrop-blur-sm"
                  }`}>
                    <input
                      type="radio"
                      name="strategy"
                      value="deep"
                      checked={mergeStrategy === "deep"}
                      onChange={(e) => setMergeStrategy(e.target.value as MergeStrategy)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-200">Deep Merge</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Recursively merge nested objects and concatenate arrays.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all duration-300 ${
                    mergeStrategy === "override" 
                      ? "border-blue-500 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/20 scale-105" 
                      : "border-gray-600/50 bg-gray-700/30 hover:border-gray-500 hover:bg-gray-700/50 backdrop-blur-sm"
                  }`}>
                    <input
                      type="radio"
                      name="strategy"
                      value="override"
                      checked={mergeStrategy === "override"}
                      onChange={(e) => setMergeStrategy(e.target.value as MergeStrategy)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-200">Override</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Replace first file completely with second file.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all duration-300 ${
                    mergeStrategy === "combine" 
                      ? "border-blue-500 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/20 scale-105" 
                      : "border-gray-600/50 bg-gray-700/30 hover:border-gray-500 hover:bg-gray-700/50 backdrop-blur-sm"
                  }`}>
                    <input
                      type="radio"
                      name="strategy"
                      value="combine"
                      checked={mergeStrategy === "combine"}
                      onChange={(e) => setMergeStrategy(e.target.value as MergeStrategy)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-200">Combine</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Keep both files as separate objects with keys "file1" and "file2".
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview */}
              {preview && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
                    <Eye size={16} className="text-green-400" />
                    Preview (first 20 lines)
                  </label>
                  <div className="bg-gray-950/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 max-h-80 overflow-y-auto shadow-inner">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(preview, null, 2).split('\n').slice(0, 20).join('\n')}
                      {JSON.stringify(preview, null, 2).split('\n').length > 20 && '\n...'}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {jsonFiles.length >= 2 && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700/50 bg-gray-800/30">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-600/50 text-gray-300 rounded-xl hover:bg-gray-700/50 hover:border-gray-500 transition-all duration-200 font-medium hover:scale-105"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={!selectedFiles[0] || !selectedFiles[1] || loading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/30 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/40"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge size={20} />
                  Merge Files
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

