import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { selectDatabase } from "@/lib/db-selector";
import { getFileExtension, getFileCategory } from "@/lib/utils";
import pool, { initPostgresDB } from "@/lib/db/postgres";
import { connectMongoDB, FileModel } from "@/lib/db/mongodb";
import { FileMetadata, UploadResponse } from "@/types/file";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const tagsString = formData.get("tags") as string;
    const tags = tagsString ? tagsString.split(",").map((t) => t.trim()) : [];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const uploadedFiles: FileMetadata[] = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Generate unique filename
      const timestamp = Date.now();
      const extension = getFileExtension(file.name);
      const filename = `${timestamp}-${Math.random()
        .toString(36)
        .substring(7)}.${extension}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, filename);

      // Save file to disk
      await writeFile(filePath, buffer);

      // Prepare metadata
      let metadata: any = {};
      if (extension === "json") {
        try {
          metadata = JSON.parse(buffer.toString("utf-8"));
        } catch (e) {
          console.error("Failed to parse JSON:", e);
        }
      }

      const fileData = {
        filename,
        size: file.size,
        mimeType: file.type,
        content: metadata,
      };

      // Intelligent database selection with analysis logging for JSON files
      const storageType = selectDatabase(fileData, {
        logAnalysis: extension === "json" && Object.keys(metadata).length > 0,
      });

      console.log(`📁 ${file.name} → ${storageType.toUpperCase()}`);

      const fileMetadata: FileMetadata = {
        filename,
        originalName: file.name,
        filePath: `/uploads/${filename}`,
        fileSize: file.size,
        mimeType: file.type,
        extension,
        category: getFileCategory(extension),
        tags,
        metadata,
        storageType,
      };

      // Store in appropriate database
      if (storageType === "mongodb") {
        await connectMongoDB();
        const doc = await FileModel.create(fileMetadata);
        fileMetadata.id = doc._id.toString();
      } else {
        await initPostgresDB();
        const result = await pool.query(
          `INSERT INTO files (filename, original_name, file_path, file_size, mime_type, extension, category, tags, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            fileMetadata.filename,
            fileMetadata.originalName,
            fileMetadata.filePath,
            fileMetadata.fileSize,
            fileMetadata.mimeType,
            fileMetadata.extension,
            fileMetadata.category,
            fileMetadata.tags,
            JSON.stringify(fileMetadata.metadata),
          ]
        );
        fileMetadata.id = result.rows[0].id;
      }

      uploadedFiles.push(fileMetadata);
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload files",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
