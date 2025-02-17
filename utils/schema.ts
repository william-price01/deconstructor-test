import { z } from "zod";

export const wordSchema = z.object({
  parts: z
    .array(
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
    )
    .describe(
      "The text parts of the word MUST combine to form the original word, and be in the same order as the original word"
    ),
  combinations: z
    .array(
      z
        .array(
          z.object({
            id: z.string().describe("Lowercase identifier for the combination"),
            text: z.string().describe("The combined text segments"),
            definition: z
              .string()
              .describe("Clear definition of the combined parts"),
            sourceIds: z
              .array(z.string())
              .describe(
                "Array of ids of the parts or combinations that form this"
              ),
          })
        )
        .describe(
          "A single layer of the Directed Acyclic Graph that forms the original word"
        )
        .nonempty()
    )
    .nonempty()
    .describe(
      "The Directed Acyclic Graph that forms the original word, with each layer being a single layer of the DAG. The last layer MUST only have one combination, which MUST be the original word."
    ),
});
