
'use client'

import { useState, useRef, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, Camera, CheckCircle2, Clock3, FileText, Lightbulb, MessageCircle, Plus, ShieldCheck, Users, Stethoscope, ClipboardList, X } from 'lucide-react'
import { ensureAnonymousSession, postJSON, getPersonId } from '@/api/client'
import { isEmergencyCompanionResponse } from '@/lib/companion-safety'
import CareDeltaPanel from '@/components/CareDeltaPanel'
import { CareHandoffSharing } from '@/components/workflows/CareHandoffSharing'
import AppointmentWorkspace from '@/components/workflows/AppointmentWorkspace'
import { setPendingDocumentIntake, type DocumentIntakeMode } from '@/lib/companion-document-intake'

interface HandoffDraftItem {
  source_type: string
  source_table: string
  source_id: string
  event_at?: string | null
  recorded_at: string | null
  due_at?: string | null
  details?: Record<string, string>
  epistemic_status: string
  record_status?: string
  text: string
  stale_warning?: boolean
  evidence_ids?: string[]
  evidence_sources?: Array<{
    evidence_id: string
    type: string
    evidence_kind?: string | null
    epistemic_status: string
    source_type?: string | null
    original_author?: string | null
    reported_by_label?: string | null
    occurred_at?: string | null
    original_source_reference?: string | null
    parent_evidence_id?: string | null
  }>
  evidence_reference_status?: string
}
interface HandoffDraft {
  draft_id: string
  purpose: string
  audience?: 'family' | 'professional'
  template_sections?: Array<{ key: string; title: string; required_fields: string[]; source_tables: string[]; coverage_status: string; coverage_note: string }>
  prepared_at: string
  window: { days: number; from: string; to: string }
  read_only: boolean
  requires_caregiver_review: boolean
  creates_handoff: boolean
  updates_lcr: boolean
  source_statuses: Record<string, { status: string; reason?: string; labe
…[1 chars truncated — re-run with head/grep/tail for full output]…
x(0,1fr) 245px; gap:18px; align-items:start; min-width:0; }
        .companion-conversation { min-width:0; min-height:330px; border:1px solid var(--cc-line); border-radius:20px; background:#fff; overflow:hidden; }
        .companion-empty { padding:clamp(20px,3vw,32px); } .companion-empty-icon { display:grid; place-items:center; width:44px; height:44px; border-radius:14px; background:#eef5ed; color:#486e4b; border:1px solid #e0eade; }
        .companion-empty-heading { margin-top:20px; } .companion-empty-heading>span { color:#7b8a7d; font-size:10px; font-weight:850; letter-spacing:.14em; }
        .companion-empty-heading h3 { margin:7px 0 0; font-size:clamp(20px,2.3vw,25px); letter-spacing:-.035em; line-height:1.25; color:#25372b; }
        .companion-empty-heading p { max-width:570px; margin:8px 0 0; color:#6a786e; font-size:13px; line-height:1.65; }
        .companion-starters { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:22px; }
        .companion-starter { display:flex; align-items:flex-start; gap:11px; text-align:left; min-width:0; padding:14px; border:1px solid #e2e9e1; border-radius:14px; background:#fff; color:var(--cc-ink); cursor:pointer; font:inherit; transition:background .15s ease,border-color .15s ease,transform .15s ease; }
        .companion-starter:hover { background:#f7faf6; border-color:#b9d1b8; transform:translateY(-1px); }
        .companion-starter-icon { display:grid; place-items:center; flex:0 0 34px; width:34px; height:34px; border-radius:10px; background:#edf5ec; color:#527657; }
        .companion-starter-copy { display:block; min-width:0; flex:1; } .companion-starter-copy strong { display:block; font-size:12px; line-height:1.45; font-weight:800; }
        .companion-starter-copy>span { display:block; margin-top:4px; color:#718075; font-size:11px; line-height:1.55; } .companion-starter-arrow { color:#8a9a8a; font-size:15px; }
        .companion-empty-footnote { display:flex; align-items:center; gap:7px; margin:18px 0 0; color:#718075; font-size:11px; line-height:1.5; } .companion-empty-footnote svg { flex:0 0 auto; color:#6b8b6d; }
        .companion-message-list { padding:24px clamp(16px,3vw,30px); } .companion-thread-label { display:flex; justify-content:space-between; gap:12px; padding-bottom:14px; margin-bottom:22px; border-bottom:1px solid #edf1ed; color:#849087; font-size:10px; font-weight:800; letter-spacing:.1em; }
        .companion-thread-label span:last-child { letter-spacing:0; font-weight:600; } .companion-message { display:flex; gap:10px; align-items:flex-start; margin:0 0 22px; min-width:0; } .companion-message.is-user { justify-content:flex-end; }
        .companion-avatar { display:grid; place-items:center; flex:0 0 32px; width:32px; height:32px; border:1px solid #dce8da; border-radius:11px; background:#eef5ec; color:#4d7051; }
        .companion-message-body { min-width:0; max-width:min(88%,720px); } .companion-message.is-user .companion-message-body { max-width:min(88%,680px); }
        .companion-message-meta { display:flex; align-items:center; gap:9px; margin:0 2px 6px; color:#78857b; font-size:10px; } .companion-message-meta strong { color:#415446; font-size:11px; font-weight:800; } .companion-message-meta time { color:#929b94; }
        .companion-message.is-user .companion-message-meta { justify-content:flex-end; } .companion-bubble { padding:13px 15px; border:1px solid #e1e9e0; border-radius:4px 16px 16px 16px; background:#f8faf7; color:#26392c; overflow-wrap:anywhere; }
        .companion-message.is-user .companion-bubble { border-color:#d3e4d1; border-radius:16px 4px 16px 16px; background:#eaf3e8; }
        .companion-bubble p { margin:0; font-size:14px; line-height:1.75; white-space:pre-wrap; overflow-wrap:anywhere; }
        .companion-provenance { display:flex; align-items:flex-start; gap:6px; max-width:600px; margin:7px 2px 0; color:#7b887e; font-size:10px; line-height:1.55; } .companion-provenance svg { flex:0 0 auto; margin-top:1px; color:#7c9a7c; } .companion-provenance-details { margin:5px 2px 0; max-width:600px; color:var(--text-secondary); font-size:11px; } .companion-provenance-details summary { cursor:pointer; } .companion-provenance-details ul { margin:5px 0 0; padding-left:18px; } .companion-provenance-details li { margin:4px 0; overflow-wrap:anywhere; } .companion-provenance-details code { font-size:10px; }
        .companion-typing { display:flex; align-items:center; gap:5px; width:max-content; padding:15px 17px; border:1px solid #e1e9e0; border-radius:4px 16px 16px 16px; background:#f8faf7; }
        .companion-typing i { display:block; width:6px; height:6px; border-radius:50%; background:#7f9a80; animation:companionPulse 1.1s ease-in-out infinite; } .companion-typing i:nth-child(2) { animation-delay:.15s; } .companion-typing i:nth-child(3) { animation-delay:.3s; }
        @keyframes companionPulse { 0%,60%,100% { opacity:.35; transform:translateY(0); } 30% { opacity:1; transform:translateY(-3px); } }
        .companion-side-note { display:flex; gap:10px; align-items:flex-start; min-width:0; padding:17px 15px; border:1px solid #e2e9e1; border-radius:17px; background:#f8faf7; }
        .companion-side-note-icon { display:grid; place-items:center; flex:0 0 34px; width:34px; height:34px; border-radius:11px; background:#eaf3e8; color:#547657; }
        .companion-side-note strong { display:block; margin:1px 0 7px; font-size:12px; line-height:1.4; color:#334c38; } .companion-side-note p { margin:0; color:#718075; font-size:11px; line-height:1.7; }
        .companion-composer-wrap { position:relative; width:100%; min-width:0; padding-top:2px; }
        .companion-composer { width:100%; padding:10px 12px 10px 16px; border:1.5px solid #cddccc; border-radius:18px; background:#fff; box-shadow:0 5px 22px rgba(35,61,39,.045); transition:border-color .15s ease,box-shadow .15s ease; }
        .companion-composer:focus-within { border-color:#8caf8d; box-shadow:0 0 0 3px rgba(151,188,151,.16); }
        .companion-composer textarea { display:block; width:100%; min-width:0; min-height:54px; max-height:180px; resize:none; padding:7px 3px 10px; border:0; outline:none; background:transparent; color:#24372a; font:inherit; font-size:15px; line-height:1.6; overflow-y:auto; }
        .companion-composer textarea::placeholder { color:#89958b; opacity:1; } .companion-composer textarea:disabled { opacity:.65; }
        .companion-composer-footer { display:flex; justify-content:space-between; align-items:center; gap:12px; padding-top:8px; border-top:1px solid #eef2ed; }
        .companion-input-hint { color:#8a968c; font-size:10px; line-height:1.4; }
        .companion-send { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-width:88px; min-height:42px; padding:9px 14px; border:1px solid #a8c6a6; border-radius:12px; background:#c7dfc4; color:#213a26; font:inherit; font-size:12px; font-weight:850; cursor:pointer; transition:background .15s ease,transform .15s ease; }
        .companion-send:hover:not(:disabled) { background:#b8d6b5; transform:translateY(-1px); } .companion-send:disabled { background:#edf2eb; border-color:#e0e7dd; color:#89958a; cursor:not-allowed; }
        .companion-send-spinner { display:block; width:14px; height:14px; border:2px solid #8ca58b; border-top-color:transparent; border-radius:50%; animation:companionSpin .7s linear infinite; } @keyframes companionSpin { to { transform:rotate(360deg); } }
        .companion-footer-note { margin:9px 4px 0; color:#89958b; text-align:center; font-size:10px; line-height:1.5; }
        .companion-error { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid #e7c9a7; border-radius:12px; background:#fff8ef; color:#704b2c; font-size:12px; line-height:1.55; }
        .companion-error button { flex:0 0 auto; padding:7px 10px; border:1px solid #e4c5a1; border-radius:8px; background:#fff; color:#704b2c; font:inherit; font-weight:800; cursor:pointer; }
        .companion-emergency { padding:14px 16px; border:1px solid #e8b5ae; border-radius:13px; background:#fff3f1; color:#762f28; } .companion-emergency strong { display:block; font-size:13px; } .companion-emergency p { margin:5px 0 0; font-size:12px; line-height:1.6; }
        @media (max-width:760px) { .companion-handoff-options { grid-template-columns:1fr; } .companion-handoff-purpose-options { grid-template-columns:1fr; } .companion-handoff-purpose { min-height:0; } .companion-handoff-primary { width:100%; } }
        @media (max-width:860px) { .companion-purpose { grid-template-columns:minmax(0,1fr); gap:17px; } .companion-workspace { grid-template-columns:minmax(0,1fr); } .companion-side-note { order:2; } .companion-conversation { min-height:280px; } }
        @media (max-width:560px) {
          .companion-shell { gap:14px; } .companion-topbar { align-items:flex-start; gap:10px; padding-bottom:13px; } .companion-mark { flex-basis:40px; width:40px; height:40px; border-radius:13px; }
          .companion-eyebrow { font-size:9px; } .companion-brand h2 { font-size:21px; } .companion-new { width:42px; min-width:42px; padding:0; gap:0; } .companion-new span { display:none; }
          .companion-purpose { padding:19px 17px; border-radius:17px; } .companion-purpose h3 { font-size:24px; } .companion-purpose-copy p { font-size:13px; } .companion-desktop-break { display:none; }
          .companion-boundary { padding:12px; } .companion-workspace { gap:12px; } .companion-conversation { border-radius:16px; min-height:250px; } .companion-empty { padding:20px 15px; }
          .companion-empty-heading { margin-top:15px; } .companion-empty-heading h3 { font-size:21px; } .companion-starters { grid-template-columns:minmax(0,1fr); gap:8px; margin-top:17px; }
          .companion-starter { padding:11px; } .companion-starter-copy strong { font-size:12px; } .companion-starter-copy>span { font-size:11px; } .companion-empty-footnote { align-items:flex-start; font-size:10px; }
          .companion-message-list { padding:18px 12px; } .companion-message { gap:7px; margin-bottom:18px; } .companion-avatar { flex-basis:28px; width:28px; height:28px; border-radius:9px; }
          .companion-message-body,.companion-message.is-user .companion-message-body { max-width:calc(100% - 35px); } .companion-bubble { padding:11px 12px; } .companion-bubble p { font-size:14px; }
          .companion-thread-label { font-size:9px; } .companion-side-note { padding:13px; } .companion-composer { padding:8px 9px 9px 12px; border-radius:15px; }
          .companion-composer textarea { min-height:50px; font-size:16px; } .companion-input-hint { max-width:calc(100% - 98px); font-size:9px; } .companion-send { min-width:82px; min-height:42px; padding:8px 11px; } .companion-footer-note { font-size:9px; }
        }
        @media (prefers-reduced-motion:reduce) { .companion-typing i,.companion-send-spinner { animation:none; } .companion-starter,.companion-send,.companion-new { transition:none; } }

         .companion-shell.is-home { width:100%; max-width:860px; height:100%; min-height:0; gap:0; padding:0 0 10px; }
        .companion-shell.is-home .companion-topbar { flex:0 0 auto; padding:10px 4px 16px; border-bottom:1px solid #edf1ed; }
        .companion-shell.is-home .companion-mark { width:34px; height:34px; flex-basis:34px; border-radius:11px; }
        .companion-shell.is-home .companion-brand h2 { font-size:18px; font-weight:650; letter-spacing:-.02em; }
        .companion-shell.is-home .companion-eyebrow { font-size:9px; letter-spacing:.09em; }
        .companion-shell.is-home .companion-new { min-height:38px; padding:8px 11px; border-radius:999px; background:#f7faf6; }
        .companion-shell.is-home .companion-workspace { display:block; flex:1 1 auto; min-height:0; margin:0; }
        .companion-shell.is-home .companion-conversation { height:100%; min-height:0; border:0; border-radius:0; background:transparent; overflow-y:auto; }
         .companion-shell.is-home .companion-empty { max-width:840px; margin:0 auto; padding:clamp(32px,7vh,72px) 22px 30px; }
        .companion-shell.is-home .companion-empty-icon { width:42px; height:42px; border-radius:50%; }
        .companion-shell.is-home .companion-empty-heading { margin-top:18px; }
        .companion-shell.is-home .companion-empty-heading h3 { max-width:700px; font-size:clamp(26px,3.5vw,34px); font-weight:600; letter-spacing:-.035em; line-height:1.16; }
        .companion-shell.is-home .companion-empty-heading p { max-width:650px; font-size:16px; line-height:1.7; }
        .companion-shell.is-home .companion-starters { grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:24px; }
        .companion-shell.is-home .companion-starter { min-height:104px; padding:16px; border-radius:14px; box-shadow:none; }
        .companion-shell.is-home .companion-starter-copy strong { font-size:14px; line-height:1.4; }
        .companion-shell.is-home .companion-starter-copy>span { font-size:13px; line-height:1.55; }
        .companion-shell.is-home .companion-starter:focus-visible { outline:3px solid #8caf8d; outline-offset:3px; }
         .companion-shell.is-home .companion-message-list { max-width:760px; margin:0 auto; padding:30px 22px 42px; }
        .companion-shell.is-home .companion-message { margin-bottom:25px; }
         .companion-shell.is-home .companion-message.is-assistant .companion-bubble { border:0; border-radius:0; background:transparent; padding:2px 0; }
        .companion-shell.is-home .companion-message.is-user .companion-bubble { border:0; border-radius:18px; background:#f1f2ef; padding:12px 16px; }
        .companion-shell.is-home .companion-composer-wrap { flex:0 0 auto; width:min(100%,860px); margin:0 auto; padding:0 12px; }
        .companion-shell.is-home .companion-composer { border:1px solid #d7dfd6; border-radius:24px; padding:10px 12px 10px 16px; box-shadow:0 3px 18px rgba(30,50,35,.055); }
        .companion-shell.is-home .companion-composer textarea { min-height:52px; max-height:190px; font-size:16px; }
        .companion-shell.is-home .companion-composer-footer { border-top:0; padding-top:3px; }
        .companion-shell.is-home .companion-send { min-width:42px; width:42px; height:42px; min-height:42px; padding:0; border-radius:50%; }
        .companion-shell.is-home .companion-send span:last-child { display:none; }
        .companion-shell.is-home .companion-footer-note { margin:9px 0 0; font-size:11px; line-height:1.55; }
        .companion-shell.is-home .companion-empty { min-height:100%; display:flex; flex-direction:column; justify-content:center; padding-top:clamp(22px,5vh,54px); padding-bottom:clamp(22px,5vh,54px); }
        .companion-shell.is-home .companion-empty-heading h3 { max-width:660px; color:#24352a; }
        .companion-shell.is-home .companion-empty-heading p { max-width:590px; color:#647267; }
        .companion-shell.is-home .companion-starter { min-height:116px; border:1px solid #e0e8de; background:#fff; box-shadow:0 3px 14px rgba(35,55,39,.035); transition:border-color .16s ease,background .16s ease,transform .16s ease; }
        .companion-shell.is-home .companion-starter:hover { border-color:#b9cfb5; background:#fbfdf9; transform:translateY(-1px); }
        .companion-shell.is-home .companion-starter-copy strong { color:#2c4031; font-size:14px; }
        .companion-shell.is-home .companion-starter-copy>span { color:#718074; }
        .companion-shell.is-home .companion-composer { border:1px solid #d5e0d3; border-radius:22px; padding:12px 14px 11px 17px; box-shadow:0 8px 28px rgba(36,57,39,.07); }
        .companion-shell.is-home .companion-composer:focus-within { border-color:#a5c2a1; box-shadow:0 0 0 4px rgba(166,194,161,.16),0 8px 28px rgba(36,57,39,.06); }
        .companion-shell.is-home .companion-composer textarea { min-height:58px; font-size:16px; line-height:1.65; }
        .companion-shell.is-home .companion-send { background:#c7dfc4; border-color:#a9c7a6; color:#203927; }
        .companion-shell.is-home .companion-input-hint { font-size:11px; color:#7c897d; }
        .companion-add-wrap { position:relative; }
        .companion-add-button { display:grid; place-items:center; width:38px; height:38px; border:1px solid #dce5da; border-radius:50%; background:#f7faf6; color:#314d36; cursor:pointer; }
        .companion-add-button:hover { background:#edf5eb; }
        .companion-add-menu { position:absolute; z-index:40; left:0; bottom:calc(100% + 10px); width:min(320px,calc(100vw - 48px)); padding:7px; border:1px solid #e0e7df; border-radius:16px; background:#fff; box-shadow:0 14px 40px rgba(25,45,30,.14); }
        .companion-add-menu button { display:flex; align-items:center; gap:11px; width:100%; padding:11px 10px; border:0; border-radius:10px; background:transparent; text-align:left; color:#25372b; cursor:pointer; }
        .companion-add-menu button:hover { background:#f4f8f3; }
        .companion-add-icon { display:grid; place-items:center; flex:0 0 34px; width:34px; height:34px; border-radius:10px; background:#edf5ec; color:#547657; }
        .companion-add-menu strong { display:block; font-size:13px; font-weight:700; }
        .companion-add-menu small { display:block; margin-top:3px; color:#748077; font-size:11px; line-height:1.4; }
        @media(max-width:600px) {
          .companion-shell.is-home .companion-topbar { padding:6px 2px 12px; }
          .companion-shell.is-home .companion-empty { padding:26px 10px 18px; }
          .companion-shell.is-home .companion-starters { grid-template-columns:1fr; gap:9px; margin-top:18px; }
          .companion-shell.is-home .companion-starter { min-height:76px; padding:13px 14px; }
          .companion-shell.is-home .companion-empty-heading h3 { font-size:26px; }
          .companion-shell.is-home .companion-empty-heading p { font-size:15px; }
          .companion-shell.is-home .companion-composer-wrap { padding:0 2px; }
        }
      `}</style>
    </section>
  )
}
