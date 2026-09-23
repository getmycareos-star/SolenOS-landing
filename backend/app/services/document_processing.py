import os
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum as PyEnum
from PIL import Image

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None


SUPPORTED_MIME_TYPES = {
    "text/plain": ".txt",
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
}

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024


class ExtractionMethod(str, PyEnum):
    DIRECT_TEXT = "direct_text"
    PDF_TEXT = "pdf_text"
    DOCX_PARSE = "docx_parse"
    OCR = "ocr"
    COMBINED = "combined"


class OCRStatus(str, PyEnum):
    NOT_REQUIRED = "not_required"
    SUCCESS = "success"
    FAILED = "failed"
    NOT_AVAILABLE = "not_available"
    PARTIAL = "partial"


class ProcessingStatus(str, PyEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ExtractionResult:
    text: str = ""
    method: ExtractionMethod = ExtractionMethod.DIRECT_TEXT
    confidence: float = 1.0
    ocr_status: OCRStatus = OCRStatus.NOT_REQUIRED
    ocr_confidence: Optional[float] = None
    ocr_engine: Optional[str] = None
    page_count: Optional[int] = None
    pages_processed: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    is_image: bool = False


def _sanitize_filename(filename: str) -> str:
    import re
    return re.sub(r"[^a-zA-Z0-9._-]", "_", filename).strip("_") or "upload"


def _detect_document_type(filename: str, mime_type: str, file_path: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".txt" or mime_type == "text/plain":
        return "text"
    if ext == ".pdf" or mime_type == "application/pdf":
        return "pdf"
    if ext == ".docx":
        return "docx"
    if mime_type and mime_type.startswith("image/"):
        return "image"
    try:
        with open(file_path, "rb") as f:
            header = f.read(8)
        if header[:4] == b"%PDF":
            return "pdf"
        if header[:2] == b"PK":
            return "docx"
        if header[:8] in (b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff"):
            return "image"
    except Exception:
        pass
    return "unknown"


def _extract_text_from_txt(file_path: str) -> ExtractionResult:
    result = ExtractionResult(method=ExtractionMethod.DIRECT_TEXT)
    try:
        text = None
        for enc in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
            try:
                with open(file_path, "r", encoding=enc) as f:
                    text = f.read()
                break
            except (UnicodeDecodeError, UnicodeError):
                continue
        if text is None:
            with open(file_path, "rb") as f:
                text = f.read().decode("utf-8", errors="replace")
        result.text = text
        result.page_count = 1
        result.confidence = 1.0
    except Exception as e:
        result.errors.append(f"TXT extraction failed: {str(e)}")
        result.confidence = 0.0
    return result


def _extract_text_from_pdf(file_path: str) -> ExtractionResult:
    result = ExtractionResult(method=ExtractionMethod.PDF_TEXT)
    if PdfReader is None:
        result.errors.append("pypdf not installed")
        result.confidence = 0.0
        return result
    try:
        reader = PdfReader(file_path)
        result.page_count = len(reader.pages)
        all_text = []
        for i, page in enumerate(reader.pages):
            page_text = ""
            try:
                page_text = page.extract_text() or ""
            except Exception as e:
                result.errors.append(f"page_{i}: {str(e)}")
            if page_text.strip():
                all_text.append(page_text)
        result.text = "\n\n".join(all_text)
        success_pages = len(all_text)
        if result.page_count and result.page_count > 0:
            result.confidence = success_pages / result.page_count
        else:
            result.confidence = 0.0
    except Exception as e:
        result.errors.append(f"PDF extraction failed: {str(e)}")
        result.confidence = 0.0
    return result


def _extract_text_from_docx(file_path: str) -> ExtractionResult:
    import zipfile
    import xml.etree.ElementTree as ET
    result = ExtractionResult(method=ExtractionMethod.DOCX_PARSE)
    try:
        with zipfile.ZipFile(file_path, "r") as z:
            with z.open("word/document.xml") as doc_file:
                tree = ET.parse(doc_file)
                root = tree.getroot()
                ns = "http://schemas.openxmlxmlformats.org/wordprocessingml/2006/main"
                texts = []
                for para in root.iter():
                    if para.tag == f"{{{ns}}}p":
                        para_text = "".join(t.text or "" for t in para.iter() if t.text)
                        if para_text.strip():
                            texts.append(para_text)
                result.text = "\n".join(texts)
                result.page_count = 1
                result.confidence = 1.0 if result.text.strip() else 0.0
    except Exception as e:
        result.errors.append(f"DOCX extraction failed: {str(e)}")
        result.confidence = 0.0
    return result


def _run_ocr_on_image(image_path: str, page_index: Optional[int] = None) -> ExtractionResult:
    result = ExtractionResult(method=ExtractionMethod.OCR)
    result.is_image = True
    try:
        import pytesseract
        img = Image.open(image_path)
        result.page_count = 1
        try:
            ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            text = pytesseract.image_to_string(img)
            result.text = text
            confs = [c for c in ocr_data.get("conf", []) if isinstance(c, (int, float)) and c >= 0]
            if confs:
                result.ocr_confidence = sum(confs) / len(confs) / 100.0
                result.confidence = result.ocr_confidence
            else:
                result.ocr_confidence = None
                result.confidence = 0.5
            result.ocr_status = OCRStatus.SUCCESS
            result.ocr_engine = "tesseract"
            result.pages_processed.append({"page": page_index or 0, "text_length": len(text), "ocr_confidence": result.ocr_confidence})
        except Exception as ocr_err:
            msg = str(ocr_err).lower()
            if "not found" in msg or "tesseract" in msg:
                result.ocr_status = OCRStatus.NOT_AVAILABLE
                result.errors.append("Tesseract binary not found; OCR unavailable")
            else:
                result.ocr_status = OCRStatus.FAILED
                result.errors.append(f"Tesseract OCR failed: {str(ocr_err)}")
            result.confidence = 0.0
            result.text = ""
    except ImportError:
        result.ocr_status = OCRStatus.NOT_AVAILABLE
        result.errors.append("pytesseract not installed; OCR unavailable")
        result.confidence = 0.0
    except Exception as e:
        result.ocr_status = OCRStatus.FAILED
        result.errors.append(f"OCR image processing failed: {str(e)}")
        result.confidence = 0.0
    return result


def _preprocess_image(image_path: str) -> str:
    try:
        img = Image.open(image_path)
        if img.mode != "RGB":
            img = img.convert("RGB")
        gray = img.convert("L")
        from PIL import ImageEnhance
        gray = ImageEnhance.Contrast(gray).enhance(2.0)
        threshold = gray.point(lambda p: 255 if p > 128 else 0, mode="1")
        fd, temp_path = tempfile.mkstemp(suffix=".png")
        os.close(fd)
        threshold.save(temp_path, "PNG")
        return temp_path
    except Exception:
        return image_path


def _extract_text_from_image(file_path: str) -> ExtractionResult:
    import tempfile
    preprocessed = _preprocess_image(file_path)
    try:
        result = _run_ocr_on_image(preprocessed)
    finally:
        if preprocessed != file_path:
            try:
                os.remove(preprocessed)
            except OSError:
                pass
    return result


def _pdf_has_text(file_path: str) -> bool:
    if PdfReader is None:
        return False
    try:
        reader = PdfReader(file_path)
        for page in reader.pages[:3]:
            text = page.extract_text() or ""
            if text.strip():
                return True
        return False
    except Exception:
        return False


def process_document(file_path: str, filename: str, mime_type: str) -> ExtractionResult:
    doc_type = _detect_document_type(filename, mime_type, file_path)
    if doc_type == "text":
        return _extract_text_from_txt(file_path)
    elif doc_type == "pdf":
        result = _extract_text_from_pdf(file_path)
        if not result.text.strip():
            result.ocr_status = OCRStatus.NOT_AVAILABLE
            result.errors.append("No text layer in PDF; OCR requires pdf2image + poppler (not installed)")
        else:
            result.ocr_status = OCRStatus.NOT_REQUIRED
        return result
    elif doc_type == "docx":
        return _extract_text_from_docx(file_path)
    elif doc_type == "image":
        return _extract_text_from_image(file_path)
    else:
        return ExtractionResult(
            text="",
            confidence=0.0,
            errors=[f"Unsupported document type for file: {filename}"],
        )


def save_uploaded_file(file_content: bytes, original_filename: str, mime_type: str, person_id: str, storage_base_dir: str):
    from app.models.document import Document as DocumentModel
    sanitized = _sanitize_filename(original_filename)
    ext = os.path.splitext(sanitized)[1] or SUPPORTED_MIME_TYPES.get(mime_type, "")
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    person_dir = os.path.join(storage_base_dir, person_id)
    os.makedirs(person_dir, exist_ok=True)
    storage_path = os.path.join(person_dir, stored_filename)
    with open(storage_path, "wb") as f:
        f.write(file_content)
    content_hash = hashlib.sha256(file_content).hexdigest()
    doc_type = _detect_document_type(sanitized, mime_type, storage_path)
    doc = DocumentModel(
        person_id=person_id,
        original_filename=sanitized,
        stored_filename=stored_filename,
        storage_path=storage_path,
        mime_type=mime_type,
        file_size_bytes=len(file_content),
        content_hash=content_hash,
        document_type=doc_type,
        processing_status=ProcessingStatus.PENDING.value,
        ocr_status=OCRStatus.NOT_REQUIRED.value if doc_type != "image" else OCRStatus.PENDING.value,
        is_image="true" if doc_type == "image" else "false",
    )
    return doc


def process_and_persist_document(db, doc) -> ExtractionResult:
    doc.processing_status = ProcessingStatus.PROCESSING.value
    doc.processing_started_at = datetime.now(timezone.utc)
    db.commit()
    if not os.path.exists(doc.storage_path):
        doc.processing_status = ProcessingStatus.FAILED.value
        doc.processing_error = "File not found on disk"
        doc.processing_completed_at = datetime.now(timezone.utc)
        db.commit()
        return ExtractionResult(text="", confidence=0.0, errors=["File not found on disk"])
    result = process_document(doc.storage_path, doc.original_filename, doc.mime_type)
    doc.processing_status = ProcessingStatus.COMPLETED.value if not result.errors else ProcessingStatus.FAILED.value
    doc.processing_completed_at = datetime.now(timezone.utc)
    doc.extraction_method = result.method.value
    doc.extracted_text = result.text
    doc.extraction_confidence = result.confidence
    doc.ocr_status = result.ocr_status.value
    doc.ocr_confidence = result.ocr_confidence
    doc.ocr_engine = result.ocr_engine
    doc.page_count = result.page_count
    doc.provenance = [{"extraction_method": result.method.value, "confidence": result.confidence, "errors": result.errors, "pages_processed": result.pages_processed}]
    doc.processing_error = "; ".join(result.errors) if result.errors else None
    db.commit()
    db.refresh(doc)
    return result
