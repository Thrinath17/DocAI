import pytest

from app.pipeline.ollama_extractor import _parse_json


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
