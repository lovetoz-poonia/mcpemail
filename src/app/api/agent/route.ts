import { NextRequest, NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { z } from "zod";

export const maxDuration = 60; // Allow up to 60 seconds for the agent to run

export async function POST(req: NextRequest) {
  let transport: StdioClientTransport | null = null;
  
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey || geminiApiKey === "your_gemini_api_key_here") {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing or invalid in environment variables." },
        { status: 500 }
      );
    }

    console.log("Starting MCP Stdio Transport...");
    // Initialize the MCP client via Stdio to the Gmail server
    transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@pouyanafisi/gmail-mcp"],
    });

    const mcpClient = new Client({
      name: "nextjs-agent-client",
      version: "1.0.0",
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log("Connected to MCP Server!");

    // List tools from the MCP server
    const toolsResponse = await mcpClient.listTools();
    const mcpTools = toolsResponse.tools;
    console.log(`Found ${mcpTools.length} tools from MCP.`);

    // Convert MCP tools to LangChain DynamicTools
    const langchainTools = mcpTools.map(tool => {
      // Create a tool that asks the LLM to pass a JSON string matching the schema.
      return new DynamicTool({
        name: tool.name,
        description: `${tool.description || `Tool ${tool.name}`}\n\nIMPORTANT: You must pass a single JSON object string matching this schema: ${JSON.stringify(tool.inputSchema)}`,
        func: async (input: string) => {
          console.log(`Executing tool ${tool.name} with input:`, input);
          try {
            // Some models might pass valid JSON string, some might pass stringified JSON.
            // If it's already an object, use it directly (handled by LLM framework sometimes).
            const args = typeof input === "string" ? JSON.parse(input) : input;
            
            const result = await mcpClient.callTool({
              name: tool.name,
              arguments: args,
            });
            
            return JSON.stringify(result.content);
          } catch (e) {
            console.error(`Error executing tool ${tool.name}:`, e);
            return `Error executing tool: ${e}`;
          }
        },
      });
    });

    // Initialize LangChain Gemini model
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0.2,
      apiKey: geminiApiKey,
    });

    const agent = createReactAgent({
      llm,
      tools: langchainTools,
      messageModifier: new SystemMessage(
        "You are an intelligent email assistant. You can read emails, categorize them, and create draft responses. Always be professional. Use the provided tools to interact with Gmail. You have access to tools that take a JSON string argument. Make sure to format your tool inputs exactly as a valid JSON string containing the required parameters."
      )
    });

    console.log("Invoking agent...");
    const result = await agent.invoke({
      messages: [new HumanMessage(prompt)],
    });

    const lastMessage = result.messages[result.messages.length - 1];

    return NextResponse.json({ output: lastMessage.content });
    
  } catch (error: any) {
    console.error("Agent Error:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 });
  } finally {
    if (transport) {
      console.log("Closing MCP transport...");
      try {
        await transport.close();
      } catch (e) {
        console.error("Error closing transport:", e);
      }
    }
  }
}
