# DocAI — Phase Test Instructions

Run these tests after completing each phase. All 4 fixtures must pass before marking a phase Done.

---

## Test Fixtures

Located in `financial-extractor/tests/fixtures/`:

| File | Type | Description |
|------|------|-------------|
| `xyz-balance-sheet-digital.pdf` | Digital PDF | XYZ Inc. — 2-page balance sheet with nested asset/liability hierarchy |
| `rural-grocery-detailed-balance-sheet.pdf` | Digital PDF | Rural Grocery Store — 2-page detailed balance sheet with % column and deep inventory breakdown |
| `balance-sheet-31dec20.png` | Image (PNG) | Simple balance sheet — single column, clean layout |
| `jones-clothing-balance-sheet.png` | Image (PNG) | Jones Clothing Store — dual-column (2019 + 2018 comparison) |

> The two PDFs test the digital path with different table structures. The two PNGs test the OCR/scanned path.

---

## Phase 2 — Docling Extraction

Run from `financial-extractor/`:

```bash
source .venv/bin/activate
python -c "
from app.pipeline.detector import detect, DocumentKind
from app.pipeline.docling_processor import to_markdown

fixtures = [
    'tests/fixtures/xyz-balance-sheet-digital.pdf',
    'tests/fixtures/rural-grocery-detailed-balance-sheet.pdf',
    'tests/fixtures/balance-sheet-31dec20.png',
    'tests/fixtures/jones-clothing-balance-sheet.png',
]
for path in fixtures:
    kind = detect(path)
    md = to_markdown(path, use_ocr=(kind == DocumentKind.scanned))
    print(f'{path.split(\"/\")[-1]}: {kind} → {len(md)} chars')
    print(md[:300])
    print()
"
```

**Pass criteria:**
- `xyz-balance-sheet-digital.pdf` → `DocumentKind.digital`, Markdown contains table with XYZ Inc. line items and correct values
- `rural-grocery-detailed-balance-sheet.pdf` → `DocumentKind.digital`, Markdown contains all inventory line items (Grocery, Produce, Meat…) and % column, Total Assets 194,389
- `balance-sheet-31dec20.png` → `DocumentKind.scanned`, Markdown contains Total Assets 44,334
- `jones-clothing-balance-sheet.png` → `DocumentKind.scanned`, Markdown contains both 2019 and 2018 columns

---

## Phase 4 — LLM Extraction (add after Phase 4 is implemented)

Upload each fixture via the API and verify the returned JSON:

```bash
# Start services first (see CLAUDE.md)
JOB=$(curl -s -X POST http://localhost:8000/upload \
  -F "file=@tests/fixtures/xyz-balance-sheet-digital.pdf;type=application/pdf" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

# Poll until complete
while true; do
  STATUS=$(curl -s http://localhost:8000/jobs/$JOB | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 5
done

# Fetch result
curl -s http://localhost:8000/results/$JOB | python3 -m json.tool
```

**Pass criteria for each fixture:**
- `xyz-balance-sheet-digital.pdf`: JSON contains `company_name: "XYZ, Inc."`, `reporting_period`, Total Assets `6,858,029`, all line items present
- `rural-grocery-detailed-balance-sheet.pdf`: JSON contains all inventory sub-categories, Total Assets `194,389`, percentage values preserved
- `balance-sheet-31dec20.png`: JSON contains Total Assets `44,334`, Equity section with Share Capital and Retained Earnings
- `jones-clothing-balance-sheet.png`: JSON has two year columns (2019, 2018), Total Assets `108,500` / `108,700`

---

## Full End-to-End (run after Phase 5)

Test all 3 fixtures through the complete API flow (upload → poll → result) and manually verify extracted JSON against the source documents above.
