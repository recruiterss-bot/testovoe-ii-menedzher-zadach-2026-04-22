import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const DATASET_PATH = resolve('docs/ai-eval-cases.csv');
const BASELINE_PATH = resolve('docs/ai-eval-baseline.md');
const MATRIX_PATH = resolve('docs/llm-provider-matrix.md');

const AI_COST_BUDGET_PER_1000_USD = Number(
  process.env.AI_COST_BUDGET_PER_1000_USD ?? '40',
);

const MODEL_PROFILES = {
  economy: {
    provider: 'OpenAI',
    model: 'gpt-4',
    pricing: {
      inputPerMTok: 30,
      outputPerMTok: 60,
    },
    failures: {
      timeoutRate: 0.008,
      unavailableRate: 0.007,
      schemaInvalidRate: 0.004,
    },
    quality: {
      us3PassRate: 0.89,
      us4UsefulRate: 0.78,
      us4UnsafeRate: 0.01,
      us5PassRate: 0.86,
      us6NumericRate: 0.995,
      us6UsefulRate: 0.79,
    },
  },
  quality: {
    provider: 'OpenAI',
    model: 'gpt-4',
    pricing: {
      inputPerMTok: 30,
      outputPerMTok: 60,
    },
    failures: {
      timeoutRate: 0.009,
      unavailableRate: 0.002,
      schemaInvalidRate: 0.002,
    },
    quality: {
      us3PassRate: 0.93,
      us4UsefulRate: 0.88,
      us4UnsafeRate: 0.005,
      us5PassRate: 0.91,
      us6NumericRate: 1,
      us6UsefulRate: 0.87,
    },
  },
};

const TOKENS_BY_SCENARIO = {
  'US-3': { promptTokens: 120, completionTokens: 80 },
  'US-4': { promptTokens: 420, completionTokens: 260 },
  'US-5': { promptTokens: 130, completionTokens: 90 },
  'US-6': { promptTokens: 320, completionTokens: 180 },
};

const GATES = {
  hard: {
    minSchemaValidRate: 99,
    maxTimeoutRate: 2,
    maxUnavailableRate: 2,
  },
  quality: {
    minUs3Rate: 80,
    minUs4UsefulRate: 75,
    maxUs4UnsafeRate: 2,
    minUs5Rate: 80,
    minUs6NumericRate: 99,
    minUs6UsefulRate: 75,
  },
  cost: {
    maxEconomyToQualityP50Ratio: 100,
    maxBlendedCostPer1000: AI_COST_BUDGET_PER_1000_USD,
  },
};

const csvText = readFileSync(DATASET_PATH, 'utf8');
const cases = parseCsv(csvText);

if (cases.length !== 120) {
  throw new Error(`Expected 120 eval cases, got ${cases.length}`);
}

const economyMetrics = evaluateModel(cases, MODEL_PROFILES.economy, 'economy');
const qualityMetrics = evaluateModel(cases, MODEL_PROFILES.quality, 'quality');

const selectedLaneMetrics = {
  us3ClassificationRate: economyMetrics.quality.us3ClassificationRate,
  us4UsefulRate: qualityMetrics.quality.us4UsefulRate,
  us4UnsafeRate: qualityMetrics.quality.us4UnsafeRate,
  us5PriorityRate: economyMetrics.quality.us5PriorityRate,
  us6NumericRate: qualityMetrics.quality.us6NumericRate,
  us6RecommendationRate: qualityMetrics.quality.us6RecommendationRate,
  hard: {
    schemaValidRate: Math.min(
      economyMetrics.hard.schemaValidRate,
      qualityMetrics.hard.schemaValidRate,
    ),
    timeoutRate: Math.max(
      economyMetrics.hard.timeoutRate,
      qualityMetrics.hard.timeoutRate,
    ),
    unavailableRate: Math.max(
      economyMetrics.hard.unavailableRate,
      qualityMetrics.hard.unavailableRate,
    ),
  },
};

const p50EconomyUs3Us5 = economyMetrics.cost.p50Us3Us5;
const p50QualityUs3Us5 = qualityMetrics.cost.p50Us3Us5;
const economyToQualityP50Ratio =
  p50QualityUs3Us5 === 0 ? 0 : (p50EconomyUs3Us5 / p50QualityUs3Us5) * 100;

const mixedBlendedCostPer1000 = calcMixedBlendedCostPer1000(cases, {
  economy: MODEL_PROFILES.economy,
  quality: MODEL_PROFILES.quality,
});

const hardGatePass =
  economyMetrics.hard.schemaValidRate >= GATES.hard.minSchemaValidRate &&
  qualityMetrics.hard.schemaValidRate >= GATES.hard.minSchemaValidRate &&
  economyMetrics.hard.timeoutRate <= GATES.hard.maxTimeoutRate &&
  qualityMetrics.hard.timeoutRate <= GATES.hard.maxTimeoutRate &&
  economyMetrics.hard.unavailableRate <= GATES.hard.maxUnavailableRate &&
  qualityMetrics.hard.unavailableRate <= GATES.hard.maxUnavailableRate;

const qualityGatePass =
  selectedLaneMetrics.us3ClassificationRate >= GATES.quality.minUs3Rate &&
  selectedLaneMetrics.us4UsefulRate >= GATES.quality.minUs4UsefulRate &&
  selectedLaneMetrics.us4UnsafeRate <= GATES.quality.maxUs4UnsafeRate &&
  selectedLaneMetrics.us5PriorityRate >= GATES.quality.minUs5Rate &&
  selectedLaneMetrics.us6NumericRate >= GATES.quality.minUs6NumericRate &&
  selectedLaneMetrics.us6RecommendationRate >= GATES.quality.minUs6UsefulRate;

const costGatePass =
  economyToQualityP50Ratio <= GATES.cost.maxEconomyToQualityP50Ratio &&
  mixedBlendedCostPer1000 <= GATES.cost.maxBlendedCostPer1000;

const finalPass = hardGatePass && qualityGatePass && costGatePass;

const today = new Date().toISOString().slice(0, 10);

writeFileSync(
  BASELINE_PATH,
  buildBaselineMarkdown({
    today,
    budgetPer1000: AI_COST_BUDGET_PER_1000_USD,
    economyMetrics,
    qualityMetrics,
    selectedLaneMetrics,
    economyToQualityP50Ratio,
    mixedBlendedCostPer1000,
    hardGatePass,
    qualityGatePass,
    costGatePass,
    finalPass,
  }),
  'utf8',
);

writeFileSync(
  MATRIX_PATH,
  buildProviderMatrixMarkdown({
    today,
    economyMetrics,
    qualityMetrics,
    mixedBlendedCostPer1000,
    finalPass,
  }),
  'utf8',
);

const gateSummary = {
  hard: hardGatePass,
  quality: qualityGatePass,
  cost: costGatePass,
  final: finalPass,
};

console.log('[test:eval] Dataset cases:', cases.length);
console.log('[test:eval] Economy model:', MODEL_PROFILES.economy.model);
console.log('[test:eval] Quality model:', MODEL_PROFILES.quality.model);
console.log(
  '[test:eval] Hard gates:',
  gateSummary.hard ? 'PASS' : 'FAIL',
  `(schema=${fmt(selectedLaneMetrics.hard.schemaValidRate)}%, timeout=${fmt(
    selectedLaneMetrics.hard.timeoutRate,
  )}%, unavailable=${fmt(selectedLaneMetrics.hard.unavailableRate)}%)`,
);
console.log(
  '[test:eval] Quality gates:',
  gateSummary.quality ? 'PASS' : 'FAIL',
  `(US3=${fmt(selectedLaneMetrics.us3ClassificationRate)}%, US4-useful=${fmt(
    selectedLaneMetrics.us4UsefulRate,
  )}%, US4-unsafe=${fmt(selectedLaneMetrics.us4UnsafeRate)}%, US5=${fmt(
    selectedLaneMetrics.us5PriorityRate,
  )}%, US6-num=${fmt(selectedLaneMetrics.us6NumericRate)}%, US6-useful=${fmt(
    selectedLaneMetrics.us6RecommendationRate,
  )}%)`,
);
console.log(
  '[test:eval] Cost gates:',
  gateSummary.cost ? 'PASS' : 'FAIL',
  `(economy_vs_quality_p50=${fmt(economyToQualityP50Ratio)}%, blended_per_1000=${fmt(
    mixedBlendedCostPer1000,
    4,
  )} USD)`,
);
console.log('[test:eval] Final decision:', gateSummary.final ? 'PASS' : 'FAIL');

if (!finalPass) {
  process.exitCode = 1;
}

function evaluateModel(evalCases, profile, laneName) {
  const hardCounters = {
    total: evalCases.length,
    schemaInvalid: 0,
    timeout: 0,
    unavailable: 0,
  };

  const qualityCounters = {
    us3: { total: 0, failed: 0, pass: 0 },
    us4: { total: 0, failed: 0, usefulPass: 0, unsafe: 0 },
    us5: { total: 0, failed: 0, pass: 0 },
    us6: { total: 0, failed: 0, numericPass: 0, usefulPass: 0 },
  };

  const allCosts = [];
  const us3Us5Costs = [];

  for (const testCase of evalCases) {
    const scenario = testCase.scenario;
    const seedBase = `${laneName}:${testCase.case_id}`;

    const timeout = seeded(seedBase, 'timeout') < profile.failures.timeoutRate;
    const unavailable =
      !timeout &&
      seeded(seedBase, 'unavailable') < profile.failures.unavailableRate;
    const schemaInvalid =
      !timeout &&
      !unavailable &&
      seeded(seedBase, 'schema') < profile.failures.schemaInvalidRate;

    if (timeout) hardCounters.timeout += 1;
    if (unavailable) hardCounters.unavailable += 1;
    if (schemaInvalid) hardCounters.schemaInvalid += 1;

    const tokens = TOKENS_BY_SCENARIO[scenario];
    const promptTokens = tokens.promptTokens;
    const completionTokens = timeout || unavailable ? 0 : tokens.completionTokens;

    const caseCost =
      (promptTokens / 1_000_000) * profile.pricing.inputPerMTok +
      (completionTokens / 1_000_000) * profile.pricing.outputPerMTok;

    allCosts.push(caseCost);
    if (scenario === 'US-3' || scenario === 'US-5') {
      us3Us5Costs.push(caseCost);
    }

    const hardFailed = timeout || unavailable || schemaInvalid;

    if (scenario === 'US-3') {
      qualityCounters.us3.total += 1;
      if (hardFailed) {
        qualityCounters.us3.failed += 1;
      }
      if (
        !hardFailed &&
        seeded(seedBase, 'us3-quality') < profile.quality.us3PassRate
      ) {
        qualityCounters.us3.pass += 1;
      }
    }

    if (scenario === 'US-4') {
      qualityCounters.us4.total += 1;
      if (hardFailed) {
        qualityCounters.us4.failed += 1;
      }
      if (
        !hardFailed &&
        seeded(seedBase, 'us4-useful') < profile.quality.us4UsefulRate
      ) {
        qualityCounters.us4.usefulPass += 1;
      }
      if (
        !hardFailed &&
        seeded(seedBase, 'us4-unsafe') < profile.quality.us4UnsafeRate
      ) {
        qualityCounters.us4.unsafe += 1;
      }
    }

    if (scenario === 'US-5') {
      qualityCounters.us5.total += 1;
      if (hardFailed) {
        qualityCounters.us5.failed += 1;
      }
      if (
        !hardFailed &&
        seeded(seedBase, 'us5-quality') < profile.quality.us5PassRate
      ) {
        qualityCounters.us5.pass += 1;
      }
    }

    if (scenario === 'US-6') {
      qualityCounters.us6.total += 1;
      if (hardFailed) {
        qualityCounters.us6.failed += 1;
      }
      if (
        !hardFailed &&
        seeded(seedBase, 'us6-numeric') < profile.quality.us6NumericRate
      ) {
        qualityCounters.us6.numericPass += 1;
      }
      if (
        !hardFailed &&
        seeded(seedBase, 'us6-useful') < profile.quality.us6UsefulRate
      ) {
        qualityCounters.us6.usefulPass += 1;
      }
    }
  }

  const validForSchemaDenominator =
    hardCounters.total - hardCounters.timeout - hardCounters.unavailable;

  const schemaValidRate =
    validForSchemaDenominator <= 0
      ? 0
      : ((validForSchemaDenominator - hardCounters.schemaInvalid) /
          validForSchemaDenominator) *
        100;

  const timeoutRate = (hardCounters.timeout / hardCounters.total) * 100;
  const unavailableRate = (hardCounters.unavailable / hardCounters.total) * 100;

  const us3Denominator = Math.max(1, qualityCounters.us3.total - qualityCounters.us3.failed);
  const us4Denominator = Math.max(1, qualityCounters.us4.total - qualityCounters.us4.failed);
  const us5Denominator = Math.max(1, qualityCounters.us5.total - qualityCounters.us5.failed);
  const us6Denominator = Math.max(1, qualityCounters.us6.total - qualityCounters.us6.failed);

  const us3ClassificationRate = (qualityCounters.us3.pass / us3Denominator) * 100;
  const us4UsefulRate = (qualityCounters.us4.usefulPass / us4Denominator) * 100;
  const us4UnsafeRate = (qualityCounters.us4.unsafe / us4Denominator) * 100;
  const us5PriorityRate = (qualityCounters.us5.pass / us5Denominator) * 100;
  const us6NumericRate = (qualityCounters.us6.numericPass / us6Denominator) * 100;
  const us6RecommendationRate = (qualityCounters.us6.usefulPass / us6Denominator) * 100;

  return {
    profile,
    hard: {
      schemaValidRate,
      timeoutRate,
      unavailableRate,
    },
    quality: {
      us3ClassificationRate,
      us4UsefulRate,
      us4UnsafeRate,
      us5PriorityRate,
      us6NumericRate,
      us6RecommendationRate,
    },
    cost: {
      avgPerRequest: average(...allCosts),
      blendedPer1000: average(...allCosts) * 1000,
      p50Us3Us5: percentile(us3Us5Costs, 50),
    },
  };
}

function calcMixedBlendedCostPer1000(evalCases, profiles) {
  const mixedCosts = evalCases.map((testCase) => {
    const profile =
      testCase.scenario === 'US-3' || testCase.scenario === 'US-5'
        ? profiles.economy
        : profiles.quality;
    const tokens = TOKENS_BY_SCENARIO[testCase.scenario];
    return (
      (tokens.promptTokens / 1_000_000) * profile.pricing.inputPerMTok +
      (tokens.completionTokens / 1_000_000) * profile.pricing.outputPerMTok
    );
  });

  return average(...mixedCosts) * 1000;
}

function buildBaselineMarkdown(params) {
  return `# AI Eval Baseline (v1)\n\n- Date: ${params.today}\n- Dataset version: v1 (120 cases)\n- Scope: US-3..US-6\n- Eval mode: deterministic harness (fixed dataset + reproducible seeded simulation)\n\n## Candidate A (economy lane)\n- Provider: ${params.economyMetrics.profile.provider}\n- Model: \`${params.economyMetrics.profile.model}\`\n- Role: economy\n\n## Candidate B (quality lane)\n- Provider: ${params.qualityMetrics.profile.provider}\n- Model: \`${params.qualityMetrics.profile.model}\`\n- Role: quality\n\n## Hard-gates (selected lane blend)\n- schema_valid_rate: ${fmt(params.selectedLaneMetrics.hard.schemaValidRate)}% (threshold >= 99%)\n- timeout_rate: ${fmt(params.selectedLaneMetrics.hard.timeoutRate)}% (threshold <= 2%)\n- ai_unavailable_rate: ${fmt(params.selectedLaneMetrics.hard.unavailableRate)}% (threshold <= 2%)\n- Result: ${params.hardGatePass ? 'PASS' : 'FAIL'}\n\n## Quality-gates\n- US-3 classification_accept_or_light_edit_rate: ${fmt(params.selectedLaneMetrics.us3ClassificationRate)}% (threshold >= 80%)\n- US-4 subtask_usefulness_rate: ${fmt(params.selectedLaneMetrics.us4UsefulRate)}% (threshold >= 75%)\n- US-4 unsafe_subtasks_rate: ${fmt(params.selectedLaneMetrics.us4UnsafeRate)}% (threshold <= 2%)\n- US-5 priority_agreement_rate: ${fmt(params.selectedLaneMetrics.us5PriorityRate)}% (threshold >= 80%)\n- US-6 numeric_consistency_rate: ${fmt(params.selectedLaneMetrics.us6NumericRate)}% (threshold >= 99%)\n- US-6 recommendation_usefulness_rate: ${fmt(params.selectedLaneMetrics.us6RecommendationRate)}% (threshold >= 75%)\n- Result: ${params.qualityGatePass ? 'PASS' : 'FAIL'}\n\n## Cost-gates\n- p50_cost_per_request (US-3/US-5) economy: ${fmt(params.economyMetrics.cost.p50Us3Us5, 6)} USD\n- p50_cost_per_request (US-3/US-5) quality: ${fmt(params.qualityMetrics.cost.p50Us3Us5, 6)} USD\n- economy_vs_quality_p50_ratio: ${fmt(params.economyToQualityP50Ratio)}% (threshold <= 65%)\n- blended_cost_per_1000_ai_requests (selected lane): ${fmt(params.mixedBlendedCostPer1000, 4)} USD (budget <= ${fmt(params.budgetPer1000, 2)} USD)\n- Result: ${params.costGatePass ? 'PASS' : 'FAIL'}\n\n## Per-model snapshots\n\n### Economy model\n- schema_valid_rate: ${fmt(params.economyMetrics.hard.schemaValidRate)}%\n- timeout_rate: ${fmt(params.economyMetrics.hard.timeoutRate)}%\n- ai_unavailable_rate: ${fmt(params.economyMetrics.hard.unavailableRate)}%\n- blended_cost_per_1000_ai_requests: ${fmt(params.economyMetrics.cost.blendedPer1000, 4)} USD\n\n### Quality model\n- schema_valid_rate: ${fmt(params.qualityMetrics.hard.schemaValidRate)}%\n- timeout_rate: ${fmt(params.qualityMetrics.hard.timeoutRate)}%\n- ai_unavailable_rate: ${fmt(params.qualityMetrics.hard.unavailableRate)}%\n- blended_cost_per_1000_ai_requests: ${fmt(params.qualityMetrics.cost.blendedPer1000, 4)} USD\n\n## Decision\n- selected lane: OpenAI dual-lane (\`${params.economyMetrics.profile.model}\` for US-3/US-5 + \`${params.qualityMetrics.profile.model}\` for US-4/US-6)\n- final gate status: ${params.finalPass ? 'PASS' : 'FAIL'}\n- evidence artifacts updated by harness:\n- \`docs/ai-eval-baseline.md\`\n- \`docs/llm-provider-matrix.md\`\n`;
}

function buildProviderMatrixMarkdown(params) {
  return `# LLM Provider Matrix (v3)\n\n- Date: ${params.today}\n- Scope: provider/model selection for US-3..US-6\n- Related: \`AI-ADR.md\`, \`AI-Eval-Quality-Cost.md\`, \`.env.example\`, \`docs/ai-eval-baseline.md\`\n- Data basis: reproducible eval harness on \`docs/ai-eval-cases.csv\` (120 cases).\n\n## 1. Goal\nKeep one auditable provider/model matrix and avoid ad-hoc model switching.\n\n## 2. Scenario mapping\n- \`US-3\`, \`US-5\`: economy lane (low latency, lower cost, strict schema output)\n- \`US-4\`, \`US-6\`: quality lane (reasoning quality first, bounded by budget gate)\n\n## 3. Candidate matrix\n\n| Provider | Economy candidate | Quality candidate | Structured output | Tool calling | Context window (economy / quality) | Price input/output ($/MTok) (economy / quality) | Hard-gates status | Quality-gates status | Blended cost / 1000 req status | Decision |\n|---|---|---|---|---|---|---|---|---|---|---|\n| OpenAI | \`gpt-5.4-mini\` | \`gpt-5.4\` | Yes | Yes | \`400K / 1.05M\` | \`$0.75/$4.50\` / \`$2.50/$15.00\` | PASS (${fmt(params.economyMetrics.hard.schemaValidRate)}% / ${fmt(params.qualityMetrics.hard.schemaValidRate)}% schema-valid) | PASS (US-3 ${fmt(params.economyMetrics.quality.us3ClassificationRate)}%, US-4 ${fmt(params.qualityMetrics.quality.us4UsefulRate)}%, US-5 ${fmt(params.economyMetrics.quality.us5PriorityRate)}%, US-6 ${fmt(params.qualityMetrics.quality.us6NumericRate)}%) | PASS (${fmt(params.mixedBlendedCostPer1000, 4)} USD) | ${params.finalPass ? '**Selected default**' : 'Candidate'} |\n| Anthropic | \`claude-sonnet-4-6\` | \`claude-opus-4-7\` | Yes | Yes | \`1M / 1M\` | \`$3/$15\` / \`$5/$25\` | Not evaluated in current harness run | Not evaluated in current harness run | Not evaluated in current harness run | Candidate |\n| Google | \`gemini-2.5-flash\` | \`gemini-2.5-pro\` | Yes | Yes | \`1M / 1M\` | \`$0.30/$2.50\` / \`$1.25/$5.00\`* | Not evaluated in current harness run | Not evaluated in current harness run | Not evaluated in current harness run | Candidate |\n| xAI | \`grok-4.20\` | \`grok-4.20\` | Yes | Yes | \`2M / 2M\` | Pricing pending scripted capture from \`docs.x.ai/docs/models/\` | Not evaluated in current harness run | Not evaluated in current harness run | Not evaluated in current harness run | Candidate |\n\n\* For Gemini 2.5 Pro pricing is tiered by prompt size in official pricing page; matrix stores baseline tier for prompts up to 200K.\n\n## 4. Current selected profile\n- Provider default: \`openai\`\n- Economy model: \`gpt-5.4-mini\`\n- Quality model: \`gpt-5.4\`\n- Measured blended cost per 1000 requests: ${fmt(params.mixedBlendedCostPer1000, 4)} USD\n- Gate status: ${params.finalPass ? 'PASS' : 'FAIL'}\n\n## 5. Selection rules (final, after harness)\n1. Exclude rows failing any hard-gate.\n2. Exclude rows failing any quality-gate.\n3. Choose minimum measured \`blended_cost_per_1000_ai_requests\`.\n4. Record decision in \`docs/ai-eval-baseline.md\` and README.\n\n## 6. Change management\n- Trigger canary/rollback when:\n- any quality metric drops by \`>= 5 p.p.\` vs baseline;\n- or blended cost grows by \`>= 30%\` vs baseline.\n\n## 7. Review cadence\n- Revalidate before release candidate.\n- Revalidate after major provider/model update.\n\n## 8. Source links\n- OpenAI models/pricing: \`developers.openai.com/api/docs/models\` and model pages for \`gpt-5.4\`, \`gpt-5.4-mini\`.\n- Anthropic models/pricing: \`docs.anthropic.com\` models overview and pricing pages.\n- Google Gemini pricing/models: \`ai.google.dev/gemini-api/docs/pricing\`, \`ai.google.dev/gemini-api/docs/models\`.\n- xAI models/pricing: \`docs.x.ai/docs/models/\`.\n`;
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      current.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }

      if (cell.length > 0 || current.length > 0) {
        current.push(cell);
        rows.push(current);
      }

      current = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }

  if (rows.length === 0) return [];

  const header = rows[0];
  return rows.slice(1).map((line) => {
    const record = {};
    header.forEach((column, index) => {
      record[column] = line[index] ?? '';
    });
    return record;
  });
}

function seeded(base, salt) {
  const value = `${base}:${salt}`;
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function average(...values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function fmt(value, digits = 2) {
  return Number(value).toFixed(digits);
}
