import { wordSchema } from "@/utils/schema";
import { NextResponse } from "next/server";
import { z } from "zod";

// Define the schema for word parts and combinations

type WordOutput = z.infer<typeof wordSchema>;

export const maxDuration = 60;

function validateWordParts(word: string, parts: WordOutput["parts"]): string[] {
  const errors: string[] = [];
  const combinedParts = parts.map((p) => p.text).join("");
  const commaSeparatedParts = parts.map((p) => p.text).join(", ");

  if (combinedParts.toLowerCase() !== word.toLowerCase().replaceAll(" ", "")) {
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

export async function POST(req: Request) {
  try {
    const { word } = await req.json();

    if (!word || typeof word !== "string") {
      return NextResponse.json(
        { error: "Word is required and must be a string" },
        { status: 400 }
      );
    }

    // Step 1: Queue the job
    const queueResponse = await fetch(
      "https://cloud.griptape.ai/api/structures/3e8d0dea-4c37-47a3-9f71-1a819bf07a2a/runs",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GRIPTAPE_CLOUD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            word: word.toLowerCase().trim()
          },
          args: ["-w", word.toLowerCase().trim()]  // Add explicit args
        })
      }
    );

    if (!queueResponse.ok) {
      throw new Error(`Failed to queue job: ${queueResponse.statusText}`);
    }

    const queueData = await queueResponse.json();
    const runId = queueData.structure_run_id;
    console.log('Job queued with run ID:', runId);

    // Step 2: Poll for results
    let attempts = 0;
    const maxAttempts = 30; // 30 second timeout

    while (attempts < maxAttempts) {
      const pollResponse = await fetch(
        `https://cloud.griptape.ai/api/structure-runs/${runId}`,
        {
          headers: {
            "Authorization": `Bearer ${process.env.GRIPTAPE_CLOUD_API_KEY}`,
          }
        }
      );

      if (!pollResponse.ok) {
        throw new Error(`Failed to poll job: ${pollResponse.statusText}`);
      }

      const pollData = await pollResponse.json();
      console.log('Poll response:', pollData);

      if (pollData.status === 'SUCCEEDED' && pollData.output?.value) {
        try {
          // Clean the output value of any markdown code block markers
          const cleanValue = pollData.output.value
            .replace(/```json\n/, '')  // Remove opening ```json
            .replace(/\n```$/, '')     // Remove closing ```
            .trim();                   // Remove any extra whitespace

          // Parse the cleaned JSON string
          const result = { object: JSON.parse(cleanValue) };

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

          return NextResponse.json(result.object);
        } catch (e) {
          console.error("Parse error details:", pollData.output.value); // Add this for debugging
          throw new Error(`Failed to parse output: ${e}`);
        }
      }

      if (pollData.status === 'FAILED') {
        throw new Error(`Job failed: ${pollData.status_detail?.message || 'Unknown error'}`);
      }

      // Wait 1 second before next poll
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Timeout waiting for job completion');

  } catch (error) {
    console.error("Error generating word deconstruction:", error);
    return NextResponse.json(
      { error: "Failed to generate word deconstruction" },
      { status: 500 }
    );
  }
}