# LLM Provider Matrix (v3)

- Date: 2026-04-22
- Scope: provider/model selection for US-3..US-6
- Related: `AI-ADR.md`, `AI-Eval-Quality-Cost.md`, `.env.example`, `docs/ai-eval-baseline.md`
- Data basis: reproducible eval harness on `docs/ai-eval-cases.csv` (120 cases).

## 1. Goal
Keep one auditable provider/model matrix and avoid ad-hoc model switching.

## 2. Scenario mapping
- `US-3`, `US-5`: economy lane (low latency, lower cost, strict schema output)
- `US-4`, `US-6`: quality lane (reasoning quality first, bounded by budget gate)

## 3. Candidate matrix

| Provider | Economy candidate | Quality candidate | Structured output | Tool calling | Context window (economy / quality) | Price input/output ($/MTok) (economy / quality) | Hard-gates status | Quality-gates status | Blended cost / 1000 req status | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| OpenAI | `gpt-5.4-mini` | `gpt-5.4` | Yes | Yes | `400K / 1.05M` | `$0.75/$4.50` / `$2.50/$15.00` | PASS (100.00% / 100.00% schema-valid) | PASS (US-3 89.29%, US-4 93.10%, US-5 86.21%, US-6 100.00%) | PASS (16.5750 USD) | **Selected default** |
| Anthropic | `claude-sonnet-4-6` | `claude-opus-4-7` | Yes | Yes | `1M / 1M` | `$3/$15` / `$5/$25` | Not evaluated in current harness run | Not evaluated in current harness run | Not evaluated in current harness run | Candidate |
| Google | `gemini-2.5-flash` | `gemini-2.5-pro` | Yes | Yes | `1M / 1M` | `$0.30/$2.50` / `$1.25/$5.00`* | Not evaluated in current harness run | Not evaluated in current harness run | Not evaluated in current harness run | Candidate |
| xAI | `grok-4.20` | `grok-4.20` | Yes | Yes | `2M / 2M` | Pricing pending scripted capture from `docs.x.ai/docs/models/` | Not evaluated in current harness run | Not evaluated in current harness run | Not evaluated in current harness run | Candidate |

* For Gemini 2.5 Pro pricing is tiered by prompt size in official pricing page; matrix stores baseline tier for prompts up to 200K.

## 4. Current selected profile
- Provider default: `openai`
- Economy model: `gpt-5.4-mini`
- Quality model: `gpt-5.4`
- Measured blended cost per 1000 requests: 16.5750 USD
- Gate status: PASS

## 5. Selection rules (final, after harness)
1. Exclude rows failing any hard-gate.
2. Exclude rows failing any quality-gate.
3. Choose minimum measured `blended_cost_per_1000_ai_requests`.
4. Record decision in `docs/ai-eval-baseline.md` and README.

## 6. Change management
- Trigger canary/rollback when:
- any quality metric drops by `>= 5 p.p.` vs baseline;
- or blended cost grows by `>= 30%` vs baseline.

## 7. Review cadence
- Revalidate before release candidate.
- Revalidate after major provider/model update.

## 8. Source links
- OpenAI models/pricing: `developers.openai.com/api/docs/models` and model pages for `gpt-5.4`, `gpt-5.4-mini`.
- Anthropic models/pricing: `docs.anthropic.com` models overview and pricing pages.
- Google Gemini pricing/models: `ai.google.dev/gemini-api/docs/pricing`, `ai.google.dev/gemini-api/docs/models`.
- xAI models/pricing: `docs.x.ai/docs/models/`.
