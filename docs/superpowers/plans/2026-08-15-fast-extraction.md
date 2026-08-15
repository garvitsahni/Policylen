# Fast Extraction via Gemini-Primary Chain — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make upload → analysis complete in under a minute by making Gemini 2.0 Flash the primary extraction provider, failing fast on Gemini auth errors, and reusing HTTP connections across the provider chain.

**Architecture:** The AI service (`ai-service/app/main.py`) currently tries OpenRouter's 120B `nemotron-3-super-120b` first for clause extraction (~60-120s), with Gemini 2.0 Flash second. We reorder the extraction chain to Gemini-first (fast, native JSON schema), keep OpenRouter as the fallback, short-circuit the Gemini retry loop on auth failures, and share a `requests.Session` across provider calls. Extraction output shape is unchanged, so the flag engine and backend are untouched.

**Tech Stack:** Python 3.13, FastAPI, `requests`, Google GenAI SDK, stdlib `unittest` (no new dependencies).

## Global Constraints

- Never change extraction output shape: `EXTRACTION_SCHEMA`, `_normalize_extraction`, `_build_clauses` in `ai-service/app/main.py` are untouched by this plan.
- Chat chain in `call_llm` stays as-is (OpenRouter → Groq → NVIDIA → Gemini). Only the `extraction=True` chain changes.
- All provider errors must still surface as `raw_error`; no silent defaults (AGENTS.md §2).
- No new dependencies. Tests use stdlib `unittest`. Run them **from the `ai-service/` directory** (the `app` package is a namespace package with no `__init__.py`, and `ai-service` is not a valid import path due to the hyphen): `& ".\venv\Scripts\python.exe" -m unittest app.test_fast_extraction -v`.
- `.env` is gitignored; do not commit it.

---

### Task 1: Reorder extraction chain to Gemini-first

**Files:**
- Modify: `ai-service/app/main.py:333-339` (the `if extraction:` chain inside `call_llm`)
- Test: Create `ai-service/app/test_fast_extraction.py`

**Interfaces:**
- Consumes: `call_llm(system_prompt, user_prompt, *, extraction, chat, max_tokens, temperature, response_json, response_schema, fallback_prompt)` — existing signature, unchanged.
- Produces: Extraction chain order `[gemini, openrouter, nvidia, groq]`. Later tasks rely on the module-level callables `main.call_gemini`, `main.call_openrouter`, `main.call_nvidia`, `main.call_groq` being patchable via `unittest.mock`.

- [ ] **Step 1: Write the failing tests**

Create `ai-service/app/test_fast_extraction.py`:

```python
import unittest
from unittest import mock

from . import main

def _ok(answer='{"insurer_name": "X"}'):
    return {"answer": answer, "grounded": False, "cited_clause_id": None, "raw_error": None}

def _err(message):
    return {"answer": None, "grounded": False, "cited_clause_id": None, "raw_error": message}


class ExtractionChainTests(unittest.TestCase):

    def test_gemini_is_primary_and_used_when_successful(self):
        with mock.patch.object(main, 'call_gemini', return_value=_ok()) as g, \
             mock.patch.object(main, 'call_openrouter', side_effect=AssertionError('openrouter should not be called')) as o, \
             mock.patch.object(main, 'call_nvidia', side_effect=AssertionError('nvidia should not be called')) as n, \
             mock.patch.object(main, 'call_groq', side_effect=AssertionError('groq should not be called')) as gr:
            result = main.call_llm('sys', 'user', extraction=True,
                                   max_tokens=8192, temperature=0.1,
                                   response_schema=main.EXTRACTION_SCHEMA, response_json=True)
        self.assertEqual(result['raw_error'], None)
        self.assertEqual(result['answer'], '{"insurer_name": "X"}')
        g.assert_called_once()
        self.assertFalse(o.called)
        self.assertFalse(n.called)
        self.assertFalse(gr.called)

    def test_openrouter_is_fallback_when_gemini_fails(self):
        with mock.patch.object(main, 'call_gemini', return_value=_err('Gemini quota exhausted')) as g, \
             mock.patch.object(main, 'call_openrouter', return_value=_ok()) as o:
            result = main.call_llm('sys', 'user', extraction=True, max_tokens=8192, temperature=0.1,
                                   response_schema=main.EXTRACTION_SCHEMA, response_json=True)
        self.assertEqual(result['raw_error'], None)
        self.assertEqual(result['answer'], '{"insurer_name": "X"}')
        g.assert_called_once()
        o.assert_called_once()

    def test_all_providers_failed_surfaces_combined_error(self):
        with mock.patch.object(main, 'call_gemini', return_value=_err('gemini down')), \
             mock.patch.object(main, 'call_openrouter', return_value=_err('or down')), \
             mock.patch.object(main, 'call_nvidia', return_value=_err('nv down')), \
             mock.patch.object(main, 'groq_extract_chunked', return_value=_err('groq down')):
            result = main.call_llm('sys', 'user', extraction=True, max_tokens=8192, temperature=0.1,
                                   response_schema=main.EXTRACTION_SCHEMA, response_json=True)
        self.assertIsNone(result['answer'])
        self.assertIn('gemini', result['raw_error'])
        self.assertIn('groq', result['raw_error'])


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `ai-service/`): `& ".\\venv\\Scripts\\python.exe" -m unittest app.test_fast_extraction -v`
Expected: `test_gemini_is_primary_and_used_when_successful` FAILS because `call_gemini` is invoked after `call_openrouter` (assertion error from the openrouter mock). The other two tests may pass by accident — that is fine; the primary test must fail.

- [ ] **Step 3: Reorder the chain**

In `ai-service/app/main.py`, change the `if extraction:` block inside `call_llm` (currently `main.py:333-339`) from:

```python
        chain = [
            ("openrouter", call_openrouter, {"model": OPENROUTER_EXTRACTION_MODEL, "response_json": response_json}),
            ("gemini", call_gemini, {"model": GEMINI_MODEL, "response_schema": response_schema}),
            ("nvidia", call_nvidia, {"model": NVIDIA_EXTRACTION_MODEL, "response_json": response_json}),
            ("groq", call_groq, {"model": GROQ_EXTRACTION_MODEL, "response_json": response_json}),
        ]
```

to:

```python
        chain = [
            ("gemini", call_gemini, {"model": GEMINI_MODEL, "response_schema": response_schema}),
            ("openrouter", call_openrouter, {"model": OPENROUTER_EXTRACTION_MODEL, "response_json": response_json}),
            ("nvidia", call_nvidia, {"model": NVIDIA_EXTRACTION_MODEL, "response_json": response_json}),
            ("groq", call_groq, {"model": GROQ_EXTRACTION_MODEL, "response_json": response_json}),
        ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `ai-service/`): `& ".\\venv\\Scripts\\python.exe" -m unittest app.test_fast_extraction -v`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ai-service/app/main.py ai-service/app/test_fast_extraction.py
git commit -m "feat: make Gemini primary for clause extraction"
```

---

### Task 2: Fail fast on Gemini auth errors

**Files:**
- Modify: `ai-service/app/main.py:277-319` (the retry loop in `call_gemini`)
- Test: `ai-service/app/test_fast_extraction.py` (append)

**Interfaces:**
- Consumes: `call_gemini` from Task 1; `main._get_gemini_client()`.
- Produces: `main.call_gemini` returns immediately (no retry/backoff) on auth/authorization errors, with `raw_error` set, so the fallback chain advances.

- [ ] **Step 1: Write the failing test**

Append to `ai-service/app/test_fast_extraction.py` (add before `if __name__`):

```python
class GeminiAuthFailFastTests(unittest.TestCase):

    def _make_client(self, exc):
        client = mock.Mock()
        client.models.generate_content.side_effect = exc
        return client

    def test_auth_error_returns_immediately_without_retry(self):
        client = self._make_client(RuntimeError('API key not valid. Please pass a valid API key. (401)'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertIn('API key not valid', result['raw_error'])
        self.assertEqual(client.models.generate_content.call_count, 1)
        sleep.assert_not_called()

    def test_permission_denied_returns_immediately_without_retry(self):
        client = self._make_client(RuntimeError('403 PERMISSION_DENIED'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertEqual(client.models.generate_content.call_count, 1)
        sleep.assert_not_called()

    def test_quota_error_still_returns_immediately(self):
        client = self._make_client(RuntimeError('429 RESOURCE_EXHAUSTED'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertIn('quota exhausted', result['raw_error'])
        self.assertEqual(client.models.generate_content.call_count, 1)
        sleep.assert_not_called()

    def test_transient_error_still_retries(self):
        client = self._make_client(RuntimeError('503 Service Unavailable'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertEqual(client.models.generate_content.call_count, main.MAX_RETRIES)
        sleep.assert_called()
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `ai-service/`): `& ".\\venv\\Scripts\\python.exe" -m unittest app.test_fast_extraction.GeminiAuthFailFastTests -v`
Expected: The auth and permission tests FAIL — today `call_gemini` retries 4× (sleep called 3×), so `call_count == 4` and `sleep.assert_not_called()` fails. The quota test may already pass.

- [ ] **Step 3: Implement fail-fast auth detection**

In `ai-service/app/main.py`, replace the exception handler inside the `call_gemini` retry loop (currently `main.py:295-312`) from:

```python
        except Exception as e:
            error_str = str(e)
            # Fail fast on quota exhausted errors
            if "RESOURCE_EXHAUSTED" in error_str or "quota" in error_str.lower():
                return {
                    "answer": None,
                    "grounded": False,
                    "cited_clause_id": None,
                    "raw_error": f"Gemini quota exhausted: {error_str[:200]}"
                }
            if attempt == MAX_RETRIES - 1:
                return {
                    "answer": None,
                    "grounded": False,
                    "cited_clause_id": None,
                    "raw_error": f"Gemini error: {str(e)}"
                }
            time.sleep(2 ** attempt)
```

to:

```python
        except Exception as e:
            error_str = str(e)
            lower = error_str.lower()
            # Fail fast on quota exhausted errors
            if "RESOURCE_EXHAUSTED" in error_str or "quota" in lower:
                return {
                    "answer": None,
                    "grounded": False,
                    "cited_clause_id": None,
                    "raw_error": f"Gemini quota exhausted: {error_str[:200]}"
                }
            # Fail fast on auth errors — a bad key will not heal on retry, and
            # each backoff cycle wastes seconds before the fallback chain moves on.
            if any(token in error_str for token in ("PERMISSION_DENIED", "UNAUTHENTICATED", "403", "401", "API key not valid")) or "invalid key" in lower:
                return {
                    "answer": None,
                    "grounded": False,
                    "cited_clause_id": None,
                    "raw_error": f"Gemini auth error: {error_str[:200]}"
                }
            if attempt == MAX_RETRIES - 1:
                return {
                    "answer": None,
                    "grounded": False,
                    "cited_clause_id": None,
                    "raw_error": f"Gemini error: {str(e)}"
                }
            time.sleep(2 ** attempt)
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `ai-service/`): `& ".\\venv\\Scripts\\python.exe" -m unittest app.test_fast_extraction -v`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ai-service/app/main.py ai-service/app/test_fast_extraction.py
git commit -m "feat: fail fast on Gemini auth errors"
```

---

### Task 3: Reuse HTTP connections across the provider chain

**Files:**
- Modify: `ai-service/app/main.py:90-199` (`call_openai_compatible`) and the module-level config area near `MAX_RETRIES` (`main.py:73`)
- Test: `ai-service/app/test_fast_extraction.py` (append)

**Interfaces:**
- Consumes: `call_openai_compatible` as-is; `main.MAX_RETRIES`.
- Produces: A module-level `main._HTTP_SESSION` (`requests.Session`) that `call_openai_compatible` posts through instead of calling bare `requests.post`. All provider wrappers (`call_groq`, `call_nvidia`, `call_openrouter`) inherit it automatically.

- [ ] **Step 1: Write the failing test**

Append to `ai-service/app/test_fast_extraction.py`:

```python
class HttpSessionTests(unittest.TestCase):

    def test_call_openai_compatible_posts_via_shared_session(self):
        response = mock.Mock(status_code=200)
        response.json.return_value = {"choices": [{"message": {"content": "ok"}}]}
        session = mock.Mock()
        session.post.return_value = response
        with mock.patch.object(main, '_HTTP_SESSION', session) as s, \
             mock.patch.object(main.requests, 'post', side_effect=AssertionError('bare requests.post must not be used')):
            result = main.call_openai_compatible(
                base_url='https://example.com/v1', api_key='sk-test',
                provider_label='Test', system_prompt='sys', user_prompt='user',
                model='m', max_tokens=10, temperature=0.1, response_json=False)
        self.assertEqual(result['answer'], 'ok')
        s.post.assert_called_once()
        self.assertIn('/chat/completions', s.post.call_args.args[0])
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `ai-service/`): `& ".\\venv\\Scripts\\python.exe" -m unittest app.test_fast_extraction.HttpSessionTests -v`
Expected: FAIL with `AttributeError: module 'ai-service.app.main' has no attribute '_HTTP_SESSION'`.

- [ ] **Step 3: Add the shared session and use it**

In `ai-service/app/main.py`, after `MAX_RETRIES = 4` (line 73), add:

```python
_HTTP_SESSION = requests.Session()
```

In `call_openai_compatible`, change the request line (currently `main.py:124`):

```python
            response = requests.post(
```

to:

```python
            response = _HTTP_SESSION.post(
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `ai-service/`): `& ".\\venv\\Scripts\\python.exe" -m unittest app.test_fast_extraction -v`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ai-service/app/main.py ai-service/app/test_fast_extraction.py
git commit -m "feat: reuse shared HTTP session across provider calls"
```

---

### Task 4: Fix stale `.env` comments and verify end-to-end on sample PDFs

**Files:**
- Modify: `.env` (comments only — file is gitignored, do not commit)
- Read: `ai-service/extract_samples.py` (exists; no change needed)

**Interfaces:**
- Consumes: Task 1-3 changes live in `ai-service/app/main.py`; the AI service must be restarted to pick them up.
- Produces: Measured before/after elapsed time per sample PDF, proving the sub-minute goal and that extraction output is unchanged.

- [x] **Step 1: Fix stale `.env` comments**

In `.env`:
- Lines 16-19 currently say OpenRouter is the "primary free provider". Rewrite the block to describe Gemini 2.0 Flash as the primary extraction provider and OpenRouter as the fallback. Keep the rate-limit notes accurate.
- Lines 41-42 say extraction completes in ~190s on free-tier Groq. Update to note the Gemini-primary chain targets under a minute, but keep `CLAUSE_EXTRACTION_TIMEOUT_MS=360000` generous so slow fallback paths still complete.

- [x] **Step 2: Restart the AI service**

If the AI service is running, restart it so the new `main.py` loads:
```bash
# from repo root — exact command depends on how it was started
# e.g. taskkill /F /PID <pid> then: cd ai-service; .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```
Run `curl -s http://localhost:8001/health` (or open in browser) — expected `{"status":"ok"}`.

- [x] **Step 3: Time extraction on all sample PDFs**

For each PDF in `samples/`, POST it to the running service and measure elapsed time. From the repo root, using PowerShell:
```powershell
$f = 'samples\20240325_Prospectus_IHIP.pdf'
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$resp = Invoke-RestMethod -Uri 'http://localhost:8001/extract-clauses' -Method Post -ContentType 'application/json' -Body (@{ documentId = 'perf-check'; extractedText = (Get-Content "tmp_extracts\20240325_Prospectus_IHIP.txt" -Raw) } | ConvertTo-Json)
$sw.Stop()
"$f : $($sw.Elapsed.TotalSeconds)s  clauses=$($resp.clauses.Count)  partial=$($resp.partial)"
```
Repeat for `a370272f732749999e7c19e82e38ad7c.pdf`, `chi-prospectus.pdf`, `m4-5f.pdf` using their matching `tmp_extracts/*.txt` files.
Expected: each completes in under 60s (success criteria) with a non-zero `clauses` count. Capture and paste the raw timing output.

- [x] **Step 4: Confirm no extraction regression**

Check the returned `extraction` JSON for each sample still contains `insurer_name`, `sum_insured`, and clause groups (`room_rent_clause`, `co_pay`, `waiting_periods`, `sub_limits`, `exclusions`). Compare against the `clauses` structure from a pre-change run (see `backend/src/routes/__tests__/documents-extraction-fallback.test.ts` and prior `tmp_extracts` fixtures) — the shape must be unchanged.

- [x] **Step 5: Update the spec's verification note and commit**

Record the measured times in `docs/superpowers/specs/2026-08-15-fast-extraction-design.md` under "Verification". Then commit only source/test changes if any were made during verification (there should be none — the code changes were committed in Tasks 1-3). If no code changed, note the verification was already committed and skip the commit.

> **Verification deviation (controller note):** the plan expected zero code changes in Task 4,
> but end-to-end timing surfaced three real defects that blocked the sub-minute success
> criterion and had to be fixed in this branch: (1) `gemini-2.0-flash` is retired by Google
> (404) so extraction silently fell through to the slow OpenRouter 120B; (2) extraction JSON
> exceeded the 8192 output-token cap, truncating the response (`finish_reason=MAX_TOKENS`)
> into invalid JSON; (3) Gemini 2.5 thinking mode added ~15-20s per call. Fixes committed:
> `gemini-2.5-flash`, `GEMINI_EXTRACTION_MAX_TOKENS=65536` (Gemini extraction path only),
> `GEMINI_THINKING_BUDGET=0`. Results moved from 77-210s / invalid JSON to 18.7-44.4s /
> valid output. These are within this branch's scope (making Gemini the working primary).

---

## Self-Review Notes

- **Spec coverage:** Change 1 → Task 1; Change 2 → Task 2; Change 3 → Task 3; Change 4 → Task 4. Success criteria (sub-minute, output unchanged) verified in Task 4. All spec items covered.
- **Placeholder scan:** All steps contain concrete code or commands; no TBD/TODO.
- **Type consistency:** `call_llm`, `call_gemini`, `call_openai_compatible`, `EXTRACTION_SCHEMA` signatures are referenced exactly as defined in `main.py`. Test module path `ai-service.app.test_fast_extraction` matches the package layout (`ai-service/app/main.py` → `app.test_fast_extraction`).

