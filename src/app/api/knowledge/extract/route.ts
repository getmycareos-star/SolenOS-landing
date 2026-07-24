import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getDocumentKnowledge,
  listDocumentKnowledgeForCaregiver,
  toUniversalKnowledgeLayerPayload,
} from "@/lib/universal-knowledge-extraction";
import { processUniversalKnowledgeExtraction } from "@/lib/universal-knowledge-extraction/server";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** POST /api/knowledge/extract — transform document text into structured knowledge */
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

  const input = body as Record<string, unknown>;
  const extractedText = input.extracted_text;
  const documentName = input.document_name;

  if (typeof extractedText !== "string" || !extractedText.trim()) {
    return NextResponse.json({ error: "extracted_text required" }, { status: 400 });
  }
  if (typeof documentName !== "string" || !documentName.trim()) {
    return NextResponse.json({ error: "document_name required" }, { status: 400 });
  }

  const documentId =
    typeof input.document_id === "string" && input.document_id.trim()
      ? input.document_id
      : `doc_${Date.now()}`;

  try {
    const result = processUniversalKnowledgeExtraction({
      document_id: documentId,
      document_name: documentName.trim(),
      extracted_text: extractedText.trim(),
      caregiver_id:
        typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID,
      case_id: typeof input.case_id === "string" ? input.case_id : null,
      mime_type: typeof input.mime_type === "string" ? input.mime_type : undefined,
    });

    return NextResponse.json({
      knowledge: result,
      layer: toUniversalKnowledgeLayerPayload(result),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "knowledge_extraction_failed",
        message: error instanceof Error ? error.message : "Extraction failed",
      },
      { status: 422 },
    );
  }
}

/** GET /api/knowledge/extract?caregiver_id=&document_id= */
export async function GET(req: NextRequest) {
  const documentId = req.nextUrl.searchParams.get("document_id");
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;

  if (documentId) {
    const knowledge = getDocumentKnowledge(documentId);
    if (!knowledge) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ knowledge, layer: toUniversalKnowledgeLayerPayload(knowledge) });
  }

  const all = listDocumentKnowledgeForCaregiver(caregiverId);
  return NextResponse.json({
    documents: all.map(toUniversalKnowledgeLayerPayload),
    total: all.length,
  });
}
