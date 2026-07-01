import { NextRequest, NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let transport: StdioClientTransport | null = null;
  
  try {
    const { to, subject, body, threadId, mode } = await req.json();

    // DEBUG
    require('fs').writeFileSync('/Users/gaurav/gaurav_workspace/MCP-APP/debug-send.json', JSON.stringify({ to, subject, body, threadId, mode }, null, 2));

    if (mode === "staging") {
      // Simulate sending
      await new Promise((resolve) => setTimeout(resolve, 800));
      return NextResponse.json({ success: true, message: "Simulated send successful in staging mode." });
    }

    // LIVE MODE: Connect to Gmail MCP Server
    transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@pouyanafisi/gmail-mcp"],
    });

    const mcpClient = new Client({ name: "nexus-tech-sender", version: "1.0.0" }, { capabilities: {} });
    await mcpClient.connect(transport);

    // List tools to find the correct send/draft tool dynamically
    const { tools } = await mcpClient.listTools();
    const sendTool = tools.find(t => t.name.includes("send") || t.name === "gmail_send_email");
    
    if (!sendTool) {
      throw new Error(`Could not find a send tool in the MCP server. Available tools: ${tools.map(t => t.name).join(", ")}`);
    }

    // Extract actual email address from "Name <email@domain.com>"
    const extractEmail = (str: string) => {
      const match = str.match(/<([^>]+)>/);
      return match ? match[1] : str.trim();
    };
    
    const cleanTo = Array.isArray(to) ? to.map(extractEmail) : [extractEmail(to)];

    // Call the send tool. The @pouyanafisi/gmail-mcp package has a bug where it filters out empty lines
    // between headers and the body. Prepending '\r\n' to the body acts as the required RFC822 separator.
    const result = await mcpClient.callTool({
      name: sendTool.name,
      arguments: {
        to: cleanTo,
        subject: subject,
        body: "\r\n" + body,
        ...(threadId ? { threadId } : {})
      }
    });

    return NextResponse.json({ success: true, result: result.content });

  } catch (error: any) {
    console.error("MCP Send Error:", error);
    return NextResponse.json({ 
      error: "Failed to send email via MCP. Ensure 'gcp-oauth.keys.json' is present in the project root.",
      details: error.message
    }, { status: 500 });
  } finally {
    if (transport) {
      try {
        await transport.close();
      } catch (e) {}
    }
  }
}
