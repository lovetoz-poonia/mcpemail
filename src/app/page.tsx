"use client";

import { useState, useEffect } from "react";
import {
  Menu, Search, Settings, Grid, Mail, Inbox,
  AlertCircle, CheckCircle2, RefreshCw, Send, Sparkles,
  Info, Pen, ChevronLeft, ChevronRight, Archive,
  Trash2, Clock, Star, ArrowLeft, MoreVertical, File, Flag,
  ThumbsUp, ThumbsDown, Headphones, Reply
} from "lucide-react";

// Types
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://al-mcp-mail-service-worker.abstractworldknowledge.workers.dev';
type Email = {
  id: string; threadId?: string; sender: string; name: string; subject: string; time: string; content: string; receivedTimestamp?: number; isFollowUp?: boolean; isUnread?: boolean; analysis?: Analysis;
};
type Analysis = {
  sentiment: "Positive" | "Negative" | "Neutral"; category: string; priority: "High" | "Medium" | "Low"; confidenceScore: number; recommendedAction: string; extractedDetails: string[]; draftedReply: string;
};

const getCategoryColor = (analysis: Analysis | null | undefined) => {
  if (!analysis) return 'bg-transparent text-slate-600 border border-slate-300';
  const category = analysis.category.toUpperCase();
  if (category.includes('COMPLAINT') && !category.includes('FOLLOW')) return 'bg-transparent text-rose-600 border border-rose-300';
  if (category.includes('FOLLOW')) return 'bg-transparent text-emerald-600 border border-emerald-300';
  if (category.includes('FEEDBACK') || analysis.sentiment === 'Positive') return 'bg-transparent text-blue-600 border border-blue-300';
  if (analysis.sentiment === 'Negative') return 'bg-transparent text-rose-600 border border-rose-300';
  return 'bg-transparent text-indigo-600 border border-indigo-300';
};

const renderWithBold = (text: string) => {
  if (text.includes('**')) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-extrabold text-indigo-900 bg-indigo-50/50 px-1 rounded-sm">{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  }

  if (text.includes(':')) {
    const firstColonIdx = text.indexOf(':');
    const key = text.substring(0, firstColonIdx + 1);
    const val = text.substring(firstColonIdx + 1);
    return (
      <>
        <strong className="font-extrabold text-indigo-900 bg-indigo-50/50 px-1 rounded-sm">{key}</strong>
        <span>{val}</span>
      </>
    );
  }

  return <span>{text}</span>;
};

const getTATInfo = (receivedTimestamp?: number) => {
  if (!receivedTimestamp) return null;
  const elapsedMs = Date.now() - receivedTimestamp;
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
  const isBreached = hours >= 4;

  let label = '';
  if (hours > 0) label += `${hours}h `;
  label += `${minutes}m`;

  return { label, isBreached };
};

export default function SupportDesk() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mode, setMode] = useState<"staging" | "live">("live");
  const [activeAccount, setActiveAccount] = useState<string>("default");
  const [emails, setEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const [analysisMap, setAnalysisMap] = useState<Record<string, Analysis | null>>({});
  const [analyzingMap, setAnalyzingMap] = useState<Record<string, boolean>>({});
  const [sendingState, setSendingState] = useState<Record<string, boolean>>({});
  const [sendingSummaryState, setSendingSummaryState] = useState<Record<string, boolean>>({});
  const [isSendingGlobalSummary, setIsSendingGlobalSummary] = useState(false);
  const [draftContentMap, setDraftContentMap] = useState<Record<string, string>>({});
  const [isRefiningMap, setIsRefiningMap] = useState<Record<string, boolean>>({});
  const [tatStartMap, setTatStartMap] = useState<Record<string, number>>({});

  const [isAutoPiloting, setIsAutoPiloting] = useState(false);
  const [autoPilotProgress, setAutoPilotProgress] = useState({ current: 0, total: 0 });

  const [toast, setToast] = useState<{ message: string, type: "success" | "error" | "info" } | null>(null);
  const [emailFilter, setEmailFilter] = useState<"ALL" | "GOOD" | "BAD" | "SUPPORT" | "FOLLOWUP" | "HIGH_PRIORITY" | "TAT_BREACHED">("ALL");

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatDisplayTime = (timestamp?: number, fallback?: string) => {
    if (!timestamp) return fallback;
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const sendSummaryToStakeholder = async (email: Email, analysis: Analysis) => {
    try {
      const summaryBody = `
📋 EMAIL SUMMARY REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 TITLE: ${email.subject}
👤 FROM: ${email.name} <${email.sender}>
🏷️ CATEGORY: ${analysis.category}
🎭 SENTIMENT: ${analysis.sentiment}
🚨 PRIORITY: ${analysis.priority}

💡 SUMMARY & DETAILS:
${analysis.extractedDetails.map(d => `• ${d.replace(/\*\*/g, '')}`).join('\n')}

🚀 RECOMMENDED ACTION:
${analysis.recommendedAction}
      `.trim();

      await fetch(`${API_URL}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "pratik.poojari@abstractlayers.com",
          subject: `Summary Report: ${email.subject}`,
          body: summaryBody,
          mode,
          accountId: activeAccount
        })
      });
    } catch (e) {
      console.error("Failed to auto-send summary", e);
    }
  };

  const logTransaction = async (email: Email, analysis: Analysis) => {
    try {
      await fetch(`${API_URL}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: email.id,
          threadId: email.threadId || email.id,
          sender: email.sender,
          subject: email.subject,
          category: analysis.category,
          sentiment: analysis.sentiment,
          priority: analysis.priority,
          receivedTime: email.time,
          status: "ANALYZED"
        })
      });
    } catch (e) {
      console.error("Failed to log transaction", e);
    }
  };

  const autoAnalyzeEmails = async (targetEmails: Email[], showPrompt = false) => {
    // For demo purposes, limit the automatic analysis to the first 5 emails
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const emailsToAnalyze = targetEmails.filter(e =>
      e.isUnread &&
      (e.receivedTimestamp || 0) > oneDayAgo &&
      !e.analysis &&
      !analysisMap[e.id]
    ).slice(0, 5);

    if (emailsToAnalyze.length === 0) return;
    if (showPrompt && !confirm(`Are you sure you want to automatically analyze ${emailsToAnalyze.length} emails?`)) return;

    setIsAutoPiloting(true);
    setAutoPilotProgress({ current: 0, total: emailsToAnalyze.length });

    const newlyAnalyzed: { email: Email; analysis: Analysis }[] = [];

    for (let i = 0; i < emailsToAnalyze.length; i++) {
      const email = emailsToAnalyze[i];
      setAutoPilotProgress({ current: i + 1, total: emailsToAnalyze.length });

      if (email.analysis) continue;
      let alreadyAnalyzed = false;
      setAnalysisMap(prev => {
        if (prev[email.id]) alreadyAnalyzed = true;
        return prev;
      });
      if (alreadyAnalyzed) continue;

      try {
        setAnalyzingMap(prev => ({ ...prev, [email.id]: true }));
        const emailContext = `From: ${email.name} <${email.sender}>\nSubject: ${email.subject}\n\n${email.content}`;
        const analyzeRes = await fetch(`${API_URL}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailContext,
            emailId: email.id,
            threadId: email.threadId,
            sender: email.sender,
            subject: email.subject,
            receivedTime: email.time
          })
        });
        if (!analyzeRes.ok) continue;
        const analysis: Analysis = await analyzeRes.json();
        setAnalysisMap(prev => ({ ...prev, [email.id]: analysis }));
        setDraftContentMap(prev => ({ ...prev, [email.id]: analysis.draftedReply }));
        setTatStartMap(prev => ({ ...prev, [email.id]: Date.now() }));
        newlyAnalyzed.push({ email, analysis });
        sendSummaryToStakeholder(email, analysis);
        logTransaction(email, analysis);
      } catch (err) {
        console.error(err);
      } finally {
        setAnalyzingMap(prev => ({ ...prev, [email.id]: false }));
      }
      await new Promise(r => setTimeout(r, 600)); // Rate limit buffer
    }

    setIsAutoPiloting(false);
  };

  const fetchEmails = async () => {
    if (!isLoggedIn) return;
    setLoadingEmails(true);
    try {
      const res = await fetch(`${API_URL}/api/fetch-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, accountId: activeAccount })
      });
      const data = await res.json();
      if (res.ok && data.emails) {
        setEmails(data.emails);
        const newAnalysisMap: Record<string, Analysis> = {};
        const newDraftMap: Record<string, string> = {};
        data.emails.forEach((email: any) => {
          if (email.analysis) {
            newAnalysisMap[email.id] = email.analysis;
            newDraftMap[email.id] = email.analysis.draftedReply;
          }
        });
        setAnalysisMap(prev => ({ ...prev, ...newAnalysisMap }));
        setDraftContentMap(prev => ({ ...prev, ...newDraftMap }));
        // Automatically start analyzing the newly fetched emails in the background
        autoAnalyzeEmails(data.emails, false);
      } else {
        showToast(data.error || "Failed to fetch emails.", "error");
        if (mode === "live") setMode("staging");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEmails(false);
    }
  };

  useEffect(() => {
    // We intentionally ignore dependency warnings here as fetchEmails relies on state
    // that doesn't need to trigger re-renders infinitely.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isLoggedIn) fetchEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeAccount, isLoggedIn]);

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    if (!analysisMap[email.id] && !analyzingMap[email.id]) {
      analyzeEmail(email);
    }
  };

  const analyzeEmail = async (email: Email) => {
    setAnalyzingMap(prev => ({ ...prev, [email.id]: true }));
    try {
      const emailContext = `From: ${email.name} <${email.sender}>\nSubject: ${email.subject}\n\n${email.content}`;
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailContext,
          emailId: email.id,
          threadId: email.threadId,
          sender: email.sender,
          subject: email.subject,
          receivedTime: email.time
        })
      });
      const analysis: Analysis = await res.json();
      if (res.ok) {
        setAnalysisMap(prev => ({ ...prev, [email.id]: analysis }));
        setDraftContentMap(prev => ({ ...prev, [email.id]: analysis.draftedReply }));
        setTatStartMap(prev => ({ ...prev, [email.id]: Date.now() }));

        sendSummaryToStakeholder(email, analysis);
        logTransaction(email, analysis);
      } else {
        showToast("Failed to analyze email.", "error");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzingMap(prev => ({ ...prev, [email.id]: false }));
    }
  };

  const handleRefineDraft = async (tone: string) => {
    if (!selectedEmail || !currentAnalysis) return;
    const currentDraft = draftContentMap[selectedEmail.id] || currentAnalysis.draftedReply;
    setIsRefiningMap(prev => ({ ...prev, [selectedEmail.id]: true }));
    try {
      const res = await fetch(`${API_URL}/api/refine-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailContext: selectedEmail.content,
          currentDraft: currentDraft,
          action: tone
        })
      });
      const data = await res.json();
      if (res.ok && data.refinedDraft) {
        showToast("Draft updated successfully!", "success");
        setDraftContentMap(prev => ({ ...prev, [selectedEmail.id]: data.refinedDraft }));
      } else {
        showToast("Failed to refine tone.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error refining tone.", "error");
    } finally {
      setIsRefiningMap(prev => ({ ...prev, [selectedEmail.id]: false }));
    }
  };

  const handleSendEmail = async () => {
    if (!selectedEmail || !currentAnalysis) return;
    setSendingState(prev => ({ ...prev, [selectedEmail.id]: true }));
    try {
      const res = await fetch(`${API_URL}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedEmail.sender,
          subject: `Re: ${selectedEmail.subject}`,
          body: currentDraft,
          threadId: selectedEmail.id,
          mode,
          accountId: activeAccount
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Email sent successfully!", "success");

        const tatSeconds = tatStartMap[selectedEmail.id] ? Math.floor((Date.now() - tatStartMap[selectedEmail.id]) / 1000) : 0;
        fetch(`${API_URL}/api/transactions/${selectedEmail.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedEmail.id,
            repliedTime: new Date().toISOString(),
            tatSeconds: tatSeconds,
            status: "REPLIED"
          })
        }).catch(e => console.error("Failed to update TAT", e));

      } else {
        showToast("Failed to send: " + (data.error || data.details || "Unknown error"), "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error sending email.", "error");
    } finally {
      setSendingState(prev => ({ ...prev, [selectedEmail.id]: false }));
    }
  };

  const handleSendSummary = async () => {
    if (!selectedEmail || !currentAnalysis) return;
    setSendingSummaryState(prev => ({ ...prev, [selectedEmail.id]: true }));
    try {
      const summaryBody = `
📋 EMAIL SUMMARY REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 TITLE: ${selectedEmail.subject}
👤 FROM: ${selectedEmail.name} <${selectedEmail.sender}>
🏷️ CATEGORY: ${currentAnalysis.category}
🎭 SENTIMENT: ${currentAnalysis.sentiment}

💡 SUMMARY & DETAILS:
${currentAnalysis.extractedDetails.map(d => `• ${d.replace(/\*\*/g, '')}`).join('\n')}

🚀 RECOMMENDED ACTION:
${currentAnalysis.recommendedAction}
      `.trim();

      const res = await fetch(`${API_URL}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "pratik.poojari@abstractlayers.com",
          subject: `Summary Report: ${selectedEmail.subject}`,
          body: summaryBody,
          mode,
          accountId: activeAccount
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Summary sent to stakeholder successfully!", "success");
      } else {
        showToast("Failed to send summary: " + (data.error || data.details || "Unknown error"), "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error sending summary.", "error");
    } finally {
      setSendingSummaryState(prev => ({ ...prev, [selectedEmail.id]: false }));
    }
  };

  const handleSendGlobalSummary = async () => {
    setIsSendingGlobalSummary(true);
    try {
      const analyzedEmails = filteredEmails.filter(e => analysisMap[e.id]);

      if (analyzedEmails.length === 0) {
        showToast("No analyzed emails to summarize in the current view.", "info");
        return;
      }

      let summaryBody = `📋 GLOBAL EMAIL SUMMARY REPORT\n`;
      summaryBody += `Total Emails Analyzed: ${analyzedEmails.length}\n`;
      summaryBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      const emailBlocks = analyzedEmails.map((email, index) => {
        const analysis = analysisMap[email.id]!;
        return `📧 EMAIL #${index + 1}
📌 TITLE: ${email.subject}
👤 FROM: ${email.name} <${email.sender}>
🏷️ CATEGORY: ${analysis.category}
🎭 SENTIMENT: ${analysis.sentiment}

💡 DETAILS:
${analysis.extractedDetails.map(d => `• ${d.replace(/\*\*/g, '')}`).join('\n')}

🚀 ACTION:
${analysis.recommendedAction}`;
      });

      summaryBody += emailBlocks.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

      const res = await fetch(`${API_URL}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "pratik.poojari@abstractlayers.com",
          subject: `Global Support Desk Report (${analyzedEmails.length} emails)`,
          body: summaryBody.trim(),
          mode
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Global summary report sent to stakeholder successfully!", "success");
      } else {
        showToast("Failed to send report: " + (data.error || data.details || "Unknown error"), "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error sending report.", "error");
    } finally {
      setIsSendingGlobalSummary(false);
    }
  };

  const runAutoPilot = () => {
    autoAnalyzeEmails(emails, true);
  };

  const filteredEmails = emails.filter(email => {
    if (emailFilter === "ALL") return true;
    if (emailFilter === "TAT_BREACHED") {
      const tatInfo = getTATInfo(email.receivedTimestamp);
      return tatInfo ? tatInfo.isBreached : false;
    }

    const analysis = analysisMap[email.id];
    if (!analysis) return false;

    if (emailFilter === "GOOD" && analysis.sentiment === "Positive") return true;
    if (emailFilter === "BAD" && (analysis.sentiment === "Negative" || analysis.category === "COMPLAINT")) return true;
    if (emailFilter === "SUPPORT" && (analysis.category === "INQUIRY" || analysis.sentiment === "Neutral")) return true;
    if (emailFilter === "FOLLOWUP" && email.isFollowUp) return true;
    if (emailFilter === "HIGH_PRIORITY" && analysis.priority === "High") return true;
    return false;
  });

  const currentAnalysis = selectedEmail ? analysisMap[selectedEmail.id] : null;
  const isAnalyzing = selectedEmail ? analyzingMap[selectedEmail.id] : false;
  const isSending = selectedEmail ? sendingState[selectedEmail.id] : false;
  const isSendingSummary = selectedEmail ? sendingSummaryState[selectedEmail.id] : false;
  const isRefining = selectedEmail ? isRefiningMap[selectedEmail.id] : false;
  const currentDraft = selectedEmail ? (draftContentMap[selectedEmail.id] || currentAnalysis?.draftedReply || "").replace(/\\n/g, '\n') : "";

  const renderEmailContent = (content: string) => {
    // Pre-process: fix dangling asterisks and excessive newlines
    let rawLines = content.split('\n');
    let cleanedLines: string[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i].trim();
      if (line === '*' || line === '-') {
        // Dangling bullet: attach it to the next non-empty line
        let nextIdx = i + 1;
        while (nextIdx < rawLines.length && rawLines[nextIdx].trim() === '') nextIdx++;
        if (nextIdx < rawLines.length) {
          cleanedLines.push('* ' + rawLines[nextIdx].trim());
          i = nextIdx;
          continue;
        }
      } else if ((line.startsWith('*') || line.startsWith('-')) && line.length > 1 && line[1] !== ' ') {
        // Missing space after bullet
        cleanedLines.push('* ' + line.substring(1).trim());
        continue;
      }
      cleanedLines.push(rawLines[i]);
    }

    const lines: string[] = [];
    let emptyCount = 0;
    for (const line of cleanedLines) {
      if (line.trim() === '') {
        emptyCount++;
        if (emptyCount > 1) continue;
      } else {
        emptyCount = 0;
      }
      lines.push(line);
    }

    let quoteBlock: string[] = [];
    const elements: React.ReactNode[] = [];
    let isAttachmentSection = false;
    let attachmentLines: string[] = [];
    let bulletBlock: string[] = [];

    const flushBullets = () => {
      if (bulletBlock.length > 0) {
        elements.push(
          <ul key={`bullets-${elements.length}`} className="list-disc pl-6 my-4 space-y-1.5 text-zinc-800 marker:text-zinc-400 font-medium">
            {bulletBlock.map((b, i) => <li key={i} className="pl-1">{b.replace(/^[\*\-]\s*/, '')}</li>)}
          </ul>
        );
        bulletBlock = [];
      }
    };

    const flushQuote = () => {
      if (quoteBlock.length > 0) {
        elements.push(
          <div key={`quote-${elements.length}`} className="pl-4 border-l-2 border-zinc-300 text-zinc-500 my-4 bg-zinc-50/50 py-2 rounded-r-md">
            {quoteBlock.map((q, i) => <div key={i} className="min-h-[1.5rem] break-words">{q.replace(/^>\s?/, '')}</div>)}
          </div>
        );
        quoteBlock = [];
      }
    };

    const flushAttachments = () => {
      if (attachmentLines.length > 0) {
        elements.push(
          <div key={`attachments-${elements.length}`} className="mt-8 p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2"><File className="w-3.5 h-3.5" /> Attachments Info</div>
            <div className="text-xs text-zinc-500 break-all space-y-1.5 max-h-32 overflow-y-auto">
              {attachmentLines.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        );
        attachmentLines = [];
      }
    };

    lines.forEach((line, index) => {
      if (line.trim().startsWith('Attachments (')) {
        isAttachmentSection = true;
        flushBullets();
        flushQuote();
      }

      if (isAttachmentSection) {
        attachmentLines.push(line);
      } else {
        if (line.trim().startsWith('>')) {
          flushBullets();
          quoteBlock.push(line);
        } else if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          flushQuote();
          bulletBlock.push(line.trim());
        } else {
          flushQuote();
          flushBullets();
          // Detect image placeholders like [image.png]
          if (line.trim().match(/^\[.*(?:png|jpg|jpeg|gif|pdf|docx|xlsx|PNG|JPG|JPEG).*\]$/i)) {
            elements.push(<div key={index} className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-zinc-600 text-[11px] font-medium rounded-md my-1.5 shadow-sm border border-zinc-200"><File className="w-3.5 h-3.5" /> {line.trim().slice(1, -1)}</div>);
          } else if (line.trim().match(/^On .* wrote:$/) || line.trim().match(/^<.*>$/) || line.trim().match(/^On .* wrote: /)) {
            elements.push(<div key={index} className="text-zinc-400 mt-5 min-h-[1.5rem]">{line}</div>);
          } else {
            elements.push(<div key={index} className="min-h-[1.5rem] break-words [overflow-wrap:anywhere] [word-break:break-word]">{line}</div>);
          }
        }
      }
    });
    flushBullets();
    flushQuote();
    flushAttachments();

    return <div className="space-y-0.5">{elements}</div>;
  };


  const accounts = [
    { id: "default", email: "abstractworldknowledge@gmail.com", name: "Abstract World", initials: "AW", gradient: "from-indigo-500 to-purple-600" }
  ];

  const currentAcc = accounts.find(a => a.id === activeAccount) || accounts[0];

  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F4F5F7] font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/80 via-purple-50/80 to-teal-100/80 -z-10"></div>

        <div className="bg-white/70 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_20px_80px_rgba(0,0,0,0.08)] border border-white p-12 max-w-2xl w-full mx-4 flex flex-col items-center text-center relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-8">
            <Mail className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight mb-2">Welcome to AL Support Desk</h1>
          <p className="text-zinc-500 mb-10 font-medium text-[15px]">Sign in to continue and configure your Gmail access.</p>

          <div className="flex flex-col items-center w-full max-w-sm">
            <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm flex flex-col items-center gap-4 text-center w-full mb-6">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${accounts[0].gradient} flex items-center justify-center text-white text-2xl font-black shadow-inner shadow-white/20`}>
                {accounts[0].initials}
              </div>
              <div>
                <h3 className="font-extrabold text-zinc-900 text-lg">{accounts[0].name}</h3>
                <p className="text-[13px] text-zinc-500 font-medium truncate">{accounts[0].email}</p>
              </div>
            </div>

            <button
              onClick={() => { setActiveAccount(accounts[0].id); setIsLoggedIn(true); }}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 text-[14px] uppercase tracking-widest transition-all shadow-lg shadow-zinc-900/20"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F4F5F7] font-sans selection:bg-zinc-200 selection:text-zinc-900 text-zinc-900 relative p-4 lg:p-6">

      {/* Subtle Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 -z-10"></div>

      {/* Floating App Container */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto bg-white/70 backdrop-blur-3xl rounded-[2rem] shadow-[0_16px_60px_rgba(0,0,0,0.1)] border border-white flex flex-col overflow-hidden relative z-10">

        {/* Minimalist Top Header */}
        <header className="h-16 px-6 flex items-center justify-between shrink-0 bg-white/50 backdrop-blur-md relative z-20 border-b border-white/60">
          <div className="flex items-center gap-3 w-64">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20"><Mail className="w-4 h-4" /></div>
            <span className="font-extrabold text-zinc-900 tracking-tight text-[15px]">AL Support Desk</span>
          </div>

          <div className="flex-1 max-w-xl">
            <div className="bg-black/5 focus-within:bg-white focus-within:shadow-md transition-all rounded-2xl flex items-center px-4 py-2 ring-1 ring-transparent focus-within:ring-indigo-500/20">
              <Search className="w-4 h-4 text-zinc-500 mr-3" />
              <input type="text" placeholder="Search mail" className="bg-transparent border-none outline-none w-full placeholder:text-zinc-400 text-[14px] font-medium text-zinc-900" />
            </div>
          </div>

          <div className="flex items-center gap-4 w-64 justify-end">
            <button className="text-zinc-500 hover:text-indigo-600 transition-colors"><Settings className="w-5 h-5" /></button>
            <button className="text-zinc-500 hover:text-indigo-600 transition-colors"><Grid className="w-5 h-5" /></button>
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${currentAcc.gradient} shadow-sm flex items-center justify-center font-bold text-xs text-white ml-2 relative overflow-hidden`}>
              <span className="relative z-10">{currentAcc.initials}</span>
            </div>
          </div>
        </header>

        {/* Main Interface Layout */}
        <div className="flex flex-1 overflow-hidden relative z-0">

          {/* Translucent Left Sidebar */}
          <aside className="w-64 flex flex-col bg-white/40 backdrop-blur-xl border-r border-white/60 pt-6 pb-6 shrink-0">
            <nav className="flex flex-col gap-2 px-4">
              <button onClick={() => { setSelectedEmail(null); setEmailFilter("ALL"); }} className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[14px] ${emailFilter === 'ALL' ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-white text-indigo-700' : 'text-zinc-600 hover:bg-white/60 border border-transparent'}`}>
                <div className="flex items-center gap-3"><Inbox className={`w-4 h-4 ${emailFilter === 'ALL' ? 'text-indigo-500' : ''}`} /> Primary</div>
                <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${emailFilter === 'ALL' ? 'bg-indigo-50 text-indigo-700' : 'bg-black/5 text-zinc-500'}`}>{emails.length}</span>
              </button>
              <button onClick={() => { setSelectedEmail(null); setEmailFilter("GOOD"); }} className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[14px] ${emailFilter === 'GOOD' ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-white text-indigo-700' : 'text-zinc-600 hover:bg-white/60 border border-transparent'}`}>
                <div className="flex items-center gap-3"><ThumbsUp className={`w-4 h-4 ${emailFilter === 'GOOD' ? 'text-indigo-500' : ''}`} /> Positive Feedback</div>
              </button>
              <button onClick={() => { setSelectedEmail(null); setEmailFilter("BAD"); }} className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[14px] ${emailFilter === 'BAD' ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-white text-indigo-700' : 'text-zinc-600 hover:bg-white/60 border border-transparent'}`}>
                <div className="flex items-center gap-3"><ThumbsDown className={`w-4 h-4 ${emailFilter === 'BAD' ? 'text-indigo-500' : ''}`} /> Escalated Feedback</div>
              </button>
              <button onClick={() => { setSelectedEmail(null); setEmailFilter("SUPPORT"); }} className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[14px] ${emailFilter === 'SUPPORT' ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-white text-indigo-700' : 'text-zinc-600 hover:bg-white/60 border border-transparent'}`}>
                <div className="flex items-center gap-3"><Headphones className={`w-4 h-4 ${emailFilter === 'SUPPORT' ? 'text-indigo-500' : ''}`} /> Support</div>
              </button>
              <button onClick={() => { setSelectedEmail(null); setEmailFilter("FOLLOWUP"); }} className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[14px] ${emailFilter === 'FOLLOWUP' ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-white text-indigo-700' : 'text-zinc-600 hover:bg-white/60 border border-transparent'}`}>
                <div className="flex items-center gap-3"><Reply className={`w-4 h-4 ${emailFilter === 'FOLLOWUP' ? 'text-indigo-500' : ''}`} /> Follow-up</div>
              </button>
              <button onClick={() => { setSelectedEmail(null); setEmailFilter("HIGH_PRIORITY"); }} className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[14px] ${emailFilter === 'HIGH_PRIORITY' ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-white text-indigo-700' : 'text-zinc-600 hover:bg-white/60 border border-transparent'}`}>
                <div className="flex items-center gap-3"><AlertCircle className={`w-4 h-4 ${emailFilter === 'HIGH_PRIORITY' ? 'text-red-500' : ''}`} /> High Priority</div>
              </button>
              <button onClick={() => { setSelectedEmail(null); setEmailFilter("TAT_BREACHED"); }} className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[14px] ${emailFilter === 'TAT_BREACHED' ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-white text-indigo-700' : 'text-zinc-600 hover:bg-white/60 border border-transparent'}`}>
                <div className="flex items-center gap-3"><Clock className={`w-4 h-4 ${emailFilter === 'TAT_BREACHED' ? 'text-amber-500' : ''}`} /> TAT Breached</div>
              </button>
            </nav>

            <div className="mt-auto px-4">

              {/* Gmail Account Switcher */}
              <div className="bg-zinc-50 rounded-[20px] p-4 flex flex-col gap-2 border border-zinc-100 shadow-sm mb-3">
                <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-500 mb-1">Gmail Account</h3>
                {([
                  { id: "default", email: "abstractworldknowledge@gmail.com", initials: "AW", gradient: "from-indigo-400 to-purple-500" }
                ] as { id: string; email: string; initials: string; gradient: string }[]).map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => { setActiveAccount(acc.id); setSelectedEmail(null); setEmails([]); setAnalysisMap({}); }}
                    className={`text-left py-2.5 px-3 rounded-xl flex items-center gap-2.5 transition font-bold ${activeAccount === acc.id
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                        : "bg-white hover:bg-zinc-50 text-zinc-700 shadow-sm border border-zinc-200"
                      }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${acc.gradient} flex items-center justify-center text-white text-[9px] font-black shrink-0`}>{acc.initials}</div>
                    <span className="text-[11px] truncate">{acc.email}</span>
                  </button>
                ))}
              </div>

              <div className="bg-zinc-50 rounded-[20px] p-5 flex flex-col gap-3 border border-zinc-100 shadow-sm">
                <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-500">Agent Mode</h3>
                <button onClick={() => { setMode("live"); setSelectedEmail(null); }} className={`text-[14px] py-2.5 px-4 rounded-xl flex items-center gap-2 transition font-bold ${mode === "live" ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/20" : "bg-white hover:bg-zinc-50 text-zinc-700 shadow-sm border border-zinc-200"}`}>Live Gmail</button>
              </div>

              <button onClick={() => { setIsLoggedIn(false); setEmails([]); setAnalysisMap({}); setSelectedEmail(null); }} className="mt-4 w-full py-2.5 rounded-xl font-bold text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-colors text-[13px]">
                Log Out
              </button>
            </div>
          </aside>

          {/* App Window */}
          <main className="flex-1 bg-white/30 backdrop-blur-2xl flex flex-col overflow-hidden relative">
            {!selectedEmail ? (

              /* INBOX LIST VIEW */
              <div className="flex flex-col h-full overflow-hidden bg-transparent">
                {/* Toolbar */}
                <div className="h-16 px-6 border-b border-zinc-200/50 flex items-center gap-4 text-zinc-700 shrink-0 bg-transparent backdrop-blur-xl relative z-10">
                  <input type="checkbox" title="Select all" className="w-5 h-5 rounded-md border-black/10 accent-indigo-500 bg-white shadow-sm" />
                  <button onClick={fetchEmails} className="p-2.5 bg-white hover:bg-zinc-50 border border-white rounded-xl transition text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)]" title="Sync"><RefreshCw className={`w-4 h-4 ${loadingEmails ? 'animate-spin' : ''}`} /></button>
                  <button className="p-2.5 bg-white hover:bg-zinc-50 border border-white rounded-xl transition text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)]" title="More options"><MoreVertical className="w-4 h-4" /></button>

                  <div className="h-5 w-px bg-zinc-300/50 mx-2"></div>

                  <button
                    onClick={runAutoPilot}
                    disabled={isAutoPiloting || emails.length === 0}
                    className="flex items-center gap-2 text-[13px] font-bold bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-xl transition-all disabled:opacity-50 shadow-md shadow-zinc-900/20"
                  >
                    {isAutoPiloting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isAutoPiloting ? `Analyzing (${autoPilotProgress.current}/${autoPilotProgress.total})` : "Auto-Analyze Inbox"}
                  </button>

                  <button
                    onClick={handleSendGlobalSummary}
                    disabled={isSendingGlobalSummary || filteredEmails.length === 0}
                    className="flex items-center gap-2 text-[13px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-2.5 rounded-xl transition-all disabled:opacity-50 shadow-sm border border-indigo-100 ml-2"
                  >
                    {isSendingGlobalSummary ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Share Report
                  </button>

                  <div className="flex-1"></div>
                  <span className="text-[13px] font-extrabold text-zinc-500">1-{filteredEmails.length} of {filteredEmails.length}</span>
                  <button className="p-2.5 bg-white hover:bg-zinc-50 border border-white rounded-xl transition text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)]" title="Previous page"><ChevronLeft className="w-4 h-4" /></button>
                  <button className="p-2.5 bg-white hover:bg-zinc-50 border border-white rounded-xl transition text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)]" title="Next page"><ChevronRight className="w-4 h-4" /></button>
                </div>



                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {filteredEmails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                      <Inbox className="w-12 h-12 opacity-30" />
                      <p className="text-[15px] font-bold uppercase tracking-widest">No messages match filter</p>
                    </div>
                  ) : (
                    filteredEmails.map(email => (
                      <div key={email.id} onClick={() => handleSelectEmail(email)} className="flex items-center gap-4 px-6 py-4 bg-white hover:bg-white border border-transparent hover:border-indigo-100 shadow-sm hover:shadow-md cursor-pointer group text-[14px] relative transition-all rounded-2xl">
                        <div className="flex items-center gap-3 text-zinc-400 group-hover:text-zinc-500 shrink-0">
                          <input type="checkbox" className="w-5 h-5 rounded-md border-zinc-300 bg-white accent-indigo-600 shadow-sm" onClick={e => e.stopPropagation()} />
                          <Star className="w-5 h-5 hover:text-amber-400 transition-colors" />
                          {analysisMap[email.id] && (
                            <span title="Analyzed by AI">
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50" />
                            </span>
                          )}
                        </div>
                        <div className="w-56 font-bold text-zinc-900 truncate tracking-tight text-[15px]">
                          {email.name}
                        </div>
                        <div className="flex-1 min-w-0 flex items-center pr-4">
                          <span className="font-extrabold text-zinc-900 mr-3 truncate tracking-tight text-[15px]">{email.subject}</span>
                          {analysisMap[email.id] && (
                            <div className="flex items-center gap-2 shrink-0 ml-auto">
                              {email.isFollowUp && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold capitalize bg-purple-50 text-purple-600 border border-purple-300 shrink-0">
                                  follow-up
                                </span>
                              )}
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${getCategoryColor(analysisMap[email.id])}`}>
                                {analysisMap[email.id]?.category.toLowerCase()}
                              </span>
                              {analysisMap[email.id]?.priority && (
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shrink-0 bg-transparent text-zinc-800 ${analysisMap[email.id]?.priority === 'High' ? 'border border-red-400/80' : analysisMap[email.id]?.priority === 'Medium' ? 'border border-amber-500/80' : 'border border-green-500/80'}`}>
                                  <Flag className={`w-3 h-3 ${analysisMap[email.id]?.priority === 'High' ? 'text-red-500 fill-red-500' : analysisMap[email.id]?.priority === 'Medium' ? 'text-amber-500 fill-amber-500' : 'text-green-500 fill-green-500'}`} />
                                  {analysisMap[email.id]?.priority} priority
                                </span>
                              )}
                              {(() => {
                                const tatInfo = getTATInfo(email.receivedTimestamp);
                                if (!tatInfo) return null;
                                return (
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shrink-0 bg-transparent ${tatInfo.isBreached ? 'text-rose-600 border border-rose-500 bg-rose-50' : 'text-slate-600 border border-slate-300'}`}>
                                    <Clock className="w-3 h-3" />
                                    {tatInfo.isBreached ? 'TAT BREACHED' : `TAT: ${tatInfo.label}`}
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                        <div className="w-24 text-right font-bold text-zinc-500 text-[13px] shrink-0">
                          {formatDisplayTime(email.receivedTimestamp, email.time)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            ) : (

              /* READING PANE VIEW */
              <div className="flex h-full overflow-hidden bg-transparent">
                {/* Left: Email Thread */}
                <div className="flex-1 min-w-0 flex flex-col bg-transparent">
                  {/* Toolbar */}
                  <div className="h-16 px-6 border-b border-white/50 flex items-center gap-2 text-zinc-500 shrink-0 bg-white/30 backdrop-blur-md">
                    <button onClick={() => setSelectedEmail(null)} className="p-2.5 bg-white hover:bg-zinc-50 border border-white rounded-xl transition text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] mr-2"><ArrowLeft className="w-4 h-4" /></button>
                    <button className="px-4 py-2.5 bg-white hover:bg-zinc-50 border border-white rounded-xl transition text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[13px] font-bold flex items-center gap-2"><Archive className="w-4 h-4" /> Archive</button>
                    <button className="px-4 py-2.5 bg-white hover:bg-zinc-50 border border-white rounded-xl transition text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[13px] font-bold flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete</button>
                  </div>

                  {/* Thread Content */}
                  <div className="flex-1 overflow-y-auto px-8 py-8 md:px-12 md:py-12">
                    <div className="max-w-4xl mx-auto flex flex-col gap-6">
                      {/* Subject */}
                      <div className="px-2">
                        <h2 className="text-[28px] font-extrabold text-zinc-900 tracking-tight leading-snug">{selectedEmail.subject}</h2>
                      </div>

                      {/* Email Card */}
                      <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-white overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 bg-zinc-50/50 border-b border-zinc-100/50">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 text-white flex items-center justify-center font-bold text-[15px] shadow-md ring-4 ring-white/50">{selectedEmail.name[0].toUpperCase()}</div>
                            <div>
                              <div className="font-extrabold text-zinc-900 text-[15px] flex items-center gap-2 tracking-tight">
                                {selectedEmail.name}
                                <span className="px-2.5 py-0.5 rounded-md bg-zinc-200/50 text-zinc-600 text-[9px] font-extrabold tracking-widest uppercase">Sender</span>
                              </div>
                              <div className="text-zinc-500 text-[13px] mt-0.5 font-semibold">{selectedEmail.sender}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[14px] font-extrabold text-zinc-700">{formatDisplayTime(selectedEmail.receivedTimestamp, selectedEmail.time)}</div>
                            <div className="text-[12px] text-zinc-400 mt-0.5 font-bold uppercase tracking-widest">
                              to me
                            </div>
                          </div>
                        </div>

                        <div className="p-8 text-[15px] text-zinc-800 leading-[1.9] font-medium">
                          {renderEmailContent(selectedEmail.content)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Short Subtle Divider */}
                <div className="w-px bg-black/15 my-12 shrink-0"></div>

                {/* Right: AI Assistant Panel */}
                <div className="w-[450px] flex flex-col shrink-0 bg-transparent z-20">
                  {isAnalyzing ? (
                    <div className="flex-1 flex items-center justify-center text-zinc-600 flex-col gap-4">
                      <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                      <p className="font-extrabold text-[12px] uppercase tracking-widest text-indigo-600">Synthesizing...</p>
                    </div>
                  ) : currentAnalysis ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                      {/* Analysis Header */}
                      <div className="h-16 px-8 border-b border-zinc-100 flex items-center gap-3 font-extrabold text-zinc-900 bg-white shrink-0 text-[14px] tracking-tight">
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-900 text-white shadow-sm"><Sparkles className="w-4 h-4" /></div>
                        Smart Reply Assistant
                      </div>

                      <div className="flex-1 overflow-y-auto p-8 space-y-6">

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2">
                          {selectedEmail.isFollowUp && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border shrink-0 bg-purple-50 text-purple-600 border-purple-300">
                              follow-up
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border shrink-0 ${currentAnalysis.sentiment === 'Positive' ? 'bg-transparent text-emerald-600 border-emerald-300' : currentAnalysis.sentiment === 'Negative' ? 'bg-transparent text-rose-600 border-rose-300' : 'bg-transparent text-zinc-600 border-zinc-300'}`}>{currentAnalysis.sentiment.toLowerCase()}</span>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize shrink-0 ${getCategoryColor(currentAnalysis)}`}>{currentAnalysis.category.toLowerCase()}</span>
                          {currentAnalysis.priority && (
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shrink-0 bg-transparent text-zinc-800 ${currentAnalysis.priority === 'High' ? 'border border-red-400/80' : currentAnalysis.priority === 'Medium' ? 'border border-amber-500/80' : 'border border-green-500/80'}`}>
                              <Flag className={`w-3 h-3 ${currentAnalysis.priority === 'High' ? 'text-red-500 fill-red-500' : currentAnalysis.priority === 'Medium' ? 'text-amber-500 fill-amber-500' : 'text-green-500 fill-green-500'}`} />
                              {currentAnalysis.priority} priority
                            </span>
                          )}
                          {(() => {
                            const tatInfo = getTATInfo(selectedEmail.receivedTimestamp);
                            if (!tatInfo) return null;
                            return (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shrink-0 bg-transparent ${tatInfo.isBreached ? 'text-rose-600 border border-rose-500 bg-rose-50' : 'text-slate-600 border border-slate-300'}`}>
                                <Clock className="w-3 h-3" />
                                {tatInfo.isBreached ? 'TAT BREACHED' : `TAT: ${tatInfo.label}`}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Insights Card */}
                        <div className="bg-white border border-white rounded-[20px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-5">
                          {currentAnalysis.extractedDetails && currentAnalysis.extractedDetails.length > 0 && (
                            <div className="flex flex-col gap-3">
                              <h4 className="text-[10px] font-extrabold text-indigo-500/80 uppercase tracking-widest flex items-center justify-between">
                                <span>Key Points Summary</span>
                                <button
                                  onClick={handleSendSummary}
                                  disabled={isSendingSummary}
                                  className="flex items-center gap-1 text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md transition disabled:opacity-50"
                                >
                                  {isSendingSummary ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                  Forward to Stakeholder
                                </button>
                              </h4>
                              <ul className="text-[14px] text-zinc-800 space-y-3 font-medium">
                                {currentAnalysis.extractedDetails.map((detail, idx) => (
                                  <li key={idx} className="flex gap-3 items-start leading-snug">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0 shadow-sm"></div>
                                    <span className="flex-1">{renderWithBold(detail)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="h-px bg-white/60 w-full"></div>

                          <div className="flex flex-col gap-2">
                            <h4 className="text-[10px] font-extrabold text-fuchsia-500/80 uppercase tracking-widest">Recommended Action</h4>
                            <div className="text-[14px] font-extrabold text-zinc-900 leading-snug">{currentAnalysis.recommendedAction}</div>
                          </div>
                        </div>

                        {/* Draft Box */}
                        <div className="flex flex-col gap-3 pt-2">
                          <h4 className="text-[10px] font-extrabold text-zinc-900 uppercase tracking-widest flex items-center justify-between px-1">
                            <span>AI Drafted Reply</span>
                            {isRefining && <span className="text-indigo-500 flex items-center gap-1.5 normal-case font-bold"><RefreshCw className="w-3 h-3 animate-spin" /> Refining...</span>}
                          </h4>

                          <div className="bg-white border border-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                            <textarea
                              value={currentDraft}
                              onChange={(e) => setDraftContentMap(prev => ({ ...prev, [selectedEmail.id]: e.target.value }))}
                              className="w-full min-h-[220px] p-6 text-[14px] text-zinc-800 font-medium resize-none outline-none leading-relaxed bg-transparent"
                            />
                            <div className="bg-zinc-50/50 border-t border-zinc-100/50 p-5 flex flex-col gap-4">
                              <div className="flex flex-wrap gap-2">
                                <button disabled={isRefining} onClick={() => handleRefineDraft("shorter and concise")} className="px-4 py-2 text-xs font-bold text-zinc-700 bg-white/80 hover:bg-white border border-white shadow-sm rounded-xl transition-all">Shorter</button>
                                <button disabled={isRefining} onClick={() => handleRefineDraft("more formal")} className="px-4 py-2 text-xs font-bold text-zinc-700 bg-white/80 hover:bg-white border border-white shadow-sm rounded-xl transition-all">Formal</button>
                                <button disabled={isRefining} onClick={() => handleRefineDraft("more empathetic")} className="px-4 py-2 text-xs font-bold text-zinc-700 bg-white/80 hover:bg-white border border-white shadow-sm rounded-xl transition-all">Empathetic</button>
                              </div>
                              <button
                                onClick={handleSendEmail}
                                disabled={isSending || isRefining}
                                className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-xl flex items-center justify-center gap-2 text-[13px] uppercase tracking-widest transition-all shadow-md shadow-zinc-900/20"
                              >
                                {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {isSending ? "Sending..." : "Send Reply"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                      <div className="h-16 px-6 border-b-2 border-zinc-100 flex items-center gap-3 font-bold text-zinc-900 bg-white shrink-0 text-sm">
                        <div className="flex items-center justify-center w-7 h-7 rounded bg-zinc-100 text-zinc-500 shadow-sm"><Sparkles className="w-4 h-4" /></div>
                        Assistant (Manual Mode)
                      </div>

                      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/30">
                        <div className="bg-white border-2 border-zinc-100 rounded-xl p-6 shadow-sm text-center py-8">
                          <p className="text-[14px] font-bold text-zinc-400 mb-5">AI Analysis unavailable or pending.</p>
                          <button onClick={() => analyzeEmail(selectedEmail)} className="mx-auto bg-white border-2 border-zinc-200 hover:border-zinc-900 hover:text-zinc-900 text-zinc-600 font-bold py-2.5 px-6 rounded-lg flex items-center gap-2 text-xs uppercase tracking-widest transition-all">
                            <Sparkles className="w-4 h-4" /> Retry Analysis
                          </button>
                        </div>

                        {/* Manual Draft Box */}
                        <div className="flex flex-col gap-3 pt-2">
                          <h4 className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest px-1">
                            Manual Reply
                          </h4>

                          <div className="bg-white border-2 border-zinc-900 rounded-xl shadow-sm flex flex-col overflow-hidden focus-within:ring-4 focus-within:ring-zinc-900/10 transition-all">
                            <textarea
                              value={currentDraft}
                              onChange={(e) => setDraftContentMap(prev => ({ ...prev, [selectedEmail.id]: e.target.value }))}
                              className="w-full min-h-[250px] p-5 text-[14px] font-medium text-zinc-800 resize-none outline-none leading-relaxed bg-transparent"
                              placeholder="Type your manual reply here..."
                            />
                            <div className="bg-zinc-50 border-t-2 border-zinc-100 p-4">
                              <button
                                onClick={handleSendEmail}
                                disabled={isSending}
                                className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-[13px] uppercase tracking-widest transition-all"
                              >
                                {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {isSending ? "Sending..." : "Send Reply"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </main>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 z-50 animate-in slide-in-from-top-8 ${toast.type === 'success' ? 'bg-emerald-500 text-white' :
          toast.type === 'error' ? 'bg-rose-500 text-white' :
            'bg-stone-800 text-white'
          }`}>
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
          {toast.type === 'info' && <Info className="w-5 h-5" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
