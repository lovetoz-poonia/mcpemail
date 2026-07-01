import { NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export async function POST(request: Request) {
  try {
    const { originalEmail, currentDraft, tone } = await request.json();

    if (!originalEmail || !currentDraft || !tone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }

    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0.7, // Higher temp for creative rewriting
      apiKey: geminiApiKey,
    });

    const prompt = `
You are a professional email assistant. 
Your task is to REWRITE an existing drafted response to apply a specific tone.

CONTEXT EMAIL (What we are replying to):
---
${originalEmail}
---

CURRENT DRAFT:
---
${currentDraft}
---

INSTRUCTION:
Rewrite the current draft to be: ${tone.toUpperCase()}.
Do not include any pleasantries or explanation in your output, JUST return the raw email text of the rewritten draft.
Make sure the new draft still addresses the context email appropriately.
IMPORTANT: The output MUST be a properly formatted email body. Use actual double newlines (\\n\\n) to separate paragraphs. Include a professional greeting, clear paragraph breaks, and a professional closing signature.
`;

    const response = await llm.invoke(prompt);
    
    // Extract the text from the response content
    const rewrittenDraft = (response.content as string)?.trim() || currentDraft;

    return NextResponse.json({ draft: rewrittenDraft });
    
  } catch (error: any) {
    console.error("Refinement error:", error);
    return NextResponse.json({ error: error.message || "Failed to refine draft" }, { status: 500 });
  }
}
