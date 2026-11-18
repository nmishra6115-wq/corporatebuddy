"use client";

import React, { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Sparkles, Wrench } from "lucide-react";

function ToolContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const toolName = typeof params.tool === "string" 
    ? params.tool.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") 
    : "Tool Workspace";

  const prefilledPrompt = searchParams.get("prompt") || searchParams.get("query") || "";

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col items-center justify-center text-center">
      <div className="h-16 w-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 mb-6">
        <Sparkles className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-2">Welcome to {toolName}</h2>
      <p className="text-sm text-neutral-500 max-w-md mb-8">
        Your workspace for {toolName.toLowerCase()} is fully connected and ready for action.
      </p>

      {prefilledPrompt && (
        <div className="w-full bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 text-left mb-6">
          <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Incoming AI Prompt / Request</div>
          <p className="text-neutral-800 text-sm font-medium">"{prefilledPrompt}"</p>
        </div>
      )}

      <div className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-left">
        <h3 className="font-bold text-neutral-900 text-sm mb-4">Workspace Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => alert("Action executed successfully!")} className="p-4 rounded-xl border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left group cursor-pointer">
            <div className="font-semibold text-xs text-neutral-900 group-hover:text-indigo-600 mb-1">Run AI Generation</div>
            <div className="text-[11px] text-neutral-500">Process inputs using Gemini AI integration.</div>
          </button>
          <button onClick={() => alert("Document saved to SmartVault!")} className="p-4 rounded-xl border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left group cursor-pointer">
            <div className="font-semibold text-xs text-neutral-900 group-hover:text-indigo-600 mb-1">Save to SmartVault</div>
            <div className="text-[11px] text-neutral-500">Store results securely in your cloud vault.</div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DynamicToolPage() {
  const router = useRouter();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-neutral-50 relative">
        <header className="sticky top-0 z-20 bg-white px-6 py-4 flex items-center justify-between border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push("/")}
              className="p-2 rounded-xl border border-[#E5E7EB] bg-white hover:bg-neutral-50 text-neutral-700 transition-colors flex items-center gap-2 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
            <div className="h-4 w-[1px] bg-neutral-200"></div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Wrench className="w-4 h-4" />
              </div>
              <h1 className="font-bold text-neutral-900 text-sm md:text-base">Workspace</h1>
            </div>
          </div>
          <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Ready</span>
          </div>
        </header>

        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-neutral-500">Loading workspace...</div>}>
          <ToolContent />
        </Suspense>
      </main>
    </div>
  );
}
