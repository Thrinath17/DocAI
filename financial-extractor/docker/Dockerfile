FROM python:3.11-slim

WORKDIR /app

# Install system deps needed by Docling (poppler for PDF rendering, libgomp for TableFormer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY app/ app/
COPY prompts/ prompts/

ENV PYTHONUNBUFFERED=1
