"use client";
import {
  ReactFlow,
  Background,
  type Edge,
  Handle,
  type Node,
  Position,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState } from "react";
// import { wordSchema } from "@/app/api/route";
// import { z } from "zod";
import Dagre from "@dagrejs/dagre";
import { getTextWidth } from "@/utils/text-width";

type WordPart = {
  id: string;
  text: string;
  width: number;
  originalWord: string;
  origin: string;
  meaning: string;
};

type Combination = {
  id: string;
  text: string;
  definition: string;
  sourceIds: string[];
};

const WordChunkNode = ({ data }: { data: { text: string; width: number } }) => (
  <div className="flex flex-col items-center">
    <div className="text-5xl font-serif mb-1">{data.text}</div>
    <div className="w-full h-3 border border-t-0 border-white" />
    <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
  </div>
);

const OriginNode = ({
  data,
}: {
  data: { originalWord: string; origin: string; meaning: string };
}) => (
  <div className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 max-w-[180px]">
    <p className="text-lg font-serif mb-1">{data.originalWord}</p>
    <p className="text-xs text-gray-400">{data.origin}</p>
    <p className="text-xs text-gray-300">{data.meaning}</p>
    <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
    <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
  </div>
);

const CombinedNode = ({
  data,
}: {
  data: { text: string; definition: string };
}) => (
  <div className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 max-w-[250px]">
    <p className="text-xl font-serif mb-1">{data.text}</p>
    <p className="text-sm text-gray-300">{data.definition}</p>
    <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
    <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
  </div>
);

const InputNode = ({
  data,
}: {
  data: { onSubmit: (word: string) => void };
}) => {
  const [word, setWord] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    setIsLoading(true);
    await data.onSubmit(word);
    setIsLoading(false);
  };

  return (
    <div className="px-6 py-4 rounded-xl bg-gray-800/80 border border-gray-700/50 backdrop-blur-sm shadow-xl min-w-[300px]">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter a word..."
          className="flex-1 px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-700/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {isLoading ? "..." : "Analyze"}
        </button>
      </form>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
};

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  options: unknown
) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: options.direction });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) =>
    g.setNode(node.id, {
      ...node,
      width: node.measured?.width ?? 0,
      height: node.measured?.height ?? 0,
    })
  );

  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const position = g.node(node.id);
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      const x = position.x - (node.measured?.width ?? 0) / 2;
      const y = position.y - (node.measured?.height ?? 0) / 2;

      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

export default function WordDeconstructor() {
  const [definition, setDefinition] = useState({
    parts: [
      {
        id: "de",
        text: "de",
        originalWord: "de-",
        origin: "Latin",
        meaning: "down, off, away",
      },
      {
        id: "construc",
        text: "construc",
        originalWord: "construere",
        origin: "Latin",
        meaning: "to build, to pile up",
      },
      {
        id: "tor",
        text: "tor",
        originalWord: "-or",
        origin: "Latin",
        meaning: "agent noun, one who does an action",
      },
    ],
    combinations: [
      {
        id: "constructor",
        text: "constructor",
        definition: "one who constructs or builds",
        sourceIds: ["construc", "tor"],
      },
      {
        id: "deconstructor",
        text: "deconstructor",
        definition:
          "one who takes apart or analyzes the construction of something",
        sourceIds: ["de", "constructor"],
      },
    ],
  });

  const handleWordSubmit = async (word: string) => {
    try {
      const response = await fetch("/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ word }),
      });

      const data = await response.json();
      if (response.ok) {
        setDefinition(data);
      } else {
        console.error("Error:", data.error);
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
    }
  };

  const initialNodes: Node[] = [];
  const initialEdges: Edge[] = [];

  const BASE_FONT_SIZE = 48;
  const BASE_CHAR_WIDTH = BASE_FONT_SIZE * 0.6;

  // Calculate widths based on content
  const parts: WordPart[] = definition.parts.map((part) => ({
    ...part,
    width: getTextWidth(part.text, "normal 3rem 'Noto Serif'"),
  }));

  // Calculate node dimensions based on content
  const maxOriginWordLength = Math.max(
    ...parts.map(
      (p) => p.originalWord.length + p.origin.length + p.meaning.length
    )
  );
  const originNodeWidth = maxOriginWordLength * (BASE_CHAR_WIDTH * 0.3);
  const maxCombinedWidth = Math.max(
    ...definition.combinations.map((c) =>
      Math.max(
        c.text.length * BASE_CHAR_WIDTH,
        c.definition.length * (BASE_CHAR_WIDTH * 0.25)
      )
    )
  );

  // Spacing calculations
  const wordScale = 0.73; // Scale factor for word chunks
  const wordHorizontalSpacing = BASE_CHAR_WIDTH * 0.5; // Increased from 0.1 to 0.5
  const verticalSpacing = BASE_FONT_SIZE * 2.5;

  // Calculate total width including spacing between word chunks
  const totalWordWidth =
    parts.reduce(
      (sum, part) => sum + part.width * wordScale + wordHorizontalSpacing,
      0
    ) - wordHorizontalSpacing;

  const startX = -totalWordWidth / 2;
  let currentX = startX;

  // Y-position calculations
  const wordY = -verticalSpacing * 1.5;
  const originY = wordY + verticalSpacing;

  // Add input node at the top
  initialNodes.push({
    id: "input",
    type: "input",
    position: { x: -150, y: -verticalSpacing * 2.5 },
    data: { onSubmit: handleWordSubmit },
  });

  // Add word parts and their origins
  parts.forEach((part) => {
    // Word chunk node
    initialNodes.push({
      id: part.id,
      type: "wordChunk",
      position: { x: currentX, y: wordY },
      data: { text: part.text, width: part.width * wordScale },
    });

    // Origin node - position relative to word chunk width
    const originCenterX = currentX + (part.width * wordScale) / 2;
    const originId = `origin-${part.id}`;
    initialNodes.push({
      id: originId,
      type: "origin",
      position: {
        x: originCenterX - originNodeWidth / 2,
        y: originY,
      },
      data: {
        originalWord: part.originalWord,
        origin: part.origin,
        meaning: part.meaning,
      },
    });

    // Connect word part to origin
    initialEdges.push({
      id: `edge-${part.id}-${originId}`,
      source: part.id,
      target: originId,
      type: "straight",
      style: { stroke: "#4B5563", strokeWidth: 1 },
      animated: true,
    });

    currentX += part.width * wordScale + wordHorizontalSpacing;
  });

  // Add combinations in layers
  const combinationsByLayer = new Map<number, Combination[]>();

  // Helper to get a node's layer (recursive)
  const getNodeLayer = (
    nodeId: string,
    visited = new Set<string>()
  ): number => {
    if (visited.has(nodeId)) return 0; // Prevent cycles
    visited.add(nodeId);

    const combination = definition.combinations.find((c) => c.id === nodeId);
    if (!combination) return 0; // It's a base part

    const sourceLayers = combination.sourceIds.map((id) =>
      getNodeLayer(id, visited)
    );
    return Math.max(...sourceLayers) + 1;
  };

  // Group combinations by layer
  definition.combinations.forEach((combo) => {
    const layer = getNodeLayer(combo.id);
    if (!combinationsByLayer.has(layer)) {
      combinationsByLayer.set(layer, []);
    }
    combinationsByLayer.get(layer)!.push(combo);
  });

  // Add combination nodes layer by layer
  const layers = Array.from(combinationsByLayer.keys()).sort((a, b) => a - b);
  layers.forEach((layer, layerIndex) => {
    const combinations = combinationsByLayer.get(layer)!;
    const y = originY + verticalSpacing * (layerIndex + 1.5);

    combinations.forEach((combination) => {
      const x = -maxCombinedWidth / 2;

      // Add combination node
      initialNodes.push({
        id: combination.id,
        type: "combined",
        position: { x, y },
        data: {
          text: combination.text,
          definition: combination.definition,
        },
      });

      // Add edges from all sources - now using the correct source nodes
      combination.sourceIds.forEach((sourceId) => {
        // Find if this source is a word part
        const isPart = parts.find((p) => p.id === sourceId);
        // If it's a part, connect from its origin node, otherwise connect from the combination directly
        const actualSourceId = isPart ? `origin-${sourceId}` : sourceId;

        initialEdges.push({
          id: `edge-${actualSourceId}-${combination.id}`,
          source: actualSourceId,
          target: combination.id,
          type: "straight",
          style: { stroke: "#4B5563", strokeWidth: 1 },
          animated: true,
        });
      });
    });
  });

  const nodeTypes = {
    wordChunk: WordChunkNode,
    origin: OriginNode,
    combined: CombinedNode,
    input: InputNode,
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100">
      <div className="h-full w-full">
        <ReactFlowProvider>
          <ReactFlow
            nodes={initialNodes}
            edges={initialEdges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{
              padding: 0.2,
              // minZoom: 0.5,
              // maxZoom: 1.2,
            }}
            className="bg-gray-900"
            // minZoom={0.2}
            // maxZoom={1.5}
            // minZoom={1}
            // maxZoom={1}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            // elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
            // panOnScroll={false}
            // panOnDrag={false}
            // zoomOnScroll={false}
            preventScrolling={true}
          >
            <Background color="#333" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
