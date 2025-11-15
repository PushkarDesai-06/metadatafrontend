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

      // Fetch all files and add to zip
      for (const file of selectedFiles) {
        try {
          const response = await fetch(file.filePath);
          const blob = await response.blob();
          zip.file(file.originalName, blob);
        } catch (error) {
          console.error(`Failed to add ${file.originalName} to zip:`, error);
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
    } catch (error) {
      console.error("Bulk download error:", error);
      alert("Failed to download files. Please try again.");
    }
  };

  const categories = Object.keys(stats.combined.byCategory);
  const extensions = Object.keys(stats.combined.byExtension);

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar
        onCategorySelect={setSelectedCategory}
        selectedCategory={selectedCategory}
        stats={stats}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">My Files</h1>
              <p className="text-sm text-gray-400 mt-1">
                {stats.combined.total} total files across PostgreSQL and MongoDB
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={toggleSelectionMode}
                className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
                  selectionMode
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-600 text-gray-300 hover:bg-gray-700"
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
                className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw size={20} />
                Refresh
              </button>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all flex gap-2 font-medium shadow-sm hover:shadow"
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
          <div className="bg-blue-900/20 border-y border-blue-800 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-200">
                  {selectedFiles.length} file(s) selected
                </span>
                <button
                  onClick={selectAll}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Select All ({filteredFiles.length})
                </button>
                <button
                  onClick={deselectAll}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Deselect All
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkDownload}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Download size={18} />
                  Download ({selectedFiles.length})
                </button>
                <button
                  onClick={() => setMergeModalOpen(true)}
                  disabled={selectedFiles.filter((f) => f.extension === "json").length < 2}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Delete ({selectedFiles.length})
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Upload size={64} className="mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold mb-2 text-gray-300">
                No files found
              </h3>
              <p className="text-sm mb-4">
                Upload your first file to get started
              </p>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Files
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-200">
                  {selectedCategory || "All Files"} ({filteredFiles.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredFiles.map((file) => (
                  <FileCard
                    key={`${file.storageType}-${file.id}`}
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
