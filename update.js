const fs = require("fs");
const code = `"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Home, DollarSign, Calendar, Mail, FileText, StickyNote, 
  BookOpen, Calculator, Users, Award, ArrowRight, Sparkles 
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Home");

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-8 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-sm tracking-wide">CB</div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-slate-900 text-base">CorporateBuddy</h1>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium border border-slate-200">India Workplace Suite</span>
          </div>
        </div>
        <button className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-4 py-2 rounded-xl transition-all cursor-pointer">
          How its work
        </button>
      </header>

      <div className="flex flex-1 max-w-7xl w-full mx-auto px-6 py-8 gap-8">
        <aside className="w-64 shrink-0 hidden md:block">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs sticky top-24">
            <div className="flex items-center justify-between px-3 mb-3">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Workspace Hub</span>
              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md">Quick Launch</span>
            </div>
            
            <nav className="space-y-1">
              {[
                { name: "Home", icon: Home, active: true },
                { name: "Salary", icon: DollarSign },
                { name: "Holidays", icon: Calendar },
                { name: "Email", icon: Mail },
                { name: "MOM", icon: FileText },
                { name: "Notes", icon: StickyNote },
                { name: "Docs", icon: BookOpen },
                { name: "Tax", icon: Calculator },
                { name: "Shift & Attendance Tracker", icon: Users },
                { name: "PresentOS", icon: Award },
                { name: "Appraisal & Promotion Assistant", icon: Sparkles }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = item.name === activeTab;
                return (
                  <button
                    key={item.name}
                    onClick={() => setActiveTab(item.name)}
                    className={\`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer \${
                      isActive 
                        ? "bg-slate-900 text-white shadow-xs" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }\`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={\`w-4 h-4 \${isActive ? "text-white" : "text-slate-500"}\`} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className={isActive ? "text-slate-300" : "text-slate-300"}>—</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 flex flex-col gap-8 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div>
                <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-3">
                  Your Corporate Life.<br />
                  <span className="text-indigo-400">Simplified.</span>
                </h2>
                <p className="text-slate-300 text-xs lg:text-sm leading-relaxed mb-6 max-w-lg">
                  Seven focused tools for salary, leaves, emails, MOMs, notes, documents, and Indian tax deadlines.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 max-w-md">
                <input 
                  type="text" 
                  readOnly 
                  value="Try 14 LPA Karnataka, leave hacks" 
                  className="bg-transparent text-xs text-slate-200 px-3 py-2 w-full outline-none cursor-default"
                />
                <button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer">
                  Start Brief
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase bg-indigo-50 px-2.5 py-1 rounded-md">Quick Snapshot · Karnataka</span>
                </div>
                <div className="text-xl font-black text-slate-900 mb-2">
                  ?14,00,000 CTC <span className="text-indigo-600">?</span> ?1,04,709<span className="text-xs font-normal text-slate-500">/mo</span>
                  <div className="text-xs font-bold text-slate-700 mt-1">est. in-hand</div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Karnataka (2026): 28 holidays tracked · Top hack: Use 1 leave day on 2026-01-16 (Fri) after Makara Sankranti (Thu) for 4 days off.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button className="bg-slate-900 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer">All Tools</button>
            <button className="bg-white hover:bg-slate-50 text-slate-600 font-medium text-xs px-4 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer">Pay & Tax</button>
            <button className="bg-white hover:bg-slate-50 text-slate-600 font-medium text-xs px-4 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer">Documents & AI</button>
            <button className="bg-white hover:bg-slate-50 text-slate-600 font-medium text-xs px-4 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer">Daily Ops</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 transition-all shadow-xs flex flex-col justify-between group cursor-pointer">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">01</span>
                  <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">All Indian States & UTs</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-indigo-600 transition-colors">Salary & CTC Calculator</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-4">Input: Annual CTC + State</p>
              </div>
              <div className="text-[11px] font-medium text-slate-400">Monthly in-hand, PF...</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 transition-all shadow-xs flex flex-col justify-between group cursor-pointer">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">02</span>
                  <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">Month-by-Month Hacks</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-indigo-600 transition-colors">Holiday Calendar & Leave Planner</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-4">Input: State + Leave Balance</p>
              </div>
              <div className="text-[11px] font-medium text-slate-400">Optimized long weekends...</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 transition-all shadow-xs flex flex-col justify-between group cursor-pointer">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">03</span>
                  <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">Minimal Prompt</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-indigo-600 transition-colors">Smart Email Assistant</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-4">Input: 1 rough line or pasted thread</p>
              </div>
              <div className="text-[11px] font-medium text-slate-400">Send-ready subject...</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 transition-all shadow-xs flex flex-col justify-between group cursor-pointer">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">04</span>
                  <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">10 Office Templates</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-indigo-600 transition-colors">Meeting Minutes (MOM) Generator</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-4">Input: Rough live meeting bullets</p>
              </div>
              <div className="text-[11px] font-medium text-slate-400">Structured MOM with...</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
`;
fs.writeFileSync("app/page.tsx", code, "utf8");
console.log("Successfully restored app/page.tsx!");

