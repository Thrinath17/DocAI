import pytest
from unittest.mock import patch, MagicMock

from app.pipeline.ollama_extractor import _parse_json, _truncate_markdown, extract


def test_parse_clean_json():
    result = _parse_json('{"company": "Acme", "total_assets": 100}')
    assert result == {"company": "Acme", "total_assets": 100}


def test_parse_json_strips_think_tags():
    text = "<think>Some reasoning here.</think>\n{\"company\": \"Acme\"}"
    result = _parse_json(text)
    assert result == {"company": "Acme"}


def test_parse_json_strips_code_fence():
    text = "```json\n{\"total\": 42}\n```"
    result = _parse_json(text)
    assert result == {"total": 42}


def test_parse_json_strips_plain_code_fence():
    text = "```\n{\"total\": 42}\n```"
    result = _parse_json(text)
    assert result == {"total": 42}


def test_parse_json_fallback_extracts_embedded_object():
    text = "Here is the result: {\"x\": 1} — done."
    result = _parse_json(text)
    assert result == {"x": 1}


def test_parse_json_raises_on_invalid():
    with pytest.raises(ValueError, match="Could not parse JSON"):
        _parse_json("this is not json at all")


def test_parse_json_combined_think_and_fence():
    text = "<think>thinking...</think>\n```json\n{\"assets\": 500}\n```"
    result = _parse_json(text)
    assert result == {"assets": 500}


def test_truncate_markdown_short_text_unchanged():
    md = "Short financial summary"
    assert _truncate_markdown(md, max_chars=100) == md


def test_truncate_markdown_long_text_is_cut():
    md = "x" * 200
    result = _truncate_markdown(md, max_chars=100)
    assert len(result) < 200
    assert "[TRUNCATED" in result


def test_extract_passes_num_ctx_and_num_predict():
    mock_response = MagicMock()
    mock_response.response = '{"company": "ACME", "revenue": 100}'

    with patch("app.pipeline.ollama_extractor.Client") as MockClient:
        mock_client = MockClient.return_value
        mock_client.generate.return_value = mock_response

        extract("## Balance Sheet\n\n| Assets | 100 |")

        call_kwargs = mock_client.generate.call_args.kwargs
        assert "num_ctx" in call_kwargs["options"]
        assert "num_predict" in call_kwargs["options"]
        assert call_kwargs["options"]["num_ctx"] == 8192
        assert call_kwargs["options"]["num_predict"] == 2048
