import { wordSchema } from "@/utils/schema";
import { NextResponse } from "next/server";
import { z } from "zod";

// Define the schema for word parts and combinations

type WordOutput = z.infer<typeof wordSchema>;

export const maxDuration = 60;

function validateWordParts(word: string, parts: WordOutput["parts"]): string[] {
  const errors: string[] = [];
  const combinedParts = parts
    .map((p) => p.text)
    .join("")
    .toLowerCase()
    .replace(/\s+/g, "");
  const normalizedWord = word
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z]/g, ""); // Remove any non-letter characters
  const commaSeparatedParts = parts.map((p) => p.text).join(", ");

  if (combinedParts !== normalizedWord) {
    errors.push(
      `The parts "${commaSeparatedParts}" do not combine to form the word "${word}"`
    );
  }
  return errors;
}

function validateUniqueIds(output: WordOutput): string[] {
  const errors: string[] = [];
  const seenIds = new Map<string, string>(); // id -> where it was found

  // Check parts
  output.parts.forEach((part) => {
    seenIds.set(part.id, "parts");
  });

  // Check combinations
  output.combinations.forEach((layer, layerIndex) => {
    layer.forEach((combo) => {
      if (seenIds.has(combo.id)) {
        errors.push(
          `ID "${combo.id}" in combinations layer ${layerIndex + 1
          } is already used in ${seenIds.get(
            combo.id
          )}. IDs must be unique across both parts and combinations.`
        );
      }
      seenIds.set(combo.id, `combinations layer ${layerIndex + 1}`);
    });
  });

  return errors;
}

function validateCombinations(word: string, output: WordOutput): string[] {
  const errors: string[] = [];

  // Check if combinations array is empty
  if (!output.combinations.length) {
    errors.push("Combinations array cannot be empty");
    return errors;
  }

  // Find the last combination across all layers
  const lastCombination = output.combinations
    .flat()
    .reduce((latest, current) =>
      latest.text.length >= current.text.length ? latest : current
    );

  // Check if final combination matches the word
  if (lastCombination.text.toLowerCase() !== word.toLowerCase()) {
    errors.push(
      `The final combination "${lastCombination.text}" does not match the input word "${word}"`
    );
  }

  // Build a map of how many times each ID is used as a source
  const childCount = new Map<string, number>();

  // Initialize counts for all parts
  output.parts.forEach((part) => {
    childCount.set(part.id, 0);
  });

  // Count how many times each ID is used as a source
  output.combinations.flat().forEach((combo) => {
    combo.sourceIds.forEach((sourceId) => {
      const count = childCount.get(sourceId) ?? 0;
      childCount.set(sourceId, count + 1);
    });
    // Initialize count for this combination
    childCount.set(combo.id, 0);
  });

  // Check that each node (except the final word) has exactly one child
  for (const [id, count] of childCount.entries()) {
    // Skip the final combination as it shouldn't have any children
    if (id === lastCombination.id) continue;

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

  return errors;
}

function simplifyDAG(output: WordOutput): WordOutput {
  // Create a map of all nodes (parts and combinations) and their dependencies
  const nodeMap = new Map<string, Set<string>>();

  // Initialize with parts
  output.parts.forEach((part) => {
    nodeMap.set(part.id, new Set());
  });

  // Add combinations and their dependencies
  output.combinations.forEach((layer) => {
    layer.forEach((combo) => {
      nodeMap.set(combo.id, new Set(combo.sourceIds));
    });
  });

  // Function to get all dependencies recursively
  function getAllDependencies(
    id: string,
    visited = new Set<string>()
  ): Set<string> {
    if (visited.has(id)) return new Set();
    visited.add(id);

    const deps = nodeMap.get(id) || new Set();
    const allDeps = new Set(deps);

    for (const dep of deps) {
      const subDeps = getAllDependencies(dep, visited);
      subDeps.forEach((d) => allDeps.add(d));
    }

    return allDeps;
  }

  // Create new optimized layers
  type Combination = {
    id: string;
    text: string;
    definition: string;
    sourceIds: string[];
  };
  type Layer = [Combination, ...Combination[]];
  const newCombinations: Layer[] = [];
  const processed = new Set<string>();
  const partsSet = new Set(output.parts.map((p) => p.id));

  // Start with combinations that only depend on parts
  let currentLayer = output.combinations
    .flat()
    .filter((combo) => combo.sourceIds.every((id) => partsSet.has(id)));

  while (currentLayer.length > 0) {
    // Ensure each layer has at least one combination
    if (currentLayer.length > 0) {
      newCombinations.push([currentLayer[0], ...currentLayer.slice(1)]);
    }
    currentLayer.forEach((combo) => processed.add(combo.id));

    // Find next layer: combinations whose dependencies are all processed
    currentLayer = output.combinations.flat().filter(
      (combo) =>
        !processed.has(combo.id) && // Not already processed
        combo.sourceIds.every((id) => partsSet.has(id) || processed.has(id))
    );
  }

  // If we have no combinations, add an empty layer to satisfy the type
  if (newCombinations.length === 0 && output.combinations.length > 0) {
    const emptyCombination = output.combinations[0][0];
    newCombinations.push([emptyCombination]);
  }

  return {
    ...output,
    combinations: newCombinations as typeof output.combinations,
  };
}

interface LastAttempt {
  errors: string[];
  output: WordOutput;
}

// Add a new route for polling
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  const word = searchParams.get('word'); // Get word from query params

  if (!runId || !word) {
    return NextResponse.json({ error: "Run ID and word required" }, { status: 400 });
  }

  const pollResponse = await fetch(
    `https://cloud.griptape.ai/api/structure-runs/${runId}`,
    {
      headers: {
        "Authorization": `Bearer ${process.env.GT_CLOUD_API_KEY}`,
      }
    }
  );

  const pollData = await pollResponse.json();

  if (pollData.status === 'SUCCEEDED' && pollData.output?.value) {
    try {
      // Handle both string and object formats
      let parsedValue;
      if (typeof pollData.output.value === 'string') {
        const cleanValue = pollData.output.value
          .replace(/```json\n/, '')
          .replace(/\n```$/, '')
          .trim();
        parsedValue = JSON.parse(cleanValue);
      } else {
        // Already an object from model_dump()
        parsedValue = pollData.output.value;
      }

      const result = { object: parsedValue };

      const errors: string[] = [
        ...validateWordParts(word, result.object.parts),
        ...validateUniqueIds(result.object),
        ...validateCombinations(word, result.object),
      ];

      if (errors.length > 0) {
        console.log("validation errors:", errors);
        return NextResponse.json(
          { error: "Validation failed", errors },
          { status: 400 }
        );
      }

      return NextResponse.json({
        data: result.object,
        status: 'Complete'
      });
    } catch (e) {
      console.error("Parse error details:", pollData.output.value);
      throw new Error(`Failed to parse output: ${e}`);
    }
  }

  return NextResponse.json({
    status: pollData.status,
    progress: pollData.progress || 0
  }, { status: 202 });
}

// Modify POST to only create the run
export async function POST(req: Request) {
  try {
    const { word: rawWord } = await req.json();
    const word = rawWord.trim().toLowerCase();

    // # "https://cloud.griptape.ai/api/structures/3e8d0dea-4c37-47a3-9f71-1a819bf07a2a/runs",
    const queueResponse = await fetch(
      `https://cloud.griptape.ai/api/structures/${process.env.GT_CLOUD_STRUCTURE_ID}/runs`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GT_CLOUD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: { word },
          args: ["-w", word]
        })
      }
    );

    const queueData = await queueResponse.json();
    return NextResponse.json({ runId: queueData.structure_run_id });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to start word deconstruction" },
      { status: 500 }
    );
  }
}