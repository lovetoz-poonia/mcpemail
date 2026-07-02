import { NextRequest, NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

export const maxDuration = 60;

const analysisSchema = z.object({
  sentiment: z.enum(["Positive", "Negative", "Neutral"]).describe("The overall sentiment of the email tone."),
  category: z.string().describe("Categorize this email (e.g., 'Good Feedback', 'Complaint', 'Refund Request', 'General Inquiry')."),
  priority: z.enum(["High", "Medium", "Low"]).describe("The priority or severity of the email based on customer sentiment, urgency, or issue type."),
  confidenceScore: z.number().min(0).max(100).describe("How confident the model is in this analysis (0-100)."),
  recommendedAction: z.string().describe("A brief, one sentence recommendation for what the human or system should do next."),
  extractedDetails: z.array(z.string()).describe("A list of 3-5 bullet points extracting the most critical facts, numbers, or statements from the email. Wrap important entities like dates, names, IDs, amounts, core concerns, and strong sentiment/emotion words in markdown bold (**text**)."),
  draftedReply: z.string().describe("A professional drafted reply. You MUST format this string with actual newline characters (\\n\\n) to separate paragraphs. For example: 'Dear [Name],\\n\\nBody paragraph.\\n\\nSincerely,\\nCustomer Support Team'")
});

export async function POST(req: NextRequest) {
  try {
    const { emailContext } = await req.json();

    if (!emailContext) {
      return NextResponse.json({ error: "emailContext is required" }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey || geminiApiKey === "your_gemini_api_key_here") {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing or invalid in environment variables." },
        { status: 500 }
      );
    }

    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0.2,
      apiKey: geminiApiKey,
    });

    const structuredLlm = llm.withStructuredOutput(analysisSchema);

    const prompt = `
You are an expert AI Customer Support Analyst. Read the following customer email and provide a detailed structured analysis, including a drafted reply.

Customer Email:
================
${emailContext}
================

Follow the schema rules exactly.
`;

    const result = await structuredLlm.invoke(prompt);

    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 });
  }
}
