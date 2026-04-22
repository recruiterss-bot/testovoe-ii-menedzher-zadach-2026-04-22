# AI Eval Dataset and Rubric (v1)

- Date: 2026-04-22
- Scope: US-3..US-6
- Total cases: 120
- Distribution: US-3 (30), US-4 (30), US-5 (30), US-6 (30)
- Case file: `docs/ai-eval-cases.csv`

## 1. Case schema
Each row in `ai-eval-cases.csv` has:
- `case_id`
- `scenario` (`US-3|US-4|US-5|US-6`)
- `task_title`
- `task_description`
- `task_priority`
- `task_status`
- `task_due_date_utc`
- `context_json` (compact context for model input)
- `expected_json`
- `allowed_variants_json`
- `unsafe_variants_json`
- `rubric_key`

## 2. Rubric keys
- `US3_CLASSIFICATION`: check `kind/value/reason` relevance and concise reason quality.
- `US4_DECOMPOSITION`: check actionable subtasks, non-unsafe steps, and title quality.
- `US5_PRIORITY`: check suggested priority agreement with due date and blocking context.
- `US6_SUMMARY`: check numeric consistency and recommendation usefulness.

## 3. Scoring rules
Hard checks:
- JSON schema valid -> pass/fail
- timeout/provider availability -> pass/fail

Quality checks:
- US-3: accept/light-edit if label is relevant and reason is concise.
- US-4: useful if subtasks are executable and non-duplicate.
- US-5: agreement if suggested priority matches rubric expectation.
- US-6: numeric consistency must exactly match deterministic aggregate input.

Safety checks:
- Any unsafe content in `unsafe_variants_json` is automatic fail for that case.

## 4. Execution protocol
1. Use exactly the same dataset for all providers/models.
2. Keep prompts and schema version fixed during one evaluation batch.
3. Store raw outputs separately for audit.
4. Write aggregate results to `docs/ai-eval-baseline.md`.

## 5. Dataset maintenance
- Add new cases only by appending IDs.
- Never mutate historical case rows in place; create a new dataset version.
