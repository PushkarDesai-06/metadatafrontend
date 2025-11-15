"use client";

import { useState, useEffect } from "react";
import { FileMetadata } from "@/types/file";
import { X, FileJson, GitMerge } from "lucide-react";

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <GitMerge className="text-blue-500" size={24} />
            <h2 className="text-2xl font-bold text-gray-100">Merge JSON Files</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-900/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {jsonFiles.length < 2 ? (
            <div className="text-center py-8 text-gray-400">
              <FileJson size={48} className="mx-auto mb-4 text-gray-600" />
              <p>You need at least 2 JSON files to merge</p>
            </div>
          ) : (
            <>
              {/* File Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    First File
                  </label>
                  <select
                    value={selectedFiles[0]?.id || ""}
                    onChange={(e) => {
                      const file = jsonFiles.find(f => String(f.id) === e.target.value);
                      setSelectedFiles([file || null, selectedFiles[1]]);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Second File
                  </label>
                  <select
                    value={selectedFiles[1]?.id || ""}
                    onChange={(e) => {
                      const file = jsonFiles.find(f => String(f.id) === e.target.value);
                      setSelectedFiles([selectedFiles[0], file || null]);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Merge Strategy
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                    mergeStrategy === "shallow" 
                      ? "border-blue-500 bg-blue-900/20" 
                      : "border-gray-600 bg-gray-700 hover:border-gray-500"
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

                  <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                    mergeStrategy === "deep" 
                      ? "border-blue-500 bg-blue-900/20" 
                      : "border-gray-600 bg-gray-700 hover:border-gray-500"
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

                  <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                    mergeStrategy === "override" 
                      ? "border-blue-500 bg-blue-900/20" 
                      : "border-gray-600 bg-gray-700 hover:border-gray-500"
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

                  <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                    mergeStrategy === "combine" 
                      ? "border-blue-500 bg-blue-900/20" 
                      : "border-gray-600 bg-gray-700 hover:border-gray-500"
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
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Preview (first 20 lines)
                  </label>
                  <div className="bg-gray-950 border border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
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
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={!selectedFiles[0] || !selectedFiles[1] || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge size={18} />
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

