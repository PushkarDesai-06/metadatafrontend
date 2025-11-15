"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Table2, FileJson, ExternalLink } from "lucide-react";

interface JsonTableViewerProps {
  data: any;
  title?: string;
  storageType?: "postgres" | "mongodb";
}

export default function JsonTableViewer({
  data,
  title = "JSON Data",
  storageType,
}: JsonTableViewerProps) {
  // MongoDB data is locked to document view, PostgreSQL defaults to table view
  const defaultView = storageType === "mongodb" ? "document" : "table";
  const [viewMode, setViewMode] = useState<"table" | "document">(defaultView);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [displayLimit, setDisplayLimit] = useState(50);
  const [showAll, setShowAll] = useState(false);

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const renderTableView = () => {
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return (
          <div className="text-gray-400 text-center py-8">Empty array</div>
        );
      }

      // Get all unique keys from all objects
      const allKeys = new Set<string>();
      data.forEach((item) => {
        if (typeof item === "object" && item !== null) {
          Object.keys(item).forEach((key) => allKeys.add(key));
        }
      });
      const columns = Array.from(allKeys);

      const itemsToShow = showAll ? data : data.slice(0, displayLimit);
      const hasMore = data.length > displayLimit && !showAll;

      return (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y-2 divide-gray-700">
              <thead className="bg-gradient-to-r from-gray-900 to-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                    #
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {itemsToShow.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-400">
                      {idx}
                    </td>
                    {columns.map((col) => (
                      <td key={col} className="px-4 py-3 text-sm text-gray-200">
                        {renderCell(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="mt-4 text-center border-t border-gray-700 pt-4">
              <p className="text-sm text-gray-400 mb-3">
                Showing {displayLimit} of {data.length} items
              </p>
              <button
                onClick={() => setShowAll(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                Show All ({data.length} items)
              </button>
            </div>
          )}
          {showAll && data.length > displayLimit && (
            <div className="mt-4 text-center border-t border-gray-700 pt-4">
              <button
                onClick={() => setShowAll(false)}
                className="px-6 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors font-medium border border-gray-600"
              >
                Show Less
              </button>
            </div>
          )}
        </div>
      );
    } else if (typeof data === "object" && data !== null) {
      // Single object - render as key-value table
      const entries = Object.entries(data);
      const entriesToShow = showAll ? entries : entries.slice(0, displayLimit);
      const hasMore = entries.length > displayLimit && !showAll;

      return (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y-2 divide-gray-700">
              <thead className="bg-gradient-to-r from-gray-900 to-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider w-1/3">
                    Key
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider w-24">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {entriesToShow.map(([key, value]) => (
                  <tr key={key} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-200">
                      {key}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200">
                      {renderCell(value)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-gray-400">
                      {getValueType(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="mt-4 text-center border-t border-gray-700 pt-4">
              <p className="text-sm text-gray-400 mb-3">
                Showing {displayLimit} of {entries.length} properties
              </p>
              <button
                onClick={() => setShowAll(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                Show All ({entries.length} properties)
              </button>
            </div>
          )}
          {showAll && entries.length > displayLimit && (
            <div className="mt-4 text-center border-t border-gray-700 pt-4">
              <button
                onClick={() => setShowAll(false)}
                className="px-6 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors font-medium border border-gray-600"
              >
                Show Less
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-gray-400 text-center py-8">No data to display</div>
    );
  };

  const renderCell = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">null</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400">[]</span>;
      if (value.every((item) => typeof item !== "object")) {
        return <span className="text-blue-600">[{value.join(", ")}]</span>;
      }
      return <span className="text-purple-600">Array[{value.length}]</span>;
    }

    if (typeof value === "object") {
      return <span className="text-purple-600">Object</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-orange-600">{value.toString()}</span>;
    }

    if (typeof value === "number") {
      return <span className="text-blue-600">{value}</span>;
    }

    if (typeof value === "string") {
      return <span className="text-green-600">{value}</span>;
    }

    return String(value);
  };

  const getValueType = (value: any): string => {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  };

  const renderDocumentView = (obj: any, path = "", level = 0): React.ReactNode => {
    if (obj === null || obj === undefined) {
      return <span className="text-gray-400 italic">null</span>;
    }

    if (typeof obj !== "object") {
      return renderDocumentValue(obj);
    }

    const isExpanded = expandedPaths.has(path) || level === 0;
    const isArray = Array.isArray(obj);
    const entries = isArray ? obj.map((v, i) => [i, v]) : Object.entries(obj);

    const openBracket = isArray ? "[" : "{";
    const closeBracket = isArray ? "]" : "}";

    return (
      <div className={level > 0 ? "ml-4" : ""}>
        <div className="flex items-start gap-1">
          {entries.length > 0 && (
            <button
              onClick={() => toggleExpand(path)}
              className="text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded p-0.5 transition-colors mt-0.5 shrink-0"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <div className="flex-1 font-mono text-sm">
            <span className="text-gray-500">{openBracket}</span>
            {!isExpanded && entries.length > 0 && (
              <span className="text-gray-600 italic text-xs ml-2">
                {entries.length} {isArray ? "items" : "fields"}
              </span>
            )}
            {isExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                {entries.map(([key, value], idx) => {
                  const currentPath = path ? `${path}.${key}` : String(key);
                  const isObject = typeof value === "object" && value !== null;
                  const isLastItem = idx === entries.length - 1;

                  return (
                    <div key={key} className="flex items-start gap-2">
                      {!isArray && (
                        <span className="text-blue-400 shrink-0">"{key}":</span>
                      )}
                      <div className="flex-1">
                        {isObject
                          ? renderDocumentView(value, currentPath, level + 1)
                          : renderDocumentValue(value)}
                      </div>
                      {!isLastItem && <span className="text-gray-500">,</span>}
                    </div>
                  );
                })}
              </div>
            )}
            <span className="text-gray-500">{closeBracket}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderDocumentValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-purple-400 italic">null</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-orange-400">{value.toString()}</span>;
    }

    if (typeof value === "number") {
      return <span className="text-green-400">{value}</span>;
    }

    if (typeof value === "string") {
      return <span className="text-yellow-400">"{value}"</span>;
    }

    return <span className="text-gray-300">{String(value)}</span>;
  };

  const convertToCSV = (): string => {
    if (!Array.isArray(data) || data.length === 0) {
      return "";
    }

    // Get all unique keys from all objects
    const allKeys = new Set<string>();
    data.forEach((item) => {
      if (typeof item === "object" && item !== null) {
        Object.keys(item).forEach((key) => allKeys.add(key));
      }
    });
    const columns = Array.from(allKeys);

    // Create CSV header
    const header = columns.map(col => `"${col}"`).join(",");
    
    // Create CSV rows
    const rows = data.map((row) => {
      return columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) {
          return "";
        }
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(",");
    });

    return [header, ...rows].join("\n");
  };

  const downloadCSV = () => {
    const csv = convertToCSV();
    if (!csv) {
      alert("No data available to export");
      return;
    }

    // Create a data URI with CSV content
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    
    // Download the CSV file
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `${title.replace(/[^a-z0-9]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gray-800 rounded-xl border-2 border-gray-700 shadow-sm">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gradient-to-r from-gray-900 to-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-100">{title}</h3>
          {storageType && (
            <span
              className={`text-xs px-3 py-1 rounded-full font-semibold border-2 ${
                storageType === "mongodb"
                  ? "bg-green-900/30 text-green-300 border-green-500/40"
                  : "bg-blue-900/30 text-blue-300 border-blue-500/40"
              }`}
            >
              {storageType === "mongodb" ? "MongoDB" : "PostgreSQL"}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {/* Only show view toggle for PostgreSQL data */}
          {storageType === "postgres" && (
            <>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
                  viewMode === "table"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
                }`}
                title="Table View"
              >
                <Table2 size={16} />
                Table
              </button>
              <button
                onClick={() => setViewMode("document")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
                  viewMode === "document"
                    ? "bg-green-600 text-white shadow-lg shadow-green-500/30"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
                }`}
                title="Document View (BSON format)"
              >
                <FileJson size={16} />
                BSON
              </button>
            </>
          )}
          
          {/* MongoDB data only shows BSON label */}
          {storageType === "mongodb" && (
            <div className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium bg-green-600 text-white shadow-lg shadow-green-500/30">
              <FileJson size={16} />
              BSON Document
            </div>
          )}
          
          {/* CSV download button for PostgreSQL table data */}
          {storageType === "postgres" && viewMode === "table" && Array.isArray(data) && data.length > 0 && (
            <button
              onClick={downloadCSV}
              className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/30 hover:scale-105"
              title="Download as CSV file"
            >
              <ExternalLink size={16} />
              Download CSV
            </button>
          )}
        </div>
      </div>

      <div className="p-4 max-h-96 overflow-auto">
        {viewMode === "table" ? renderTableView() : (
          <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm border border-gray-700">
            {renderDocumentView(data)}
          </div>
        )}
      </div>
    </div>
  );
}
