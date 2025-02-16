import { z } from "zod";

export const wordSchema = z.object({
  parts: z.array(
    z.object({
      id: z
        .string()
        .describe("Lowercase identifier for the word part, no spaces"),
      text: z.string().describe("The actual text segment of the word part"),
      originalWord: z
        .string()
        .describe("The original word or affix this part comes from"),
      origin: z
        .string()
        .describe('Brief origin like "Latin", "Greek", "Old English"'),
      meaning: z.string().describe("Concise meaning of this word part"),
    })
  ),
  combinations: z.array(
    z.object({
      id: z.string().describe("Lowercase identifier for the combination"),
      text: z.string().describe("The combined text segments"),
      definition: z.string().describe("Clear definition of the combined parts"),
      sourceIds: z
        .array(z.string())
        .describe("Array of ids of the parts or combinations that form this"),
    })
  ),
});
