import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  exportReportAsHtml,
  exportReportAsPdfStub,
  exportReportAsText,
  getObservationExport,
} from "@/lib/observation-intelligence";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/**
 * GET /api/observations/export — caregiver→doctor summary export (HTML, text, or PDF stub).
 */
export async function GET(req: NextRequest) {
  const caregiverId =
    req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const format = req.nextUrl.searchParams.get("format") ?? "html";

  const report = getObservationExport(caregiverId);

  if (format === "text") {
    return new NextResponse(exportReportAsText(report), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="observation-summary-${caregiverId}.txt"`,
      },
    });
  }

  if (format === "json") {
    return NextResponse.json(report);
  }

  if (format === "pdf") {
    // STUB: print-ready HTML until pdfkit (or similar) is added.
    return new NextResponse(exportReportAsPdfStub(report), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="observation-summary-${caregiverId}.pdf.html"`,
        "X-SolenOS-Pdf-Path": "html_print_stub",
        "X-SolenOS-Pdf-Upgrade": "pdfkit",
      },
    });
  }

  return new NextResponse(exportReportAsHtml(report), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="observation-summary-${caregiverId}.html"`,
    },
  });
}
