import "dotenv/config";

import app from "./app.js"
import PENDING_generateCourseLayoutTask from "../db-watchers/PENDING_generateCourseLayoutTask.js";

const PORT = process.env.PORT || 3000;

let layoutTaskProcessing = false;

async function processLayoutTasks() {
  if (layoutTaskProcessing) return;
  layoutTaskProcessing = true;

  try {
    console.log("🔄 [INFO] Checking for pending course layout tasks...");
    await PENDING_generateCourseLayoutTask();
  } catch (error) {
    console.error("🚨 [ERROR] Failed to process layout tasks:", error);
  } finally {
    layoutTaskProcessing = false;
  }
}

setInterval(() => {
  processLayoutTasks();
}, 60000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});