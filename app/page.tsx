"use client";

import { useState, useEffect } from "react";
import { Upload, RefreshCw, Download, Trash2, GitMerge, CheckSquare, Square } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import SearchBar, { SearchFilters } from "@/components/SearchBar";
import FileCard from "@/components/FileCard";
import UploadModal from "@/components/UploadModal";
import FilePreviewModal from "@/components/FilePreviewModal";
import JsonMergeModal from "@/components/JsonMergeModal";
import { FileMetadata } from "@/types/file";
import JSZip from "jszip";

export default function Home() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileMetadata[]>([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [stats, setStats] = useState({
    postgres: { total: 0, byCategory: {}, byExtension: {} },
    mongodb: { total: 0, byCategory: {}, byExtension: {} },
    combined: { total: 0, byCategory: {}, byExtension: {} },
  });

  const fetchFiles = async (filters?: SearchFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.query) params.append("query", filters.query);
      if (filters?.category) params.append("category", filters.category);
      if (filters?.extension) params.append("extension", filters.extension);
      if (filters?.tags && filters.tags.length > 0) {
        params.append("tags", filters.tags.join(","));
      }

      const response = await fetch(`/api/files?${params}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
        setFilteredFiles(data.files || []);
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchStats();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      setFilteredFiles(files.filter((f) => f.category === selectedCategory));
    } else {
      setFilteredFiles(files);
    }
  }, [selectedCategory, files]);

  const handleSearch = (query: string, filters: SearchFilters) => {
    fetchFiles(filters);
  };

  const handleUploadComplete = () => {
    fetchFiles();
    fetchStats();
  };

  const handleDelete = async (file: FileMetadata) => {
    try {
      const response = await fetch(
        `/api/files/${file.id}?storageType=${file.storageType}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        fetchFiles();
        fetchStats();
      } else {
        const error = await response.json();
        alert(`Delete failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Delete failed. Please try again.");
    }
  };

  const handleRename = async (file: FileMetadata, newName: string) => {
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storageType: file.storageType,
          newName: newName,
        }),
      });

      if (response.ok) {
        fetchFiles();
      } else {
        const error = await response.json();
        alert(`Rename failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Rename error:", error);
      alert("Rename failed. Please try again.");
    }
  };

  const handleFileSelect = (file: FileMetadata) => {
    setSelectedFiles((prev) => {
      const isSelected = prev.some(
        (f) => f.id === file.id && f.storageType === file.storageType
      );
      if (isSelected) {
        return prev.filter(
          (f) => !(f.id === file.id && f.storageType === file.storageType)
        );
      } else {
        return [...prev, file];
      }
    });
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedFiles([]);
  };

  const selectAll = () => {
    setSelectedFiles([...filteredFiles]);
  };

  const deselectAll = () => {
    setSelectedFiles([]);
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;

    if (!confirm(`Delete ${selectedFiles.length} file(s)?`)) {
      return;
    }

    try {
      const response = await fetch("/api/files/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          files: selectedFiles.map((f) => ({
            id: f.id,
            storageType: f.storageType,
          })),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setSelectedFiles([]);
        setSelectionMode(false);
        fetchFiles();
        fetchStats();
      } else {
        const error = await response.json();
        alert(`Bulk delete failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Bulk delete error:", error);
      alert("Bulk delete failed. Please try again.");
    }
  };

  const handleBulkDownload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      const zip = new JSZip();
      const failedFiles: string[] = [];
      const fileNameCounts = new Map<string, number>();

      // Fetch all files and add to zip
      for (const file of selectedFiles) {
        try {
          const response = await fetch(file.filePath);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const blob = await response.blob();
          
          // Handle duplicate filenames
          let fileName = file.originalName;
          const count = fileNameCounts.get(fileName) || 0;
          if (count > 0) {
            const lastDot = fileName.lastIndexOf('.');
            if (lastDot > 0) {
              fileName = `${fileName.substring(0, lastDot)}_${count}${fileName.substring(lastDot)}`;
            } else {
              fileName = `${fileName}_${count}`;
            }
          }
          fileNameCounts.set(file.originalName, count + 1);
          
          zip.file(fileName, blob);
        } catch (error) {
          console.error(`Failed to add ${file.originalName} to zip:`, error);
          failedFiles.push(file.originalName);
        }
      }

      // Generate and download zip
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `files-${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Notify user of any failures
      if (failedFiles.length > 0) {
        alert(
          `Download completed with ${failedFiles.length} error(s).\n` +
          `Failed files: ${failedFiles.join(", ")}`
        );
      }
    } catch (error) {
      console.error("Bulk download error:", error);
      alert("Failed to download files. Please try again.");
    }
  };

  const categories = Object.keys(stats.combined.byCategory);
  const extensions = Object.keys(stats.combined.byExtension);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Sidebar
        onCategorySelect={setSelectedCategory}
        selectedCategory={selectedCategory}
        stats={stats}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-gradient-to-r from-gray-800/50 to-gray-800/30 backdrop-blur-xl border-b border-gray-700/50 shadow-lg">
          <div className="flex items-center justify-between p-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                My Files
              </h1>
              <p className="text-sm text-gray-400 mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-medium border border-blue-500/20">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                  {stats.combined.total} files
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-400">PostgreSQL & MongoDB</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={toggleSelectionMode}
                className={`px-5 py-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 font-medium shadow-lg ${
                  selectionMode
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white border border-blue-500/50 shadow-blue-500/50 scale-105"
                    : "bg-gray-800/50 border border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500 hover:scale-105"
                }`}
              >
                {selectionMode ? <CheckSquare size={20} /> : <Square size={20} />}
                {selectionMode ? "Exit Select" : "Select"}
              </button>
              <button
                onClick={() => {
                  fetchFiles();
                  fetchStats();
                }}
                className="px-5 py-2.5 bg-gray-800/50 border border-gray-600/50 text-gray-300 rounded-xl hover:bg-gray-700/50 hover:border-gray-500 transition-all duration-300 flex items-center gap-2 font-medium hover:scale-105 shadow-lg"
              >
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 active:scale-95 transition-all duration-300 flex gap-2 font-medium shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/50 hover:scale-105"
              >
                <Upload size={20} />
                Upload Files
              </button>
            </div>
          </div>
        </header>

        <SearchBar
          onSearch={handleSearch}
          categories={categories}
          extensions={extensions}
        />

        {/* Bulk Actions Bar */}
        {selectionMode && selectedFiles.length > 0 && (
          <div className="bg-gradient-to-r from-blue-900/30 via-purple-900/30 to-blue-900/30 backdrop-blur-sm border-y border-blue-500/30 px-6 py-4 shadow-lg animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <CheckSquare size={16} className="text-blue-400" />
                  </div>
                  <span className="text-sm font-semibold text-gray-200">
                    {selectedFiles.length} file(s) selected
                  </span>
                </div>
                <div className="flex items-center gap-3 pl-6 border-l border-gray-600/50">
                  <button
                    onClick={selectAll}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-all duration-200 hover:scale-105 font-medium"
                  >
                    Select All ({filteredFiles.length})
                  </button>
                  <span className="text-gray-600">•</span>
                  <button
                    onClick={deselectAll}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-all duration-200 hover:scale-105 font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleBulkDownload}
                  className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all duration-300 flex items-center gap-2 font-medium shadow-lg shadow-green-500/30 hover:scale-105 hover:shadow-xl hover:shadow-green-500/40"
                >
                  <Download size={18} />
                  Download ({selectedFiles.length})
                </button>
                <button
                  onClick={() => setMergeModalOpen(true)}
                  disabled={selectedFiles.filter((f) => f.extension === "json").length < 2}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 flex items-center gap-2 font-medium shadow-lg shadow-purple-500/30 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/40"
                  title={
                    selectedFiles.filter((f) => f.extension === "json").length < 2
                      ? "Select at least 2 JSON files to merge"
                      : "Merge JSON files"
                  }
                >
                  <GitMerge size={18} />
                  Merge JSON
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl hover:from-red-500 hover:to-rose-500 transition-all duration-300 flex items-center gap-2 font-medium shadow-lg shadow-red-500/30 hover:scale-105 hover:shadow-xl hover:shadow-red-500/40"
                >
                  <Trash2 size={18} />
                  Delete ({selectedFiles.length})
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-96 space-y-6">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-700"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 absolute top-0 left-0"></div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-gray-300">Loading your files...</p>
                <p className="text-sm text-gray-500">Please wait a moment</p>
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"></div>
                <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-3xl border border-gray-700/50 shadow-2xl">
                  <Upload size={64} className="text-blue-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-gray-200 to-gray-400 bg-clip-text text-transparent">
                No files found
              </h3>
              <p className="text-sm mb-6 text-gray-500">
                Upload your first file to get started
              </p>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 transition-all duration-300 font-medium shadow-lg shadow-blue-500/50 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/50"
              >
                Upload Files
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-200 flex items-center gap-3">
                  <span className="text-2xl">{selectedCategory || "All Files"}</span>
                  <span className="px-3 py-1 bg-gray-800/50 border border-gray-700/50 rounded-full text-sm text-gray-400 font-medium">
                    {filteredFiles.length}
                  </span>
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                {filteredFiles.map((file, index) => (
                  <div
                    key={`${file.storageType}-${file.id}`}
                    className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <FileCard
                      file={file}
                      onPreview={setPreviewFile}
                      onDelete={handleDelete}
                      onRename={handleRename}
                      selectionMode={selectionMode}
                      isSelected={selectedFiles.some(
                        (f) => f.id === file.id && f.storageType === file.storageType
                      )}
                      onSelect={handleFileSelect}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      <JsonMergeModal
        isOpen={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
        files={selectedFiles}
        onMergeComplete={() => {
          fetchFiles();
          fetchStats();
          setSelectedFiles([]);
        }}
      />
    </div>
  );
}
