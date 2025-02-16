import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { NextResponse } from "next/server";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Define the schema for word parts and combinations
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

export async function POST(req: Request) {
  try {
    const { word } = await req.json();

    if (!word || typeof word !== "string") {
      return NextResponse.json(
        { error: "Word is required and must be a string" },
        { status: 400 }
      );
    }

    const result = await generateObject({
      model: openrouter("google/gemini-2.0-flash-exp:free"),
      // model: openai("gpt-4o"),
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
    {
      "id": "constructor",
      "text": "constructor",
      "definition": "one who constructs or builds",
      "sourceIds": ["construc", "tor"]
    },
    {
      "id": "deconstructor",
      "text": "deconstructor",
      "definition": "one who takes apart or analyzes the construction of something",
      "sourceIds": ["de", "constructor"]
    }
  ]
}
  

Here's an example for the word "pneumonoultramicroscopicsilicovolcanoconiosis":
{
  "parts": [
    {
      "id": "pneumono",
      "text": "pneumono",
      "originalWord": "pneumon",
      "origin": "Greek",
      "meaning": "lung"
    },
    {
      "id": "ultra",
      "text": "ultra",
      "originalWord": "ultra",
      "origin": "Latin",
      "meaning": "beyond"
    },
    {
      "id": "micro",
      "text": "micro",
      "originalWord": "mikros",
      "origin": "Greek",
      "meaning": "small"
    },
    {
      "id": "scopic",
      "text": "scopic",
      "originalWord": "skopein",
      "origin": "Greek",
      "meaning": "to look or examine"
    },
    {
      "id": "silico",
      "text": "silico",
      "originalWord": "silicon",
      "origin": "Latin",
      "meaning": "silicon, a chemical element"
    },
    {
      "id": "volcano",
      "text": "volcano",
      "originalWord": "volcanus",
      "origin": "Latin",
      "meaning": "volcano"
    },
    {
      "id": "coni",
      "text": "coni",
      "originalWord": "konis",
      "origin": "Greek",
      "meaning": "dust"
    },
    {
      "id": "osis",
      "text": "osis",
      "originalWord": "-osis",
      "origin": "Greek",
      "meaning": "condition or disease"
    }
  ],
  "combinations": [
    {
      "id": "microscopic",
      "text": "microscopic",
      "definition": "so small as to be visible only with a microscope",
      "sourceIds": [
        "micro",
        "scopic"
      ]
    },
    {
      "id": "silicovolcano",
      "text": "silicovolcano",
      "definition": "relating to silicon and volcanoes",
      "sourceIds": [
        "silico",
        "volcano"
      ]
    },
    {
      "id": "coniosis",
      "text": "coniosis",
      "definition": "a condition or disease caused by dust",
      "sourceIds": [
        "coni",
        "osis"
      ]
    },
    {
      "id": "pneumonoultramicroscopic",
      "text": "pneumonoultramicroscopic",
      "definition": "relating to the lungs and extremely small particles",
      "sourceIds": [
        "pneumono",
        "ultra",
        "microscopic"
      ]
    },
    {
      "id": "pneumonoultramicroscopicsilicovolcanoconiosis",
      "text": "pneumonoultramicroscopicsilicovolcanoconiosis",
      "definition": "a lung disease caused by inhaling very fine silicate or volcanic dust",
      "sourceIds": [        
        "pneumonoultramicroscopic",
        "silicovolcano",
        "coniosis"
      ]
    }
  ]
}`,
      prompt: `Deconstruct the word: ${word}`,
      schema: wordSchema,
    });

    return result.toJsonResponse();
  } catch (error) {
    console.error("Error generating word deconstruction:", error);
    return NextResponse.json(
      { error: "Failed to generate word deconstruction" },
      { status: 500 }
    );
  }
}
