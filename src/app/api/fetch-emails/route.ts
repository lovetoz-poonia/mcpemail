import { NextRequest, NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const maxDuration = 30;

const mockEmails = [
  {
    id: "mock1",
    sender: "sara.jenkins@innovatedigital.co",
    name: "sara jenkins",
    subject: "Phenomenal job on our mobile app launch!",
    time: "08:45 PM",
    content: "Hi Team,\n\nI just wanted to drop a quick note to say how incredibly pleased we are with the mobile app your agency launched for us last week. The design is sleek, the onboarding flows are buttery smooth, and we've already seen a 35% increase in user engagement! Your engineering team's attention to detail was top-notch.\n\nBest,\nSara",
  },
  {
    id: "mock2",
    sender: "david.miller@vertexsol.com",
    name: "david miller",
    subject: "Request for full refund on Sprint 2 deliverables",
    time: "02:52 AM",
    content: "To whom it may concern,\n\nI am writing to formally request a refund for the invoice payment of $4,500 made on June 15th for Sprint 2. Unfortunately, the milestone deliverables did not meet our initial scope requirements, and the dashboard is still throwing multiple critical errors. I would like a refund immediately.\n\nDavid",
  },
  {
    id: "mock3",
    sender: "marcus.vance@retailflow.io",
    name: "marcus vance",
    subject: "Extremely frustrated with communication delays",
    time: "Yesterday",
    content: "Hi,\n\nI have to say, I am extremely frustrated. I sent an email on Tuesday asking for an update on our API integration deliverables, and I have yet to receive a response. Our launch is scheduled in two weeks, and we cannot afford to be left in the dark like this. This lack of communication is unacceptable.\n\nMarcus",
  }
];

export async function POST(req: NextRequest) {
  let transport: StdioClientTransport | null = null;

  try {
    const { mode } = await req.json();

    if (mode === "staging") {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return NextResponse.json({ emails: mockEmails });
    }

    // LIVE MODE: Connect to Gmail MCP Server
    transport = new StdioClientTransport({
      command: "npx",
      // Using a popular community MCP server for Gmail
      args: ["-y", "@pouyanafisi/gmail-mcp"],
    });

    const mcpClient = new Client({ name: "nexus-tech", version: "1.0.0" }, { capabilities: {} });
    await mcpClient.connect(transport);

    // List tools to find the correct search/read tool dynamically
    const { tools } = await mcpClient.listTools();
    const searchTool = tools.find(t => t.name.includes("search") || t.name.includes("list_emails") || t.name === "gmail_search");

    if (!searchTool) {
      throw new Error(`Could not find a search tool in the MCP server. Available tools: ${tools.map(t => t.name).join(", ")}`);
    }

    // Call the search tool (fetching latest 20 primary emails)
    const result = await mcpClient.callTool({
      name: searchTool.name,
      arguments: {
        query: "in:inbox category:primary",
        maxResults: 20
      }
    });

    // The MCP server returns a formatted string like:
    // ID: <id>
    // Subject: <subject>
    // From: <from>
    // Date: <date>
    // 
    // ID: <id2>...

    const contentStr = (result.content as any)[0].text;
    const emailBlocks = contentStr.split(/\n\s*\n/).filter((b: string) => b.trim() !== "");

    const readTool = tools.find((t: any) => t.name === "read_email");

    const emailPromises = emailBlocks.map(async (block: string) => {
      const idMatch = block.match(/ID:\s*(.+)/);
      const subjectMatch = block.match(/Subject:\s*(.+)/);
      const fromMatch = block.match(/From:\s*(.+)/);
      const dateMatch = block.match(/Date:\s*(.+)/);

      if (idMatch && idMatch[1]) {
        const emailId = idMatch[1].trim();
        let bodyContent = "No content available.";

        // Fetch the full email body concurrently
        if (readTool) {
          try {
            const readResult = await mcpClient.callTool({
              name: readTool.name,
              arguments: { messageId: emailId }
            });
            bodyContent = (readResult.content as any)[0].text;
          } catch (err) {
            console.error("Failed to read body for", emailId, err);
          }
        }

        const senderStr = fromMatch ? fromMatch[1].trim() : "unknown@sender.com";
        const namePart = senderStr.split("<")[0].trim().replace(/['"]/g, '');

        let emailAddress = senderStr;
        const emailMatch = senderStr.match(/<([^>]+)>/);
        if (emailMatch) {
          emailAddress = emailMatch[1];
        }

        // Clean up MCP server injected headers from the email body
        let cleanBodyContent = bodyContent.trim();
        if (cleanBodyContent.startsWith('Thread ID:')) {
          const parts = cleanBodyContent.split(/\n\s*\n/);
          if (parts.length > 1 && parts[0].includes('Thread ID:') && parts[0].includes('Subject:')) {
            cleanBodyContent = parts.slice(1).join('\n\n').trim();
          }
        }

        return {
          id: emailId,
          sender: emailAddress,
          name: namePart || "Unknown",
          subject: subjectMatch ? subjectMatch[1].trim() : "No Subject",
          time: dateMatch ? dateMatch[1].trim().split(" ")[4] || "Just Now" : "Just Now",
          content: cleanBodyContent
        };
      }
      return null;
    });

    const resolvedEmails = await Promise.all(emailPromises);
    const formattedEmails = resolvedEmails.filter(Boolean);

    return NextResponse.json({ emails: formattedEmails.length > 0 ? formattedEmails : mockEmails });

  } catch (error: any) {
    console.error("MCP Fetch Error:", error);

    // Return a descriptive error so the UI can prompt the user to authenticate
    return NextResponse.json({
      error: "Failed to connect to Gmail via MCP. Please download your OAuth keys from Google Cloud and save them as 'gcp-oauth.keys.json' in the project root.",
      details: error.message
    }, { status: 500 });

  } finally {
    if (transport) {
      try {
        await transport.close();
      } catch (e) { }
    }
  }
}
