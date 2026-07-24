import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";



import { recordCareEventWithContext, type InputProvenance } from "@/lib/care-events";

import { ingestCareEntry } from "@/lib/cognitive-relief";

import { ingestCaregiverSelfEntry } from "@/lib/capacity-self";
import { attachmentsFromDocumentRefs } from "@/lib/care-journey";
import { recordJourneyEventFromCareCapture } from "@/lib/care-journey/server";
import { toCareJourneyGraphLayerPayload } from "@/lib/care-journey-graph";
import { processCareJourneyInputAsync } from "@/lib/care-journey-graph/server";
import { toUniversalKnowledgeLayerPayload } from "@/lib/universal-knowledge-extraction";
import { processUniversalKnowledgeExtraction } from "@/lib/universal-knowledge-extraction/server";
import {
  runPatternIntelligence,
  toPatternIntelligenceLayerPayload,
} from "@/lib/pattern-intelligence";
import {
  syncFromJourneyResult,
  toContinuityGraphLayerPayload,
} from "@/lib/continuity-graph";
import { trySaveContinuityGraph } from "@/lib/continuity-graph/server";



const DEFAULT_CAREGIVER_ID = "default_caregiver";



function parseProvenance(body: Record<string, unknown>): InputProvenance {

  const inputType = body.input_type;

  if (inputType === "voice") {

    const confidence = body.recognition_confidence;

    return {

      input_type: "voice",

      captured_at:

        typeof body.captured_at === "string" ? body.captured_at : new Date().toISOString(),

      recognition_confidence:

        typeof confidence === "number" && Number.isFinite(confidence) ? confidence : null,

      transcript_uncertain: body.transcript_uncertain === true,

    };

  }

  if (inputType === "document") {

    return {

      input_type: "document",

      captured_at:

        typeof body.captured_at === "string" ? body.captured_at : new Date().toISOString(),

    };

  }

  return { input_type: "text" };

}



/**

 * POST /api/care-events — capture caregiver input as a structured CareEvent.

 */

export async function POST(req: NextRequest) {

  let body: unknown;

  try {

    body = await req.json();

  } catch {

    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  }



  if (!body || typeof body !== "object") {

    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });

  }



  const record = body as Record<string, unknown>;

  const content = record.content;



  if (typeof content !== "string" || !content.trim()) {

    return NextResponse.json({ error: "content must be a non-empty string" }, { status: 400 });

  }



  if (record.care_record_id !== undefined && typeof record.care_record_id !== "string") {

    return NextResponse.json({ error: "care_record_id must be a string" }, { status: 400 });

  }



  const provenance = parseProvenance(record);

  if (

    record.input_type !== undefined &&

    record.input_type !== "text" &&

    record.input_type !== "voice" &&

    record.input_type !== "document"

  ) {

    return NextResponse.json(

      { error: "input_type must be text, voice, or document" },

      { status: 400 },

    );

  }



  const createdBy =

    typeof record.created_by === "string" ? record.created_by : DEFAULT_CAREGIVER_ID;



  const documentRefs = Array.isArray(record.document_refs) ? record.document_refs : undefined;



  const result = await recordCareEventWithContext({

    content: content.trim(),

    care_record_id: typeof record.care_record_id === "string" ? record.care_record_id : null,

    created_by: createdBy,

    provenance,

    metadata: {

      ...(record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)

        ? (record.metadata as Record<string, unknown>)

        : {}),

      ...(documentRefs ? { document_refs: documentRefs } : {}),

    },

  });



  const relief = await ingestCareEntry({

    content: content.trim(),

    raw_entry_id: result.care_event.id,

    caregiver_id: createdBy,

    case_id: typeof record.care_record_id === "string" ? record.care_record_id : null,

    captured_at: provenance.captured_at,

  });



  const selfIngest = ingestCaregiverSelfEntry({

    content: content.trim(),

    raw_entry_id: result.care_event.id,

    caregiver_id: createdBy,

    captured_at: provenance.captured_at,

  });

  const journeyEvent = await recordJourneyEventFromCareCapture({

    description: content.trim(),

    caregiver_id: createdBy,

    case_id: typeof record.care_record_id === "string" ? record.care_record_id : null,

    source: provenance.input_type === "voice" ? "voice" : provenance.input_type === "document" ? "document" : "text",

    event_date: provenance.captured_at,

    attachments: documentRefs ? attachmentsFromDocumentRefs(documentRefs as { id: string; name: string; mime_type?: string }[]) : undefined,

    care_event_id: result.care_event.id,

  });

  const graphResult = await processCareJourneyInputAsync({

    description: content.trim(),

    caregiver_id: createdBy,

    case_id: typeof record.care_record_id === "string" ? record.care_record_id : null,

    source: provenance.input_type === "voice" ? "voice" : provenance.input_type === "document" ? "document" : "text",

    timestamp: provenance.captured_at,

    attachments: documentRefs ? attachmentsFromDocumentRefs(documentRefs as { id: string; name: string; mime_type?: string }[]) : undefined,

    metadata: { care_event_id: result.care_event.id },

  });

  const careJourneyGraph = toCareJourneyGraphLayerPayload(graphResult);

  const continuityResult = syncFromJourneyResult(graphResult);
  const continuityGraph = toContinuityGraphLayerPayload(continuityResult);
  void trySaveContinuityGraph(continuityResult.graph);

  const knowledgeExtractions: ReturnType<typeof toUniversalKnowledgeLayerPayload>[] = [];
  if (documentRefs && Array.isArray(documentRefs)) {
    for (const ref of documentRefs as {
      id: string;
      name: string;
      mime_type?: string;
      extracted_text?: string;
      extracted_preview?: string;
    }[]) {
      const text = ref.extracted_text?.trim() || ref.extracted_preview?.trim();
      if (!text) continue;
      try {
        const knowledgeResult = processUniversalKnowledgeExtraction({
          document_id: ref.id,
          document_name: ref.name,
          extracted_text: text,
          caregiver_id: createdBy,
          case_id: typeof record.care_record_id === "string" ? record.care_record_id : null,
          mime_type: ref.mime_type,
        });
        knowledgeExtractions.push(toUniversalKnowledgeLayerPayload(knowledgeResult));
      } catch {
        // Non-blocking — care event still recorded
      }
    }
  }

  const patternIntelligence = runPatternIntelligence(
    createdBy,
    typeof record.care_record_id === "string" ? record.care_record_id : null,
  );

  return NextResponse.json({

    care_event_id: result.care_event.id,

    care_event: result.care_event,

    care_journey_event_id: journeyEvent.event_id,

    care_journey_category: journeyEvent.category,

    care_journey_graph: careJourneyGraph,

    continuity_graph: continuityGraph,

    document_knowledge: knowledgeExtractions.length > 0 ? knowledgeExtractions : null,

    pattern_intelligence: toPatternIntelligenceLayerPayload(patternIntelligence),

    structured: result.care_event.metadata.structured ?? null,

    historical_context: result.historical_context ?? null,

    pattern_context: relief.pattern_context,

    care_profile_updated: true,

    caregiver_self_updated: selfIngest.profile_updated,

    caregiver_items_added: selfIngest.caregiver_items_added,

  });

}



/** GET /api/care-events?caregiver_id= — list events for continuous care record */

export async function GET(req: NextRequest) {

  const { listCareEventsForCaregiver, tryLoadCareEventsForCaregiver } = await import(

    "@/lib/care-events"

  );

  const { buildTimeline } = await import("@/lib/care-record");



  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;

  const events =

    (await tryLoadCareEventsForCaregiver(caregiverId)) ??

    listCareEventsForCaregiver(caregiverId);



  return NextResponse.json({

    timeline: buildTimeline(events),

    total: events.length,

  });

}


