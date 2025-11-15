import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db/postgres";
import { connectMongoDB, FileModel } from "@/lib/db/mongodb";
import { unlink } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, files } = body;

    if (!action || !files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Action and files array are required" },
        { status: 400 }
      );
    }

    if (action === "delete") {
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const fileInfo of files) {
        try {
          const { id, storageType } = fileInfo;
          let filePath: string | null = null;

          if (storageType === "mongodb") {
            await connectMongoDB();
            const file = await FileModel.findById(id);
            if (file) {
              filePath = file.filePath;
              await FileModel.findByIdAndDelete(id);
            }
          } else {
            const result = await pool.query(
              "SELECT file_path FROM files WHERE id = $1",
              [id]
            );
            if (result.rows.length > 0) {
              filePath = result.rows[0].file_path;
              await pool.query("DELETE FROM files WHERE id = $1", [id]);
            }
          }

          // Delete physical file
          if (filePath) {
            const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
            const absolutePath = path.join(process.cwd(), "public", cleanPath);
            try {
              await unlink(absolutePath);
            } catch (error: any) {
              console.error("Failed to delete physical file:", error);
            }
          }

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Failed to delete file ${fileInfo.id}: ${error.message}`);
        }
      }

      return NextResponse.json({
        message: `Deleted ${results.success} files successfully`,
        results,
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Bulk operation error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk operation" },
      { status: 500 }
    );
  }
}

