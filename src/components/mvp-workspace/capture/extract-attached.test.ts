jest.mock("../../../api/client", () => ({
  getAnonymousAccessToken: () => "server-issued-test-token",
}));

import { extractAttachedDocument } from "./extract-attached";

describe("extractAttachedDocument API contract", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the server-issued bearer token to the authenticated extractor", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          document: {
            id: "doc-test",
            name: "discharge.pdf",
            mime_type: "application/pdf",
            extracted_text: "Follow-up in two weeks.",
            extracted_text_preview: "Follow-up in two weeks.",
            extracted_char_count: 23,
            ocr_confidence: null,
            extraction_source: "text",
          },
        }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const file = new File(["pdf-bytes"], "discharge.pdf", {
      type: "application/pdf",
    });
    const result = await extractAttachedDocument(file, "upload");

    expect(result.status).toBe("ready");
    expect(result.extractedText).toBe("Follow-up in two weeks.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/extract",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer server-issued-test-token" },
        body: expect.any(FormData),
      }),
    );
  });

  it("surfaces structured API errors instead of reporting a successful extraction", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      text: async () =>
        JSON.stringify({
          detail: "Scanned images require OCR, which is not available yet.",
        }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const file = new File(["image-bytes"], "scan.jpg", { type: "image/jpeg" });
    const result = await extractAttachedDocument(file, "scan");

    expect(result.status).toBe("failed");
    expect(result.errorNote).toContain("OCR");
  });
});
