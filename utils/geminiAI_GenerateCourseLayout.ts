import { model, generationConfig } from "../lib/gemini.js";

export default async function geminiAI_GenerateCourseLayout(prompt: string) {
  const streamingResponse = await model.generateContentStream({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig,
  });

  let finalOutput = "";

  for await (const chunk of streamingResponse.stream) {
    const text = chunk.text();
    if (text) {
      finalOutput += text;
    }
  }

  return finalOutput;
}
