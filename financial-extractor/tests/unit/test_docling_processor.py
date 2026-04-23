from unittest.mock import MagicMock, patch

import pytest

from app.pipeline.docling_processor import to_markdown, _make_converter


def _make_mock_result(status_name: str, markdown: str):
    mock_doc = MagicMock()
    mock_doc.export_to_markdown.return_value = markdown

    mock_result = MagicMock()
    mock_result.status.name = status_name
    mock_result.document = mock_doc
    return mock_result


def test_to_markdown_digital_returns_text(tmp_path):
    f = tmp_path / "doc.pdf"
    f.write_bytes(b"fake")

    mock_converter = MagicMock()
    mock_converter.convert.return_value = _make_mock_result("SUCCESS", "# Balance Sheet\n\nAssets: 100")

    with patch("app.pipeline.docling_processor._get_converter", return_value=mock_converter):
        result = to_markdown(str(f), use_ocr=False)

    assert "Balance Sheet" in result
    assert "Assets" in result


def test_to_markdown_raises_on_failed_status(tmp_path):
    f = tmp_path / "doc.pdf"
    f.write_bytes(b"fake")

    mock_converter = MagicMock()
    mock_converter.convert.return_value = _make_mock_result("FAILURE", "")

    with patch("app.pipeline.docling_processor._get_converter", return_value=mock_converter):
        with pytest.raises(RuntimeError, match="Docling conversion failed"):
            to_markdown(str(f), use_ocr=False)


def test_to_markdown_raises_on_blank_output(tmp_path):
    f = tmp_path / "doc.pdf"
    f.write_bytes(b"fake")

    mock_converter = MagicMock()
    mock_converter.convert.return_value = _make_mock_result("SUCCESS", "   \n  ")

    with patch("app.pipeline.docling_processor._get_converter", return_value=mock_converter):
        with pytest.raises(RuntimeError, match="no text"):
            to_markdown(str(f), use_ocr=False)


def test_to_markdown_ocr_path(tmp_path):
    f = tmp_path / "scan.png"
    f.write_bytes(b"fake")

    mock_converter = MagicMock()
    mock_converter.convert.return_value = _make_mock_result("SUCCESS", "Total Assets 44,334")

    with patch("app.pipeline.docling_processor._get_converter", return_value=mock_converter):
        result = to_markdown(str(f), use_ocr=True)

    assert "44,334" in result


def test_make_converter_passes_accelerator_options():
    mock_accel_cls = MagicMock(return_value=MagicMock())

    with patch("app.pipeline.docling_processor.AcceleratorOptions", mock_accel_cls), \
         patch("app.pipeline.docling_processor.AcceleratorDevice", MagicMock()), \
         patch("app.pipeline.docling_processor.DocumentConverter"):
        _make_converter(use_ocr=False)

    mock_accel_cls.assert_called_once()
    call_kwargs = mock_accel_cls.call_args.kwargs
    assert call_kwargs.get("num_threads", 0) >= 4
