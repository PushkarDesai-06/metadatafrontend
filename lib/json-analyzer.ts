/**
 * JSON Structure Analyzer
 * Analyzes JSON structure to determine if it's better suited for SQL or NoSQL storage
 */

export interface StructureAnalysis {
  // Core metrics
  nestingDepth: number;
  schemaConsistency: number; // 0-100, higher = more consistent
  fieldVariance: number; // 0-100, higher = more variance
  dataSparseity: number; // 0-100, higher = more sparse
  mixedTypes: boolean;

  // Data characteristics
  isTabular: boolean; // Array of objects with same fields
  isFlat: boolean; // Max depth <= 2
  isDeeplyNested: boolean; // Depth > 3
  hasArrays: boolean;
  hasNestedArrays: boolean;

  // Counts
  totalFields: number;
  uniqueFieldNames: number;
  arrayCount: number;
  objectCount: number;

  // Recommendation
  recommendedStorage: "postgres" | "mongodb";
  confidence: number; // 0-100
  reasoning: string[];
}

export function analyzeJsonStructure(data: any): StructureAnalysis {
  const analysis: StructureAnalysis = {
    nestingDepth: 0,
    schemaConsistency: 0,
    fieldVariance: 0,
    dataSparseity: 0,
    mixedTypes: false,
    isTabular: false,
    isFlat: false,
    isDeeplyNested: false,
    hasArrays: false,
    hasNestedArrays: false,
    totalFields: 0,
    uniqueFieldNames: 0,
    arrayCount: 0,
    objectCount: 0,
    recommendedStorage: "postgres",
    confidence: 0,
    reasoning: [],
  };

  // Calculate nesting depth
  analysis.nestingDepth = calculateDepth(data);
  analysis.isFlat = analysis.nestingDepth <= 2;
  analysis.isDeeplyNested = analysis.nestingDepth > 3;

  // Analyze structure type
  if (Array.isArray(data)) {
    analyzeArray(data, analysis);
  } else if (typeof data === "object" && data !== null) {
    analyzeObject(data, analysis);
  }

  // Determine recommendation
  determineRecommendation(analysis);

  return analysis;
}

function calculateDepth(obj: any, currentDepth = 0): number {
  if (typeof obj !== "object" || obj === null) {
    return currentDepth;
  }

  let maxDepth = currentDepth;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const depth = calculateDepth(item, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  } else {
    for (const key in obj) {
      const depth = calculateDepth(obj[key], currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  }

  return maxDepth;
}

function analyzeArray(arr: any[], analysis: StructureAnalysis) {
  analysis.hasArrays = true;
  analysis.arrayCount++;

  if (arr.length === 0) {
    analysis.isTabular = false;
    return;
  }

  // Check if it's an array of objects (tabular data)
  const allObjects = arr.every(
    (item) => typeof item === "object" && item !== null && !Array.isArray(item)
  );

  if (allObjects && arr.length > 0) {
    // Analyze schema consistency
    const schemas = arr.map((item) => Object.keys(item).sort().join(","));
    const uniqueSchemas = new Set(schemas);

    analysis.schemaConsistency =
      ((arr.length - uniqueSchemas.size + 1) / arr.length) * 100;
    analysis.isTabular = analysis.schemaConsistency > 80; // 80%+ same schema = tabular

    // Analyze field variance
    const allFields = new Set<string>();
    const fieldCounts = new Map<string, number>();

    arr.forEach((item) => {
      Object.keys(item).forEach((field) => {
        allFields.add(field);
        fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
      });
    });

    analysis.totalFields = Array.from(fieldCounts.values()).reduce(
      (a, b) => a + b,
      0
    );
    analysis.uniqueFieldNames = allFields.size;

    // Field variance: how many fields are not present in all objects
    const inconsistentFields = Array.from(fieldCounts.values()).filter(
      (count) => count < arr.length
    ).length;
    analysis.fieldVariance = (inconsistentFields / allFields.size) * 100;

    // Data sparseity: percentage of null/undefined values
    let nullCount = 0;
    let totalValues = 0;
    arr.forEach((item) => {
      Object.values(item).forEach((value) => {
        totalValues++;
        if (value === null || value === undefined) {
          nullCount++;
        }
      });
    });
    analysis.dataSparseity =
      totalValues > 0 ? (nullCount / totalValues) * 100 : 0;

    // Check for mixed types in same field
    const fieldTypes = new Map<string, Set<string>>();
    arr.forEach((item) => {
      Object.entries(item).forEach(([field, value]) => {
        if (!fieldTypes.has(field)) {
          fieldTypes.set(field, new Set());
        }
        fieldTypes
          .get(field)!
          .add(Array.isArray(value) ? "array" : typeof value);
      });
    });

    analysis.mixedTypes = Array.from(fieldTypes.values()).some(
      (types) => types.size > 1
    );

    // Check for nested arrays
    arr.forEach((item) => {
      if (hasNestedArrays(item)) {
        analysis.hasNestedArrays = true;
      }
    });
  }

  // Recursively analyze nested structures
  arr.forEach((item) => {
    if (typeof item === "object" && item !== null) {
      analysis.objectCount++;
      countStructures(item, analysis);
    }
  });
}

function analyzeObject(obj: any, analysis: StructureAnalysis) {
  analysis.objectCount++;

  const keys = Object.keys(obj);
  analysis.uniqueFieldNames = keys.length;

  // Check for arrays within object
  let hasArrayValues = false;
  for (const key in obj) {
    if (Array.isArray(obj[key])) {
      hasArrayValues = true;
      analysis.hasArrays = true;
      analysis.arrayCount++;

      // Recursively analyze the array
      if (obj[key].length > 0) {
        analyzeArray(obj[key], analysis);
      }
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      countStructures(obj[key], analysis);
    }
  }

  // Check if object is flat (no nested objects/arrays)
  const hasNestedStructures = Object.values(obj).some(
    (v) => typeof v === "object" && v !== null
  );

  if (!hasNestedStructures) {
    analysis.isFlat = true;
  }
}

function countStructures(obj: any, analysis: StructureAnalysis) {
  if (Array.isArray(obj)) {
    analysis.arrayCount++;
    obj.forEach((item) => {
      if (typeof item === "object" && item !== null) {
        countStructures(item, analysis);
      }
    });
  } else if (typeof obj === "object" && obj !== null) {
    analysis.objectCount++;
    Object.values(obj).forEach((value) => {
      if (typeof value === "object" && value !== null) {
        countStructures(value, analysis);
      }
    });
  }
}

function hasNestedArrays(obj: any): boolean {
  if (Array.isArray(obj)) {
    return obj.some(
      (item) =>
        Array.isArray(item) ||
        (typeof item === "object" && item !== null && hasNestedArrays(item))
    );
  }

  if (typeof obj === "object" && obj !== null) {
    return Object.values(obj).some((value) => hasNestedArrays(value));
  }

  return false;
}

function determineRecommendation(analysis: StructureAnalysis) {
  const reasons: string[] = [];
  let sqlScore = 0;
  let mongoScore = 0;

  // Factor 1: Nesting depth (weight: 30) - INCREASED weight
  if (analysis.isDeeplyNested) {
    mongoScore += 30;
    reasons.push(
      `Deep nesting (${analysis.nestingDepth} levels) - MongoDB handles nested documents better`
    );
  } else if (analysis.isFlat) {
    sqlScore += 25;
    reasons.push(
      `Flat structure (${analysis.nestingDepth} levels) - PostgreSQL JSONB is efficient for this`
    );
  } else {
    sqlScore += 12;
    mongoScore += 13;
    reasons.push(
      `Moderate nesting (${analysis.nestingDepth} levels) - Both databases can handle this`
    );
  }

  // CRITICAL: If deeply nested, heavily favor MongoDB regardless of other factors
  if (analysis.nestingDepth >= 5) {
    mongoScore += 20; // Extra bonus for very deep nesting
    reasons.push(
      `Very deep nesting (${analysis.nestingDepth} levels) - Relational DB would be inefficient`
    );
  }

  // CRITICAL: Nested arrays are a strong MongoDB indicator
  if (analysis.hasNestedArrays) {
    mongoScore += 15; // Strong signal for document DB
    reasons.push(
      `Nested arrays detected - MongoDB's document model handles this naturally`
    );
  }

  // Factor 2: Tabular structure (weight: 25) - DECREASED weight
  if (analysis.isTabular && !analysis.isDeeplyNested) {
    // Only favor SQL if BOTH tabular AND not deeply nested
    sqlScore += 25;
    reasons.push(
      `Tabular data with ${analysis.schemaConsistency.toFixed(
        1
      )}% schema consistency - Ideal for relational DB`
    );
  } else if (analysis.schemaConsistency < 50) {
    mongoScore += 25;
    reasons.push(
      `Inconsistent schema (${analysis.schemaConsistency.toFixed(
        1
      )}% consistency) - MongoDB's flexible schema is better`
    );
  } else if (analysis.isDeeplyNested) {
    // Tabular but deeply nested = still MongoDB
    mongoScore += 15;
    reasons.push(
      `Consistent top-level schema but deeply nested - Document DB better for complex structure`
    );
  } else {
    sqlScore += 12;
    mongoScore += 13;
    reasons.push(
      `Moderate schema consistency (${analysis.schemaConsistency.toFixed(1)}%)`
    );
  }

  // Factor 3: Field variance (weight: 20)
  if (analysis.fieldVariance > 40) {
    mongoScore += 20;
    reasons.push(
      `High field variance (${analysis.fieldVariance.toFixed(
        1
      )}%) - MongoDB handles optional fields better`
    );
  } else if (analysis.fieldVariance < 15) {
    sqlScore += 20;
    reasons.push(
      `Low field variance (${analysis.fieldVariance.toFixed(
        1
      )}%) - Consistent structure suits SQL`
    );
  } else {
    sqlScore += 10;
    mongoScore += 10;
  }

  // Factor 4: Data sparseity (weight: 15)
  if (analysis.dataSparseity > 30) {
    mongoScore += 15;
    reasons.push(
      `Sparse data (${analysis.dataSparseity.toFixed(
        1
      )}% null values) - MongoDB saves space`
    );
  } else {
    sqlScore += 15;
    reasons.push(
      `Dense data (${analysis.dataSparseity.toFixed(
        1
      )}% null values) - SQL handles well`
    );
  }

  // Factor 5: Mixed types (weight: 10)
  if (analysis.mixedTypes) {
    mongoScore += 10;
    reasons.push(
      "Mixed field types detected - MongoDB's schema-less nature is advantageous"
    );
  } else {
    sqlScore += 10;
    reasons.push("Consistent field types - SQL type safety is beneficial");
  }

  // Factor 6: Structural complexity (NEW - weight: 15)
  const avgObjectsPerItem =
    analysis.totalFields > 0
      ? analysis.objectCount / Math.max(1, analysis.totalFields)
      : 0;
  const avgArraysPerItem =
    analysis.totalFields > 0
      ? analysis.arrayCount / Math.max(1, analysis.totalFields)
      : 0;

  if (analysis.objectCount > 20 || analysis.arrayCount > 10) {
    mongoScore += 15;
    reasons.push(
      `High structural complexity (${analysis.objectCount} nested objects, ${analysis.arrayCount} arrays) - Document DB excels here`
    );
  } else if (analysis.objectCount < 5 && analysis.arrayCount < 3) {
    sqlScore += 15;
  }

  // Determine recommendation
  const totalScore = sqlScore + mongoScore;
  const mongoConfidence = (mongoScore / totalScore) * 100;
  const sqlConfidence = (sqlScore / totalScore) * 100;

  if (mongoScore > sqlScore) {
    analysis.recommendedStorage = "mongodb";
    analysis.confidence = mongoConfidence;
  } else {
    analysis.recommendedStorage = "postgres";
    analysis.confidence = sqlConfidence;
  }

  analysis.reasoning = reasons;
}

/**
 * Get a human-readable summary of the analysis
 */
export function getAnalysisSummary(analysis: StructureAnalysis): string {
  const lines = [
    `📊 JSON Structure Analysis`,
    ``,
    `Structure Metrics:`,
    `  • Nesting depth: ${analysis.nestingDepth} level(s)`,
    `  • Schema consistency: ${analysis.schemaConsistency.toFixed(1)}%`,
    `  • Field variance: ${analysis.fieldVariance.toFixed(1)}%`,
    `  • Data sparseity: ${analysis.dataSparseity.toFixed(1)}%`,
    `  • Complexity: ${analysis.objectCount} objects, ${analysis.arrayCount} arrays`,
    ``,
    `Characteristics:`,
    `  • Tabular: ${analysis.isTabular ? "Yes" : "No"}`,
    `  • Flat structure: ${analysis.isFlat ? "Yes" : "No"}`,
    `  • Deeply nested: ${analysis.isDeeplyNested ? "Yes" : "No"}`,
    `  • Mixed types: ${analysis.mixedTypes ? "Yes" : "No"}`,
    `  • Nested arrays: ${analysis.hasNestedArrays ? "Yes" : "No"}`,
    ``,
    `📍 Recommendation: ${analysis.recommendedStorage.toUpperCase()}`,
    `   Confidence: ${analysis.confidence.toFixed(1)}%`,
    ``,
    `Reasoning:`,
    ...analysis.reasoning.map((r) => `  • ${r}`),
  ];

  return lines.join("\n");
}
