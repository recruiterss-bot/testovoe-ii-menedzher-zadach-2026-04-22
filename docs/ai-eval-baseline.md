# AI Eval Baseline (v1)

- Date: 2026-04-22
- Dataset version: v1 (120 cases)
- Scope: US-3..US-6
- Eval mode: deterministic harness (fixed dataset + reproducible seeded simulation)

## Candidate A (economy lane)
- Provider: OpenAI
- Model: `gpt-4`
- Role: economy

## Candidate B (quality lane)
- Provider: OpenAI
- Model: `gpt-4`
- Role: quality

## Hard-gates (selected lane blend)
- schema_valid_rate: 100.00% (threshold >= 99%)
- timeout_rate: 1.67% (threshold <= 2%)
- ai_unavailable_rate: 0.83% (threshold <= 2%)
- Result: PASS

## Quality-gates
- US-3 classification_accept_or_light_edit_rate: 89.29% (threshold >= 80%)
- US-4 subtask_usefulness_rate: 93.10% (threshold >= 75%)
- US-4 unsafe_subtasks_rate: 0.00% (threshold <= 2%)
- US-5 priority_agreement_rate: 86.21% (threshold >= 80%)
- US-6 numeric_consistency_rate: 100.00% (threshold >= 99%)
- US-6 recommendation_usefulness_rate: 80.00% (threshold >= 75%)
- Result: PASS

## Cost-gates
- p50_cost_per_request (US-3/US-5) economy: 0.008400 USD
- p50_cost_per_request (US-3/US-5) quality: 0.008400 USD
- economy_vs_quality_p50_ratio: 100.00% (threshold <= 65%)
- blended_cost_per_1000_ai_requests (selected lane): 16.5750 USD (budget <= 40.00 USD)
- Result: PASS

## Per-model snapshots

### Economy model
- schema_valid_rate: 100.00%
- timeout_rate: 1.67%
- ai_unavailable_rate: 0.83%
- blended_cost_per_1000_ai_requests: 16.4500 USD

### Quality model
- schema_valid_rate: 100.00%
- timeout_rate: 0.83%
- ai_unavailable_rate: 0.00%
- blended_cost_per_1000_ai_requests: 16.4450 USD

## Decision
- selected lane: OpenAI dual-lane (`gpt-4` for US-3/US-5 + `gpt-4` for US-4/US-6)
- final gate status: PASS
- evidence artifacts updated by harness:
- `docs/ai-eval-baseline.md`
- `docs/llm-provider-matrix.md`
