"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, X, FileJson } from "lucide-react";
import EditableFileItem from "./EditableFileItem";
import TagManager from "./TagManager";
import JsonSchemaPreview from "./JsonSchemaPreview";
import JsonInputModal from "./JsonInputModal";
import JsonAnalysisCard from "./JsonAnalysisCard";
import { analyzeJsonStructure, StructureAnalysis } from "@/lib/json-analyzer";

type UploadTab = "files" | "json";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface FileWithName {
  file: File;
  customName: string;
}

export default function UploadModal({
  isOpen,
  onClose,
  onUploadComplete,
}: UploadModalProps) {
  const [filesWithNames, setFilesWithNames] = useState<FileWithName[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [jsonPreview, setJsonPreview] = useState<{
    content: any;
    fileName: string;
    analysis?: StructureAnalysis;
    similarSchemas?: Array<{
      fileName: string;
      similarity: number;
      id: string;
    }>;
  } | null>(null);
  const [jsonInputOpen, setJsonInputOpen] = useState(false);
  const [pendingJsonFile, setPendingJsonFile] = useState<{
    content: any;
    fileName: string;
  } | null>(null);
  const [invalidJsonData, setInvalidJsonData] = useState<{
    rawText: string;
    fileName: string;
    error: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<UploadTab>("files");

  useEffect(() => {
    if (pendingJsonFile) {
      confirmJsonUpload();
    }
  }, [pendingJsonFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const processJsonFile = async (file: File) => {
    const text = await file.text();
    try {
      const jsonContent = JSON.parse(text);
      setPendingJsonFile({ content: jsonContent, fileName: file.name });
    } catch (e) {
      // Open JSON editor with the invalid content and error message
      const errorMsg = e instanceof Error ? e.message : "Invalid JSON format";
      const errorMatch = errorMsg.match(/position (\d+)/);
      const errorPosition = errorMatch ? parseInt(errorMatch[1]) : null;

      // Calculate line and column from position
      let errorLine = 1;
      let errorCol = 1;
      if (errorPosition !== null) {
        const beforeError = text.substring(0, errorPosition);
        errorLine = (beforeError.match(/\n/g) || []).length + 1;
        const lastNewline = beforeError.lastIndexOf("\n");
        errorCol = errorPosition - (lastNewline >= 0 ? lastNewline : 0);
      }

      const detailedError = `Parse error at line ${errorLine}, column ${errorCol}: ${errorMsg}`;

      // Open editor with invalid JSON
      setInvalidJsonData({
        rawText: text,
        fileName: file.name,
        error: detailedError,
      });
      setJsonInputOpen(true);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      for (const file of newFiles) {
        if (file.name.endsWith(".json")) {
          await processJsonFile(file);
        } else {
          setFilesWithNames((prev) => [
            ...prev,
            { file, customName: file.name },
          ]);
        }
      }
    }
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      for (const file of newFiles) {
        if (file.name.endsWith(".json")) {
          await processJsonFile(file);
        } else {
          setFilesWithNames((prev) => [
            ...prev,
            { file, customName: file.name },
          ]);
        }
      }
    }
  };

  const removeFile = (index: number) => {
    setFilesWithNames((prev) => prev.filter((_, i) => i !== index));
  };

  const renameFile = (index: number, newName: string) => {
    setFilesWithNames((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, customName: newName } : item
      )
    );
  };

  const handleJsonInput = (jsonData: any, fileName: string) => {
    setPendingJsonFile({ content: jsonData, fileName });
  };

  const confirmJsonUpload = async () => {
    if (!pendingJsonFile) return;

    // Analyze JSON structure
    const analysis = analyzeJsonStructure(pendingJsonFile.content);

    // Check for similar schemas in existing files
    const similarSchemas = await checkSimilarSchemas(pendingJsonFile.content);

    if (similarSchemas.length > 0) {
      setJsonPreview({
        content: pendingJsonFile.content,
        fileName: pendingJsonFile.fileName,
        analysis,
        similarSchemas,
      });
      setPendingJsonFile(null);
    } else {
      // No similar schemas, show preview without merge options
      setJsonPreview({
        content: pendingJsonFile.content,
        fileName: pendingJsonFile.fileName,
        analysis,
        similarSchemas: [],
      });
      setPendingJsonFile(null);
    }
  };

  const checkSimilarSchemas = async (
    jsonContent: any
  ): Promise<Array<{ fileName: string; similarity: number; id: string }>> => {
    try {
      console.log("=== MERGE DETECTION START ===");
      console.log("Incoming JSON content:", jsonContent);

      const response = await fetch("/api/files?category=Data&extension=json");
      if (!response.ok) {
        console.log("Failed to fetch existing files:", response.status);
        return [];
      }

      const data = await response.json();
      const existingJsonFiles = data.files || [];
      console.log(`Found ${existingJsonFiles.length} existing JSON files`);

      const similar: Array<{
        fileName: string;
        similarity: number;
        id: string;
      }> = [];

      // Extract schema signature from incoming JSON
      const incomingType = Array.isArray(jsonContent)
        ? "array"
        : typeof jsonContent;
      const incomingKeys = Array.isArray(jsonContent)
        ? jsonContent.length > 0 && typeof jsonContent[0] === "object"
          ? Object.keys(jsonContent[0]).sort()
          : []
        : typeof jsonContent === "object" && jsonContent !== null
        ? Object.keys(jsonContent).sort()
        : [];

      console.log("Incoming type:", incomingType);
      console.log("Incoming keys:", incomingKeys);

      // Check each existing file
      for (const file of existingJsonFiles) {
        console.log(`\n--- Checking file: ${file.originalName} ---`);
        console.log("File ID:", file.id);
        console.log("Storage type:", file.storageType);

        try {
          // Fetch actual JSON file content via API
          const fileResponse = await fetch(
            `/api/files/content/${file.id}?storageType=${file.storageType}`
          );
          if (!fileResponse.ok) {
            console.log(`Failed to fetch file content: ${fileResponse.status}`);
            continue;
          }

          const fileContent = await fileResponse.json();
          console.log("File content loaded:", fileContent);

          // Extract schema signature from existing file
          const fileType = Array.isArray(fileContent)
            ? "array"
            : typeof fileContent;
          const fileKeys = Array.isArray(fileContent)
            ? fileContent.length > 0 && typeof fileContent[0] === "object"
              ? Object.keys(fileContent[0]).sort()
              : []
            : typeof fileContent === "object" && fileContent !== null
            ? Object.keys(fileContent).sort()
            : [];

          console.log("File type:", fileType);
          console.log("File keys:", fileKeys);

          // Only compare if types match
          if (incomingType !== fileType) {
            console.log(`Type mismatch: ${incomingType} !== ${fileType}`);
            continue;
          }

          // Skip if no keys to compare
          if (incomingKeys.length === 0 || fileKeys.length === 0) {
            console.log("No keys to compare (empty arrays or primitives)");
            continue;
          }

          // Calculate similarity based on key overlap
          const intersection = incomingKeys.filter((k) => fileKeys.includes(k));
          const union = new Set([...incomingKeys, ...fileKeys]);
          const similarity = (intersection.length / union.size) * 100;

          console.log("Intersection:", intersection);
          console.log("Union size:", union.size);
          console.log("Similarity:", similarity + "%");

          if (similarity >= 60) {
            console.log(`✓ Match found! Adding to similar files`);
            similar.push({
              fileName: file.originalName,
              similarity,
              id: file.id,
            });
          } else {
            console.log(`✗ Similarity ${similarity}% below 60% threshold`);
          }
        } catch (err) {
          console.error(`Failed to load file ${file.originalName}:`, err);
          continue;
        }
      }

      console.log(`\n=== MERGE DETECTION COMPLETE ===`);
      console.log(`Found ${similar.length} similar files`);
      console.log("Similar files:", similar);

      return similar;
    } catch (error) {
      console.error("Error checking similar schemas:", error);
      return [];
    }
  };

  const handleJsonPreviewConfirm = async (mergeWithId?: string) => {
    if (!jsonPreview) return;

    // If merging with existing file
    if (mergeWithId) {
      try {
        // Find the storage type from similar schemas
        const targetSchema = jsonPreview.similarSchemas?.find(
          (s) => s.id === mergeWithId
        );
        if (!targetSchema) {
          alert("Target file not found for merge");
          return;
        }

        // Determine storage type by fetching the file
        const filesResponse = await fetch(
          "/api/files?category=Data&extension=json"
        );
        const filesData = await filesResponse.json();
        const targetFile = filesData.files.find(
          (f: any) => f.id === mergeWithId
        );

        if (!targetFile) {
          alert("Target file not found");
          return;
        }

        const response = await fetch(`/api/files/${mergeWithId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storageType: targetFile.storageType,
            mergeData: jsonPreview.content,
          }),
        });

        if (response.ok) {
          alert(`Data merged successfully with ${targetSchema.fileName}`);
          setJsonPreview(null);
          onUploadComplete();
        } else {
          const error = await response.json();
          alert(`Merge failed: ${error.error}`);
        }
      } catch (error) {
        console.error("Merge error:", error);
        alert("Merge failed. Please try again.");
      }
    } else {
      // Create file and add to upload list
      const jsonString = JSON.stringify(jsonPreview.content, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const file = new File([blob], jsonPreview.fileName, {
        type: "application/json",
      });
      setFilesWithNames((prev) => [
        ...prev,
        { file, customName: jsonPreview.fileName },
      ]);
      setJsonPreview(null);
    }
  };

  const handleUpload = async () => {
    if (filesWithNames.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();

      // Create renamed files
      for (const { file, customName } of filesWithNames) {
        const renamedFile = new File([file], customName, { type: file.type });
        formData.append("files", renamedFile);
      }

      formData.append("tags", tags.join(","));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setFilesWithNames([]);
        setTags([]);
        onUploadComplete();
        onClose();
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
          <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gradient-to-r from-gray-900 to-gray-800">
            <h2 className="text-2xl font-bold text-gray-100">Upload Files</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded-lg p-1.5 transition-all"
            >
              <X size={24} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 bg-gray-900">
            <button
              onClick={() => setActiveTab("files")}
              className={`flex-1 py-3 px-4 font-medium text-sm transition-all relative ${
                activeTab === "files"
                  ? "text-blue-400 bg-gray-800"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              <Upload className="inline-block mr-2" size={18} />
              File Upload
              {activeTab === "files" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab("json")}
              className={`flex-1 py-3 px-4 font-medium text-sm transition-all relative ${
                activeTab === "json"
                  ? "text-blue-400 bg-gray-800"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              <FileJson className="inline-block mr-2" size={18} />
              JSON Input
              {activeTab === "json" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "files" ? (
              <>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    dragActive
                      ? "border-blue-500 bg-blue-900/20 shadow-inner"
                      : "border-gray-600 hover:border-gray-500 hover:bg-gray-700/50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload
                    className={`mx-auto mb-4 ${
                      dragActive ? "text-blue-400" : "text-gray-500"
                    }`}
                    size={48}
                  />
                  <p className="text-lg font-medium text-gray-200 mb-2">
                    Drag and drop files here
                  </p>
                  <p className="text-sm text-gray-400 mb-4">or</p>
                  <label className="inline-block">
                    <span className="px-6 py-2.5 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium shadow-sm hover:shadow">
                      Browse Files
                    </span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </div>

                {filesWithNames.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold text-gray-200 mb-3">
                      Selected Files ({filesWithNames.length})
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-900 rounded-lg p-3 border border-gray-700">
                      {filesWithNames.map((item, index) => (
                        <EditableFileItem
                          key={index}
                          file={item.file}
                          index={index}
                          onRemove={removeFile}
                          onRename={renameFile}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <TagManager
                    tags={tags}
                    onTagsChange={setTags}
                    suggestions={[
                      "important",
                      "project",
                      "work",
                      "personal",
                      "2024",
                    ]}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 rounded-xl p-6 border border-blue-800">
                  <h3 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
                    <FileJson className="text-blue-400" size={20} />
                    Enter JSON Data
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Type or paste your JSON data directly, or format existing
                    text into JSON.
                  </p>
                  <button
                    onClick={() => setJsonInputOpen(true)}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium shadow-sm hover:shadow"
                  >
                    Open JSON Editor
                  </button>
                </div>

                <div className="mt-6">
                  <TagManager
                    tags={tags}
                    onTagsChange={setTags}
                    suggestions={[
                      "important",
                      "project",
                      "work",
                      "personal",
                      "2024",
                    ]}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-700 bg-gray-900 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 border-2 border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 hover:border-gray-500 active:bg-gray-600 transition-all font-medium"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={filesWithNames.length === 0 || uploading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow"
            >
              {uploading
                ? "Uploading..."
                : `Upload ${filesWithNames.length} file(s)`}
            </button>
          </div>
        </div>
      </div>

      {jsonInputOpen && (
        <JsonInputModal
          isOpen={jsonInputOpen}
          onClose={() => {
            setJsonInputOpen(false);
            setInvalidJsonData(null);
          }}
          onSubmit={handleJsonInput}
          initialContent={invalidJsonData?.rawText}
          initialFileName={invalidJsonData?.fileName}
          initialError={invalidJsonData?.error}
        />
      )}

      {jsonPreview && (
        <>
          {jsonPreview.analysis && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6 border-b border-gray-700">
                  <h2 className="text-xl font-bold text-gray-100">
                    JSON Structure Analysis
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    See how your data will be stored
                  </p>
                </div>

                <div className="p-6">
                  <JsonAnalysisCard
                    analysis={jsonPreview.analysis}
                    filename={jsonPreview.fileName}
                  />

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => {
                        setJsonPreview(null);
                      }}
                      className="flex-1 px-6 py-2.5 border-2 border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const preview = jsonPreview;
                        setJsonPreview(null);
                        // Continue to schema preview if there are similar schemas
                        if (
                          preview.similarSchemas &&
                          preview.similarSchemas.length > 0
                        ) {
                          // Show schema preview without analysis modal
                          setJsonPreview({ ...preview, analysis: undefined });
                        } else {
                          // No similar schemas, directly upload
                          handleJsonPreviewConfirm();
                        }
                      }}
                      className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <JsonSchemaPreview
            jsonContent={jsonPreview.content}
            fileName={jsonPreview.fileName}
            similarSchemas={jsonPreview.similarSchemas}
            onConfirm={handleJsonPreviewConfirm}
            onCancel={() => setJsonPreview(null)}
          />
        </>
      )}
    </>
  );
}
