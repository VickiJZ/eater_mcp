import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  McpError,
  ErrorCode,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer from "puppeteer";
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HtmlDataExtractor, TagMapping, ParsedOutput } from './src/HtmlDataExtractor.js';

// Tool definitions
const EATER_SEARCH_TOOL: Tool = {
  name: "eater_search",
  description: "Search for available restaurants on Eater with various filters.",
  inputSchema: {
    type: "object",
    properties: {
      keywords: {
        type: "array",
        description: "Keywords to search for articles"
      }
    },
    required: ["keywords"]
  }
};

const EATER_TOOLS = [
  EATER_SEARCH_TOOL,
] as const;

// Utility functions
const USER_AGENT = "ModelContextProtocol/1.0 (Autonomous; +https://github.com/modelcontextprotocol/servers)";
const BASE_URL = "https://eater.com"; // Assuming Eater.com is the target, this might need to be updated

// // Define your specific mapping for Eater data extraction
// const EATER_ITEM_MAPPING: TagMapping = {
//   // Ensure these class names are correct for what's inside each div.ScrollTo item
//   restaurant_name: 'SearchResult__venue-name', // Example, verify this class is within div.ScrollTo
//   time: 'ReservationButton__time',        // Example, verify this class is within div.ScrollTo
//   // Add other fields if needed, e.g., address, rating, etc.
//   // Ensure the class names are relative to the content of each div.ScrollTo
// };

// const EATER_ITEM_SELECTOR = '.SearchResultsContainer__results .ScrollTo'; // The selector for each restaurant block

// API handlers
export async function handleEaterSearch(params: any) {
  const {
    keywords
  } = params;
  const aggregated: { query: string; data: ParsedOutput[] }[] = [];

  let browser: puppeteer.Browser | undefined;
  try {
    browser = await puppeteer.launch({ headless: true });

    for (const q of keywords) {
      // TODO: find out whether to pass in keywords here or not, and how to pass in multiple keywords

      continue;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error launching puppeteer:", errorMessage);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(aggregated, null, 2)
    }],
    isError: false
  };
}

// Server setup
const server = new Server(
  {
    name: "eater_mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: EATER_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    switch (request.params.name) {
      case "eater_search": {
        return await handleEaterSearch(request.params.arguments);
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Eater MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
