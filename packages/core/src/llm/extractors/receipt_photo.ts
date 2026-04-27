/**
 * Receipt photo extractor.
 *
 * Send a base64-encoded JPEG/PNG of a paper receipt and get back the same
 * structured ReceiptExtraction shape that the email extractor produces.
 * Uses the Anthropic Messages API's vision input — the model can read
 * the receipt directly without a separate OCR pass.
 *
 * Falls back to a text-only path on Ollama (since most local Ollama
 * models don't have vision yet); the caller passes a pre-OCR'd
 * `transcribed_text` in that case.
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';
import {
  ReceiptExtractionSchema,
  type ReceiptResult,
} from './receipt.js';
import { LLMError } from '../client.js';

const PHOTO_SYSTEM = `You are an extraction model for a personal-finance app.

Given an image of a paper receipt (or a screenshot of a digital one),
extract the same structured fields you would for an email receipt:
merchant, total in cents, currency, transaction date, order number,
payment method, and line items if visible.

Rules:
1. Money is always integer cents.
2. Currency is the ISO 4217 code. Default to USD only if you have a
   strong prior; otherwise emit "UNK".
3. Dates are YYYY-MM-DD. If only month/day visible, use the current year.
4. NEVER hallucinate — leave fields null if you can't read them.
5. If the image is unreadable or clearly not a receipt, set
   is_receipt=false and confidence ≤ 0.2.`;

export async function extractReceiptFromImage(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
): Promise<ReceiptResult> {
  if (config.llm.provider !== 'anthropic') {
    throw new LLMError('Photo OCR requires LLM_PROVIDER=anthropic (vision support).');
  }
  if (!config.llm.anthropic.apiKey) {
    throw new LLMError('Missing ANTHROPIC_API_KEY in .env.');
  }
  const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });
  const model = config.llm.anthropic.model;

  // We use tool-use the same way as the email extractor so the response
  // shape is identical. The image goes in as a vision input block.
  const inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      is_receipt: { type: 'boolean' },
      merchant_name: { type: 'string' },
      total_amount_cents: { type: 'number' },
      currency: { type: 'string' },
      transaction_date: { type: 'string' },
      order_number: { type: ['string', 'null'] },
      payment_method: { type: ['string', 'null'] },
      line_items: {
        type: ['array', 'null'],
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: ['number', 'null'] },
            unit_price_cents: { type: ['number', 'null'] },
            total_cents: { type: ['number', 'null'] },
          },
          required: ['description', 'quantity', 'unit_price_cents', 'total_cents'],
          additionalProperties: false,
        },
      },
      confidence: { type: 'number' },
      notes: { type: ['string', 'null'] },
    },
    required: [
      'is_receipt',
      'merchant_name',
      'total_amount_cents',
      'currency',
      'transaction_date',
      'order_number',
      'payment_method',
      'line_items',
      'confidence',
      'notes',
    ],
    additionalProperties: false,
  };

  const res = await client.messages.create(
    {
      model,
      max_tokens: 2048,
      system: PHOTO_SYSTEM,
      tools: [
        {
          name: 'record_receipt_from_image',
          description: 'Record the structured fields read from a receipt image.',
          input_schema: inputSchema as Anthropic.Messages.Tool['input_schema'],
        },
      ],
      tool_choice: { type: 'tool', name: 'record_receipt_from_image' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            { type: 'text', text: 'Extract the receipt details into the tool.' },
          ],
        },
      ],
    },
    { timeout: 60_000 },
  );

  const toolBlock = res.content.find((b) => b.type === 'tool_use') as
    | Anthropic.Messages.ToolUseBlock
    | undefined;
  if (!toolBlock) throw new LLMError('Vision model did not invoke the tool.');
  const parsed = ReceiptExtractionSchema.safeParse(toolBlock.input);
  if (!parsed.success) throw new LLMError(`Schema validation failed: ${parsed.error.message}`);

  return { extraction: parsed.data, model };
}
