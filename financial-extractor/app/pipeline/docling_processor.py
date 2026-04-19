"""
Convert a document file to clean Markdown using Docling.

Digital PDFs:  do_ocr=False  — fast text extraction + TableFormer
Scanned PDFs / images:  do_ocr=True  — EasyOCR + TableFormer
"""

import logging
from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

logger = logging.getLogger(__name__)


def _make_converter(use_ocr: bool) -> DocumentConverter:
    opts = PdfPipelineOptions()
    opts.do_ocr = use_ocr
    opts.do_table_structure = True  # TableFormer — critical for balance sheets
    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
    )


# Module-level converters — initialised once per worker process to avoid
# reloading the TableFormer weights on every job.
_converter_digital: DocumentConverter | None = None
_converter_ocr: DocumentConverter | None = None


def _get_converter(use_ocr: bool) -> DocumentConverter:
    global _converter_digital, _converter_ocr
    if use_ocr:
        if _converter_ocr is None:
            logger.info("Initialising Docling converter (OCR=True)")
            _converter_ocr = _make_converter(use_ocr=True)
        return _converter_ocr
    else:
        if _converter_digital is None:
            logger.info("Initialising Docling converter (OCR=False)")
            _converter_digital = _make_converter(use_ocr=False)
        return _converter_digital


def to_markdown(file_path: str, use_ocr: bool) -> str:
    """
    Convert *file_path* to Markdown.  Returns the Markdown string.
    Raises RuntimeError if Docling reports a failure.
    """
    path = Path(file_path)
    logger.info("docling: converting %s (ocr=%s)", path.name, use_ocr)

    converter = _get_converter(use_ocr)
    result = converter.convert(str(path))

    if result.status.name not in ("SUCCESS", "PARTIAL_SUCCESS"):
        raise RuntimeError(
            f"Docling conversion failed for {path.name}: status={result.status.name}"
        )

    markdown = result.document.export_to_markdown()
    logger.info(
        "docling: %s → %d chars of Markdown (status=%s)",
        path.name,
        len(markdown),
        result.status.name,
    )

    if not markdown.strip():
        raise RuntimeError(
            f"Docling produced no text for {path.name}. The file may be blank or corrupt."
        )

    return markdown
