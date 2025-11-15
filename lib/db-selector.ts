import { getFileExtension, getFileCategory } from "./utils";
import { analyzeJsonStructure, getAnalysisSummary } from "./json-analyzer";

/**
 * Intelligent database selector based on file characteristics
 *
 * Logic for JSON files:
 * - Analyzes structure: nesting depth, schema consistency, field variance, data sparseity
 * - Tabular/flat data with consistent schema → PostgreSQL (better for queries)
 * - Deeply nested/inconsistent schema/sparse data → MongoDB (better for flexibility)
 *
 * Other files:
 * - Images/Videos/Audio: PostgreSQL (ACID compliance for metadata)
 * - Large files (>1MB): MongoDB (better scalability)
 * - Default: PostgreSQL
 */
export function selectDatabase(
  file: {
    filename: string;
    size: number;
    mimeType: string;
    content?: any;
  },
  options?: {
    logAnalysis?: boolean;
  }
): "postgres" | "mongodb" {
  const extension = getFileExtension(file.filename);
  const category = getFileCategory(extension);

  // For JSON files, use detailed structure analysis
  if (extension === "json" && file.content) {
    const analysis = analyzeJsonStructure(file.content);

    if (options?.logAnalysis) {
      console.log("\n" + getAnalysisSummary(analysis));
    }

    return analysis.recommendedStorage;
  }

  // Large JSON or structured data files go to MongoDB
  if (file.mimeType.includes("json") && file.size > 1024 * 1024) {
    // > 1MB
    return "mongodb";
  }

  // Files with complex nested metadata go to MongoDB
  if (file.content && typeof file.content === "object") {
    const depth = getObjectDepth(file.content);
    if (depth > 3) {
      return "mongodb";
    }
  }

  // Data category (JSON, XML, YAML) - MongoDB
  if (category === "Data") {
    return "mongodb";
  }

  // Binary files (Images, Videos, Audio) - PostgreSQL for better ACID compliance
  if (["Images", "Videos", "Audio"].includes(category)) {
    return "postgres";
  }

  // Default to PostgreSQL for structured metadata and relational queries
  return "postgres";
}

function getObjectDepth(obj: any): number {
  if (typeof obj !== "object" || obj === null) {
    return 0;
  }

  let maxDepth = 0;
  for (const key in obj) {
    const depth = getObjectDepth(obj[key]);
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth + 1;
}

/**
 * Analyze batch upload and determine optimal database
 */
export function selectDatabaseForBatch(
  files: Array<{
    filename: string;
    size: number;
    mimeType: string;
  }>
): "postgres" | "mongodb" {
  const extensions = files.map((f) => getFileExtension(f.filename));
  const categories = extensions.map((ext) => getFileCategory(ext));

  // If majority are JSON/Data files, use MongoDB
  const dataFilesCount = categories.filter((cat) => cat === "Data").length;
  if (dataFilesCount > files.length / 2) {
    return "mongodb";
  }

  // If all files are same type (images/videos), use PostgreSQL
  const uniqueCategories = new Set(categories);
  if (
    uniqueCategories.size === 1 &&
    ["Images", "Videos", "Audio"].includes(Array.from(uniqueCategories)[0])
  ) {
    return "postgres";
  }

  // Default to PostgreSQL for mixed batches
  return "postgres";
}
