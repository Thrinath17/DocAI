from unittest.mock import MagicMock, patch

import pytest

from app.pipeline.detector import DocumentKind, detect


def test_jpeg_is_scanned(tmp_path):
    f = tmp_path / "doc.jpg"
    f.write_bytes(b"fake")
    assert detect(str(f)) == DocumentKind.scanned


def test_png_is_scanned(tmp_path):
    f = tmp_path / "doc.png"
    f.write_bytes(b"fake")
    assert detect(str(f)) == DocumentKind.scanned


def test_unknown_suffix_is_scanned(tmp_path):
    f = tmp_path / "doc.tiff"
    f.write_bytes(b"fake")
    assert detect(str(f)) == DocumentKind.scanned


def test_pdf_with_enough_text_is_digital(tmp_path):
    f = tmp_path / "doc.pdf"
    f.write_bytes(b"fake")

    mock_textpage = MagicMock()
    mock_textpage.get_text_range.return_value = "A" * 200

    mock_page = MagicMock()
    mock_page.get_textpage.return_value = mock_textpage

    mock_doc = MagicMock()
    mock_doc.__iter__ = MagicMock(return_value=iter([mock_page]))

    with patch("pypdfium2.PdfDocument", return_value=mock_doc):
        result = detect(str(f))

    assert result == DocumentKind.digital


def test_pdf_with_few_chars_is_scanned(tmp_path):
    f = tmp_path / "doc.pdf"
    f.write_bytes(b"fake")

    mock_textpage = MagicMock()
    mock_textpage.get_text_range.return_value = "AB"

    mock_page = MagicMock()
    mock_page.get_textpage.return_value = mock_textpage

    mock_doc = MagicMock()
    mock_doc.__iter__ = MagicMock(return_value=iter([mock_page]))

    with patch("pypdfium2.PdfDocument", return_value=mock_doc):
        result = detect(str(f))

    assert result == DocumentKind.scanned


def test_pdf_pypdfium2_exception_defaults_to_scanned(tmp_path):
    f = tmp_path / "corrupt.pdf"
    f.write_bytes(b"not a real pdf")

    with patch("pypdfium2.PdfDocument", side_effect=Exception("bad PDF")):
        result = detect(str(f))

    assert result == DocumentKind.scanned
