# AL Smart Mail - How It Works

Here is a short, high-level breakdown of how the **AL Smart mail** project works under the hood:

### 1. The User Interface (Frontend)
- **Built with:** Next.js, React, and TailwindCSS.
- **What it does:** It provides the beautiful "Glassmorphism" interface with a Warm & Cozy theme. It manages the state for two modes: **Staging** (which loads instant dummy emails for fast UI testing) and **Live Gmail** (which connects to your real inbox). 

### 2. Fetching Emails (MCP Integration)
- **How it works:** When in Live mode, the app hits the `/api/fetch-emails` endpoint. 
- **The Magic:** Instead of writing complex Google API code manually, the app spins up a background **MCP (Model Context Protocol) Server** (`@pouyanafisi/gmail-mcp`). It talks to this server using standard input/output (Stdio) to securely fetch your live Gmail messages using your configured OAuth credentials.

### 3. AI Analysis & Smart Drafting (LangChain + Gemini)
- **How it works:** When you click on an email, the app sends the email's content to the `/api/analyze` endpoint.
- **The Magic:** This endpoint uses **LangChain** to connect to Google's **Gemini 2.5 Flash** AI model. It uses "Structured Output" (Zod) to force the AI to return a perfect JSON object containing:
  - The Sentiment (Positive/Negative/Neutral)
  - The Category (Complaint, Follow-up, etc.)
  - A Recommended Action
  - A fully written, perfectly formatted **Drafted Reply** (with proper line breaks and paragraphing).

### 4. Refining the Draft
- **How it works:** If you click "Shorter" or "Formal", the app hits `/api/refine-draft`. It sends the current draft back to Gemini with strict formatting constraints to rewrite it into the requested tone without adding weird conversational pleasantries.

### 5. Sending the Email
- **How it works:** When you click "Send Reply", it hits `/api/send-email`, which passes the final draft back to the Gmail MCP server, successfully dispatching it to the recipient.

In short: **Next.js** handles the UI, **MCP** handles the secure connection to Gmail, and **Gemini (via LangChain)** acts as the intelligent brain reading, classifying, and drafting replies to your emails!
