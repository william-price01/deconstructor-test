import { generateObject } from "ai";
// import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wordSchema } from "@/utils/schema";
import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
// const openrouter = createOpenRouter({
//   apiKey: process.env.OPENROUTER_API_KEY,
// });

// Define the schema for word parts and combinations

type WordOutput = z.infer<typeof wordSchema>;

function validateWordParts(word: string, parts: WordOutput["parts"]): string[] {
  const errors: string[] = [];
  const combinedParts = parts.map((p) => p.text).join("");

  if (combinedParts.toLowerCase() !== word.toLowerCase()) {
    errors.push(
      `The parts "${combinedParts}" do not combine to form the word "${word}"`
    );
  }
  return errors;
}

function validateCombinations(word: string, output: WordOutput): string[] {
  const errors: string[] = [];

  // Check if last layer has exactly one item
  const lastLayer = output.combinations[output.combinations.length - 1];
  if (lastLayer.length !== 1) {
    errors.push(
      `The last layer should have exactly one item, which should be the original word, but you have ${lastLayer.length} items. You may need to add one more layer and move the final word to the next layer.`
    );
  }

  // Check if last combination is the full word
  if (lastLayer?.length === 1) {
    const finalWord = lastLayer[0].text.toLowerCase();
    if (finalWord !== word.toLowerCase()) {
      errors.push(
        `The final combination "${finalWord}" does not match the input word "${word}"`
      );
    }
  }

  // Build a map of how many times each ID is used as a source
  const childCount = new Map<string, number>();

  // Initialize counts for all parts
  output.parts.forEach((part) => {
    childCount.set(part.id, 0);
  });

  // Count how many times each ID is used as a source
  output.combinations.forEach((layer) => {
    layer.forEach((combo) => {
      combo.sourceIds.forEach((sourceId) => {
        const count = childCount.get(sourceId) ?? 0;
        childCount.set(sourceId, count + 1);
      });
      // Initialize count for this combination
      childCount.set(combo.id, 0);
    });
  });

  // Check that each node (except the final word) has exactly one child
  for (const [id, count] of childCount.entries()) {
    // Skip the final word as it shouldn't have any children
    if (lastLayer?.length === 1 && id === lastLayer[0].id) continue;

    if (count === 0) {
      errors.push(
        `The node "${id}" is not used as a source for any combinations. Make sure to use it as a source in a future layer.`
      );
    } else if (count > 1) {
      errors.push(
        `The node "${id}" is used ${count} times as a source, but should only be used once. Remove extra uses.`
      );
    }
  }

  // Validate DAG structure
  const allIds = new Set(output.parts.map((p) => p.id));
  for (let i = 0; i < output.combinations.length; i++) {
    const layer = output.combinations[i];
    // Add combination IDs from this layer
    layer.forEach((combo) => allIds.add(combo.id));

    // Check if all sourceIds exist in previous layers
    for (const combo of layer) {
      for (const sourceId of combo.sourceIds) {
        if (!allIds.has(sourceId)) {
          errors.push(
            `The sourceId "${sourceId}" in combination "${combo.id}" does not exist in previous layers.`
          );
        }
      }
    }
  }

  return errors;
}

interface LastAttempt {
  errors: string[];
  output: WordOutput;
}

export async function POST(req: Request) {
  try {
    const { word } = await req.json();

    if (!word || typeof word !== "string") {
      return NextResponse.json(
        { error: "Word is required and must be a string" },
        { status: 400 }
      );
    }

    const attempts: LastAttempt[] = [];
    const maxAttempts = 3;

    while (attempts.length < maxAttempts) {
      const prompt: string =
        attempts.length === 0
          ? `Deconstruct the word: ${word}`
          : `Deconstruct the word: ${word}

Previous attempts:
${attempts
  .map(
    (attempt, index) => `
Attempt ${index + 1}:
${JSON.stringify(attempt.output, null, 2)}
Errors:
${attempt.errors.map((error) => `- ${error}`).join("\n")}
`
  )
  .join("\n")}

Please fix all the issues and try again.`;

      console.log("prompt", prompt);

      let model: string;
      switch (attempts.length) {
        case 0:
          model = "gpt-4o-mini";
          break;
        default:
          model = "gpt-4o";
          break;
      }

      const result = await generateObject({
        model: openai(model),
        system: `You are a linguistic expert that deconstructs words into their meaningful parts and explains their etymology. Create multiple layers of combinations to form the final meaning of the word.


Here's an example for the word "deconstructor":
{
  "parts": [
    {
      "id": "de",
      "text": "de",
      "originalWord": "de-",
      "origin": "Latin",
      "meaning": "down, off, away"
    },
    {
      "id": "construc",
      "text": "construc",
      "originalWord": "construere",
      "origin": "Latin",
      "meaning": "to build, to pile up"
    },
    {
      "id": "tor",
      "text": "tor",
      "originalWord": "-or",
      "origin": "Latin",
      "meaning": "agent noun, one who does an action"
    }
  ],
  "combinations": [
    [
      {
        "id": "constructor",
        "text": "constructor",
        "definition": "one who constructs or builds",
        "sourceIds": ["construc", "tor"]
      }
    ],
    [
      {
        "id": "deconstructor",
        "text": "deconstructor",
        "definition": "one who takes apart or analyzes the construction of something",
        "sourceIds": ["de", "constructor"]
      }
    ]
  ]
}`,
        prompt,
        schema: wordSchema,
      });

      const errors: string[] = [
        ...validateWordParts(word, result.object.parts),
        ...validateCombinations(word, result.object),
      ];

      if (errors.length > 0) {
        console.log("validation errors:", errors);
        attempts.push({
          errors,
          output: result.object,
        });
        continue;
      }

      // If we reach here, all validations passed
      return result.toJsonResponse();
    }

    // Return the last attempt anyway
    return NextResponse.json(attempts[attempts.length - 1]?.output, {
      status: 203,
    });
  } catch (error) {
    console.error("Error generating word deconstruction:", error);
    return NextResponse.json(
      { error: "Failed to generate word deconstruction" },
      { status: 500 }
    );
  }
}
