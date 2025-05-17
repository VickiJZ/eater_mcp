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
import { runCrawler } from "./src/crawler.js";
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

// API handlers
export async function handleEaterSearch(params: any) {
  // Ensure params and params.keywords are valid
  if (!params || !params.keywords || !Array.isArray(params.keywords) || params.keywords.length === 0) {
    console.error('handleEaterSearch: Invalid or missing keywords in params.');
    return { error: 'Invalid keywords provided' }; 
  }

  try {
    console.log(`handleEaterSearch: Received keywords: ${params.keywords.join(', ')}`);
    const venues = await runCrawler(params.keywords); // venues is an array of Venue objects
    console.log(`handleEaterSearch: Found ${venues.length} venues.`);
    
    // Extract only the names
    const venueNames = venues.map(venue => venue.name);
    
    return { data: venueNames }; // Return array of names
  } catch (error) {
    console.error('handleEaterSearch: Error during crawler execution:', error);
    return { error: 'Crawler failed to execute', details: error instanceof Error ? error.message : String(error) };
  }
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
