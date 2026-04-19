import json
import logging
import re
from pathlib import Path

from ollama import Client

from app.config import settings

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "financial_extraction.txt"
_prompt_template: str | None = None


def _get_prompt_template() -> str:
    global _prompt_template
    if _prompt_template is None:
        _prompt_template = _PROMPT_PATH.read_text(encoding="utf-8")
    return _prompt_template


def _parse_json(text: str) -> dict:
    # qwen3 models emit <think>...</think> before the answer — strip it
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    # Strip markdown code fences if the model wrapped the JSON anyway
    text = re.sub(r"^```(?:json)?\s*", "", text).rstrip("` \n")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: extract outermost JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(
        f"Could not parse JSON from LLM response. Preview: {text[:300]!r}"
    )


def extract(markdown: str) -> dict:
    prompt = _get_prompt_template().replace("{markdown_content}", markdown)

    client = Client(host=settings.ollama_base_url, timeout=300)
    logger.info(
        "ollama: calling model=%s prompt_len=%d", settings.ollama_model, len(prompt)
    )

    response = client.generate(
        model=settings.ollama_model,
        prompt=prompt,
        stream=False,
        think=False,
        options={"temperature": 0},
    )

    raw = response.response
    logger.info("ollama: response_len=%d chars", len(raw))

    result = _parse_json(raw)
    logger.info("ollama: extracted %d top-level keys", len(result))
    return result
