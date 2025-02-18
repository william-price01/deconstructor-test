import { z } from "zod";

export const wordSchema = z.object({
  thought: z.string(),
  parts: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      originalWord: z.string(),
      origin: z.string(),
      meaning: z.string(),
    })
  ),
  combinations: z
    .array(
      z
        .array(
          z.object({
            id: z.string(),
            text: z.string(),
            definition: z.string(),
            sourceIds: z.array(z.string()),
          })
        )
        .nonempty()
    )
    .nonempty(),
});
