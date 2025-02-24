import { Request, Response, Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import geminiAI_GenerateCourseLayout from "../../../utils/geminiAI_GenerateCourseLayout.js";

type CourseLayout = {
  courseTitle: string;
  courseDescription: string;
  difficultyLevel: string;
  courseStructure: {
    chapterTitle: string;
    chapterDescription: string;
    topicsCovered: {
      topicTitle: string;
      topicDescription: string;
      subtopics: string[];
    }[];
  }[];
};

// let courseLayout: CourseLayout | null = null;

const router = Router();

router.get("/", async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: {
        status: "LAYOUT_PROCESSING",
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const { courseId } = req.body;

  if (!courseId) {
    console.error("❌ [ERROR] courseId is missing in the request.");
    res.status(400).json({ success: false, error: "courseId is required" });
    return;
  }

  console.log(
    `📩 [INFO] Received request to generate course layout for courseId: (${courseId}).`
  );

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        description: true,
        difficulty: true,
      },
    });

    if (!course) {
      console.warn(`🚧 [WARN] Course not found with courseId: (${courseId}).`);
      res.status(404).json({ success: false, error: "Course not found" });
      return;
    }

    if (!course.title) {
      console.warn(
        `🚧 [WARN] Course title of courseId: (${courseId}) is missing.`
      );
      res
        .status(404)
        .json({ success: false, error: "Course title is missing" });
      return;
    }

    console.log(
      `📚 [INFO] Generating layout for course: ${course.title} (ID: ${courseId})`
    );

    const PROMPT = `
      Generate a structured course outline based on the following details:
      Course Title: ${course.title} 
      Course Description: ${course.description || "N/A"}
      Difficulty Level: ${course.difficulty || "N/A"}
      
      The structure should include:
      - Chapters (up to 25), each with:
        - Chapter Title
        - Chapter Description
        - Topics Covered:
          - Topic Title
          - Topic Description
          - Subtopics (detailed breakdown)
      
      Format the response strictly as JSON with this structure:
      
      {
        "courseTitle": "...",
        "courseDescription": "...",
        "difficultyLevel": "...",
        "courseStructure": [
          {
            "chapterTitle": "...",
            "chapterDescription": "...",
            "topicsCovered": [
              {
                "topicTitle": "...",
                "topicDescription": "...",
                "subtopics": ["...", "..."]
              }
            ]
          }
        ]
      }
      
      Strictly return only JSON data.
      
      The course outline will be validated using the following criteria:
      
      if (
        !courseLayout.courseTitle ||
        !courseLayout.courseDescription ||
        !courseLayout.difficultyLevel ||
        !Array.isArray(courseLayout.courseStructure)
      ) {
        throw new Error(
          \`Parsed JSON is missing required fields for courseId: ${courseId}\`
        );
      }
      
      for (const chapter of courseLayout.courseStructure) {
        if (
          !chapter.chapterTitle ||
          !chapter.chapterDescription ||
          !Array.isArray(chapter.topicsCovered)
        ) {
          throw new Error(
            \`Invalid chapter structure in AI response for courseId: ${courseId}\`
          );
        }
      
        for (const topic of chapter.topicsCovered) {
          if (
            !topic.topicTitle ||
            !topic.topicDescription ||
            !Array.isArray(topic.subtopics)
          ) {
            throw new Error(
              \`Invalid topic structure in AI response for courseId: ${courseId}\`
            );
          }
        }
      }
      `;

    const result: any = await geminiAI_GenerateCourseLayout(PROMPT);

    if (!result) {
      throw new Error(
        `AI response is missing or undefined from GEMINI for courseId: ${courseId}`
      );
    }

    console.log(
      `🤖 [INFO] AI response received form GEMINI for courseId: ${courseId}`
    );

    let courseLayout: CourseLayout | null = null;

    try {
      let jsonResponse = result.trim();
      if (jsonResponse.startsWith("```json")) {
        jsonResponse = result.slice(7).trim();
        if (jsonResponse.endsWith("```")) {
          jsonResponse = jsonResponse.slice(0, -3).trim();
        }
        console.log("removed markdown");
      }

      if (!jsonResponse.startsWith("{") || !jsonResponse.endsWith("}")) {
        console.log(
          `❌ [ERROR] Invalid JSON format received from GEMINI for courseId: ${courseId}`
        );
        throw new Error(
          `Invalid JSON format received from GEMINI for courseId: ${courseId}`
        );
      }
      courseLayout = JSON.parse(jsonResponse);

      if (
        !courseLayout.courseTitle ||
        !courseLayout.courseDescription ||
        !courseLayout.difficultyLevel ||
        !Array.isArray(courseLayout.courseStructure)
      ) {
        console.log(
          `❌ [ERROR] Parsed JSON is missing required fields for courseId: ${courseId}`
        );
        throw new Error(
          `Parsed JSON is missing required fields for courseId: ${courseId}`
        );
      }

      for (const chapter of courseLayout.courseStructure) {
        if (
          !chapter.chapterTitle ||
          !chapter.chapterDescription ||
          !Array.isArray(chapter.topicsCovered)
        ) {
          console.log(
            `❌ [ERROR] Invalid chapter structure in AI response for courseId: ${courseId}`
          );
          throw new Error(
            `Invalid chapter structure in AI response for courseId: ${courseId}`
          );
        }

        for (const topic of chapter.topicsCovered) {
          if (
            !topic.topicTitle ||
            !topic.topicDescription ||
            !Array.isArray(topic.subtopics)
          ) {
            console.log(
              `❌ [ERROR] Invalid topic structure in AI response for courseId: ${courseId}`
            );
            throw new Error(
              `Invalid topic structure in AI response for courseId: ${courseId}`
            );
          }
        }
      }

      console.log(
        `✅ [SUCCESS] Valid course layout generated for courseId: ${courseId}`
      );
    } catch (error) {
      console.log();
      console.error(
        `❌ [ERROR] Failed to parse AI response for courseId: ${courseId}`,
        error
      );
      res.status(500).json({
        success: false,
        error: "AI response parsing failed. Please try again.",
      });
      return;
    }

    console.log(
      `✅ [SUCCESS] Course layout generated successfully for ID: ${courseId}`
    );

    try {
      await prisma.course.update({
        where: { id: courseId },
        data: {
          status: "LAYOUT_SUCCESS",
          layout: courseLayout,
        },
      });
    } catch (error) {
      await prisma.course.update({
        where: { id: courseId },
        data: {
          status: "PENDING",
        },
      });
      res.status(500).json({ success: false, error: "Database Error" });
      return;
    }

    console.log(
      `✅ [SUCCESS] Course layout saved to the database for courseId: ${courseId}`
    );

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    console.error(
      `❌ [ERROR] Failed to generate course layout for courseId: ${courseId}`,
      error
    );

    res.status(500).json({ success: false, error: "Internal Server Error" });
    return;
  }
});

export default router;
