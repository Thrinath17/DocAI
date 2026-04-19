"""
Detect whether a PDF has a native text layer (digital) or is image-only (scanned).
Images (JPEG/PNG) always route to the OCR path.
"""

import logging
from enum import Enum
from pathlib import Path

logger = logging.getLogger(__name__)

# Minimum characters across the whole document to call it "digital"
_MIN_TEXT_CHARS = 100


class DocumentKind(str, Enum):
    digital = "digital"   # has text layer — fast path
    scanned = "scanned"   # image-only — OCR path


def detect(file_path: str) -> DocumentKind:
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix in (".jpg", ".jpeg", ".png"):
        logger.info("detect(%s): image file → scanned", path.name)
        return DocumentKind.scanned

    if suffix != ".pdf":
        logger.warning("detect(%s): unknown suffix, defaulting to scanned", path.name)
        return DocumentKind.scanned

    try:
        import pypdfium2 as pdfium  # bundled with docling
        doc = pdfium.PdfDocument(str(path))
        total_chars = 0
        for page in doc:
            textpage = page.get_textpage()
            total_chars += len(textpage.get_text_range())
        doc.close()
    except Exception as exc:
        logger.warning("detect(%s): text extraction failed (%s), defaulting to scanned", path.name, exc)
        return DocumentKind.scanned

    kind = DocumentKind.digital if total_chars >= _MIN_TEXT_CHARS else DocumentKind.scanned
    logger.info("detect(%s): %d chars → %s", path.name, total_chars, kind)
    return kind
