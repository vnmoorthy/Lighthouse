/**
 * LLM client abstraction.
 *
 * Two providers:
 *   - Anthropic (default): uses tool-use to coerce structured JSON output.
 *   - Ollama (local): uses the `format: "json"` option and prompts the model
 *     to return JSON in the system instruction. We then parse + Zod-validate.
 *
 * Callers always go through `runStructured()` which takes a Zod schema and
 * returns an inferred TS object — never `any`.
 */
import Anthropic from '@anthropic-ai/sdk';
import { z, type ZodTypeAny, type infer as ZInfer } from 'zod';
import { config } from '../config.js';
import { log } from '../logger.js';

export class LLMError extends Error {}

export interface StructuredArgs<T extends ZodTypeAny> {
  /** Hand-written system prompt; describe the task. */
  system: string;
  /** User-turn content. Plain string or array of text blocks. */
  user: string;
  /** The expected JSON shape. Must be an object schema. */
  schema: T;
  /** Logical tool name, used for both Anthropic tool-use and logging. */
  toolName: string;
  /** Plain-English description of what the tool does, for the model. */
  toolDescription: string;
  /** Per-call timeout in ms. Defaults to 60s. */
  timeoutMs?: number;
  /** Override of LLM model id. */
  model?: string;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface LLMResult<T> {
  data: T;
  usage: LLMUsage;
}

/** A Zod schema → JSON Schema converter that handles the subset we use. */
function zodToJSONSchema(schema: ZodTypeAny): Record<string, unknown> {
  // We deliberately implement the subset we need (object / string / number /
  // boolean / array / enum / nullable / optional) instead of pulling in a
  // dependency. Keeps the package tiny.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def as Record<string, unknown> & { typeName: string };

  switch (def.typeName) {
    case 'ZodString': {
      const checks = (def.checks as { kind: string; value?: number }[] | undefined) ?? [];
      const out: Record<string, unknown> = { type: 'string' };
      for (const c of checks) {
        if (c.kind === 'min' && typeof c.value === 'number') out.minLength = c.value;
        if (c.kind === 'max' && typeof c.value === 'number') out.maxLength = c.value;
      }
      return out;
    }
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodLiteral':
      return { const: def.value as unknown };
    case 'ZodEnum':
      return { type: 'string', enum: def.values as string[] };
    case 'ZodArray':
      return { type: 'array', items: zodToJSONSchema(def.type as ZodTypeAny) };
    case 'ZodObject': {
      const shape = (def.shape as () => Record<string, ZodTypeAny>)();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = zodToJSONSchema(v);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inner = (v as any)._def.typeName as string;
        if (inner !== 'ZodOptional' && inner !== 'ZodDefault') required.push(k);
      }
      return { type: 'object', properties, required, additionalProperties: false };
    }
    case 'ZodOptional':
      return zodToJSONSchema(def.innerType as ZodTypeAny);
    case 'ZodDefault':
      return zodToJSONSchema(def.innerType as ZodTypeAny);
    case 'ZodNullable': {
      const inner = zodToJSONSchema(def.innerType as ZodTypeAny);
      const t = inner.type;
      if (typeof t === 'string') return { ...inner, type: [t, 'null'] };
      return { anyOf: [inner, { type: 'null' }] };
    }
    case 'ZodUnion': {
      const opts = def.options as ZodTypeAny[];
      return { anyOf: opts.map((o) => zodToJSONSchema(o)) };
    }
    default:
      // Conservative fallback: any. The model will still succeed; schema-based
      // validation enforces correctness on our side.
      return {};
  }
}

// --- Provider: Anthropic ----------------------------------------------------

let _anthropic: Anthropic | null = null;
function anthropicClient(): Anthropic {
  if (_anthropic) return _anthropic;
  if (!config.llm.anthropic.apiKey) {
    throw new LLMError('Missing ANTHROPIC_API_KEY in .env (or set LLM_PROVIDER=ollama).');
  }
  _anthropic = new Anthropic({ apiKey: config.llm.anthropic.apiKey });
  return _anthropic;
}

async function runStructuredAnthropic<T extends ZodTypeAny>(
  args: StructuredArgs<T>,
): Promise<LLMResult<ZInfer<T>>> {
  const client = anthropicClient();
  const inputSchema = zodToJSONSchema(args.schema) as Record<string, unknown>;
  const model = args.model ?? config.llm.anthropic.model;

  const res = await client.messages.create(
    {
      model,
      max_tokens: 4096,
      system: args.system,
      tools: [
        {
          name: args.toolName,
          description: args.toolDescription,
          input_schema: inputSchema as Anthropic.Messages.Tool['input_schema'],
        },
      ],
      tool_choice: { type: 'tool', name: args.toolName },
      messages: [{ role: 'user', content: args.user }],
    },
    { timeout: args.timeoutMs ?? 60_000 },
  );

  // Find the tool_use block.
  const toolBlock = res.content.find((b) => b.type === 'tool_use') as
    | Anthropic.Messages.ToolUseBlock
    | undefined;
  if (!toolBlock) throw new LLMError('Model did not invoke the tool.');
  const parsed = args.schema.safeParse(toolBlock.input);
  if (!parsed.success) {
    log.warn('LLM output failed schema validation', { issues: parsed.error.issues });
    throw new LLMError(`Schema validation failed: ${parsed.error.message}`);
  }
  return {
    data: parsed.data,
    usage: {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      model,
    },
  };
}

// --- Provider: Ollama -------------------------------------------------------

async function runStructuredOllama<T extends ZodTypeAny>(
  args: StructuredArgs<T>,
): Promise<LLMResult<ZInfer<T>>> {
  const url = `${config.llm.ollama.baseUrl.replace(/\/$/, '')}/api/chat`;
  const model = args.model ?? config.llm.ollama.model;
  const sys = `${args.system}

You MUST respond with a single JSON object that matches this schema:
${JSON.stringify(zodToJSONSchema(args.schema))}

Do not include any prose, code fences, or explanation. Output JSON only.`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), args.timeoutMs ?? 60_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        format: 'json',
        stream: false,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: args.user },
        ],
      }),
    });
    if (!res.ok) throw new LLMError(`Ollama error ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const content = json.message?.content ?? '';
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      throw new LLMError('Ollama returned non-JSON output.');
    }
    const parsed = args.schema.safeParse(parsedJson);
    if (!parsed.success) throw new LLMError(`Schema validation failed: ${parsed.error.message}`);
    return {
      data: parsed.data,
      usage: {
        inputTokens: json.prompt_eval_count ?? 0,
        outputTokens: json.eval_count ?? 0,
        model,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

// --- Public entry point ----------------------------------------------------

export async function runStructured<T extends ZodTypeAny>(
  args: StructuredArgs<T>,
): Promise<LLMResult<ZInfer<T>>> {
  if (config.llm.provider === 'ollama') return runStructuredOllama(args);
  return runStructuredAnthropic(args);
}

/** Convenience: re-export Zod for caller schemas. */
export { z };
