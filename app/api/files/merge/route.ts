import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db/postgres";
import { connectMongoDB, FileModel } from "@/lib/db/mongodb";
import path from "path";
import { readFile, writeFile } from "fs/promises";

type MergeStrategy = "shallow" | "deep" | "override" | "combine";

// Deep merge function
function deepMerge(obj1: any, obj2: any): any {
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
}

async function getFileData(id: string, storageType: string) {
  if (storageType === "mongodb") {
    await connectMongoDB();
    const file = await FileModel.findById(id);
    if (!file) return null;
    return {
      id: file._id.toString(),
      metadata: file.metadata,
      filePath: file.filePath,
      originalName: file.originalName,
      extension: file.extension,
    };
  } else {
    const result = await pool.query(
      "SELECT id, metadata, file_path, original_name, extension FROM files WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) return null;
    return {
      id: result.rows[0].id,
      metadata: result.rows[0].metadata,
      filePath: result.rows[0].file_path,
      originalName: result.rows[0].original_name,
      extension: result.rows[0].extension,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file1Id, file1StorageType, file2Id, file2StorageType, strategy } = body;

    if (!file1Id || !file1StorageType || !file2Id || !file2StorageType || !strategy) {
      return NextResponse.json(
        { error: "All parameters are required" },
        { status: 400 }
      );
    }

    // Get both files
    const file1 = await getFileData(file1Id, file1StorageType);
    const file2 = await getFileData(file2Id, file2StorageType);

    if (!file1 || !file2) {
      return NextResponse.json(
        { error: "One or both files not found" },
        { status: 404 }
      );
    }

    // Ensure both are JSON files
    if (file1.extension !== "json" || file2.extension !== "json") {
      return NextResponse.json(
        { error: "Both files must be JSON files" },
        { status: 400 }
      );
    }

    // Get the actual JSON data from the files
    const cleanPath1 = file1.filePath.startsWith("/") ? file1.filePath.slice(1) : file1.filePath;
    const cleanPath2 = file2.filePath.startsWith("/") ? file2.filePath.slice(1) : file2.filePath;
    const absolutePath1 = path.join(process.cwd(), "public", cleanPath1);
    const absolutePath2 = path.join(process.cwd(), "public", cleanPath2);

    const data1 = JSON.parse(await readFile(absolutePath1, "utf-8"));
    const data2 = JSON.parse(await readFile(absolutePath2, "utf-8"));

    // Perform merge based on strategy
    let mergedData: any;
    switch (strategy as MergeStrategy) {
      case "shallow":
        mergedData = { ...data1, ...data2 };
        break;
      case "deep":
        mergedData = deepMerge(data1, data2);
        break;
      case "override":
        mergedData = data2;
        break;
      case "combine":
        mergedData = { file1: data1, file2: data2 };
        break;
      default:
        return NextResponse.json(
          { error: "Invalid merge strategy" },
          { status: 400 }
        );
    }

    // Write merged data back to the first file
    await writeFile(absolutePath1, JSON.stringify(mergedData, null, 2), "utf-8");

    // Update metadata in database
    if (file1StorageType === "mongodb") {
      await connectMongoDB();
      await FileModel.findByIdAndUpdate(file1Id, {
        metadata: mergedData,
        updatedAt: new Date(),
      });
    } else {
      await pool.query(
        "UPDATE files SET metadata = $1, updated_at = NOW() WHERE id = $2",
        [mergedData, file1Id]
      );
    }

    return NextResponse.json({
      message: "Files merged successfully",
      mergedFileId: file1Id,
      strategy,
    });
  } catch (error) {
    console.error("Merge error:", error);
    return NextResponse.json(
      { error: "Failed to merge files" },
      { status: 500 }
    );
  }
}

