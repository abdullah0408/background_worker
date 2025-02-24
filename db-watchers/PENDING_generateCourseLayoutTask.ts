import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import axios from "axios";

const PENDING_generateCourseLayoutTask = async () => {
  let processingTask: {id: string} | null = null;

  try {
    // Fetch the first PENDING task (oldest)
    const generateCourseLayoutTask = await prisma.course.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    if (!generateCourseLayoutTask) {
      console.log("ℹ️ [INFO] No PENDING task of generating course layout.");
      return;
    }

    console.log(`🔍 [INFO] Found task of generating course layout for Course:(${generateCourseLayoutTask.id}).`);

    // Mark the task as "PROCESSING"
    processingTask = await prisma.course.update({
      where: { id: generateCourseLayoutTask.id, status: "PENDING" }, // Ensure task is still pending
      data: { status: "LAYOUT_PROCESSING" },
    });

    if (!processingTask) {
      console.log(
        `🚧 [INFO] Task of generating course layout for courseId:(${generateCourseLayoutTask.id}) is already picked by another instance.`
      );
      return;
    }

    console.log(
      `🚀 [INFO] Process started of generating course layout for courseId: ${processingTask.id}`
    );

    const maxAttempts = 5;
    let attempts = 0;
    const URL = process.env.DEPLOYED_URL || "http://localhost:3000";
    while (attempts < maxAttempts) {
      try {
        // Send request to generate course layout
        await axios.post(`${URL}/api/generate-course-layout`, {
          courseId: processingTask.id,
        });

        console.log(
          `✅ [SUCCESS] Course layout processed successfully: ${processingTask.id}`
        );

        return; // Exit function after successful processing
      } catch (error) {
        attempts++;
        console.error(
          `❌ [ERROR] Attempt ${attempts} failed for courseId: ${processingTask.id}`
        );


        if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND" || error.code === "ECONNRESET") {
          console.log(
            `🚨 [ERROR] Network error (ECONNREFUSED) for courseId: ${processingTask.id}. Possible reasons: Invalid URL, DNS issue, or server down. Retrying will not work.`
          );
          await prisma.course.update({
            where: {
              id: processingTask.id,
              status: "LAYOUT_PROCESSING",
            },
            data: {
              status: "PENDING",
            },
          });
          return; // Exit early to avoid retrying
        }

        if (attempts < maxAttempts) {
          const delay = 2000 * attempts; // Exponential backoff (2s, 4s, 6s...)
          console.log(`⏳ [INFO] Retrying in ${delay / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // If all retries failed, mark the course layout as FAILED
    await prisma.course.update({
      where: { id: processingTask.id },
      data: { status: "LAYOUT_FAILED" },
    });

    console.error(
      `❗ [ERROR] Course layout ${processingTask.id} marked as LAYOUT_FAILED after ${maxAttempts} attempts.`
    );
  } catch (error) {
    console.error("🚧 [ERROR] Unexpected error in LayoutTasks:", error);

    // If an error occurs after setting status to PROCESSING, revert it back to PENDING
    if (processingTask) {
      await prisma.course.update({
        where: { id: processingTask.id },
        data: { status: "PENDING" },
      });

      console.log(
        `🔄 [INFO] Reset course ID: ${processingTask.id} to PENDING due to an unexpected error.`
      );
    }
  }
};

export default PENDING_generateCourseLayoutTask;
