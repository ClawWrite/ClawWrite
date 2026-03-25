import { GoogleGenerativeAI } from '@google/generative-ai';
import { store, getApiKey } from './settings.js';

// ─────────────────────────────────────────────────────────────
// Built-in preset definitions
// These are hardcoded — users can ADD custom presets but cannot
// modify or delete the built-in ones.
// ─────────────────────────────────────────────────────────────

export interface PresetAction {
  id: string;
  label: string;
  prompt: string;
  isBuiltIn: true;
}

export interface CustomPresetAction {
  id: string;
  label: string;
  prompt: string;
  isBuiltIn: false;
}

export type AnyPreset = PresetAction | CustomPresetAction;

export const BUILT_IN_PRESETS: PresetAction[] = [
  {
    id: 'improve',
    label: '✨ Improve',
    isBuiltIn: true,
    prompt: 'Improve the writing quality, clarity, and flow. Fix any awkward phrasing. Return only the improved text, nothing else.'
  },
  {
    id: 'formal',
    label: '📋 Make Formal',
    isBuiltIn: true,
    prompt: 'Rewrite in a professional, formal tone suitable for business communication. Return only the rewritten text, nothing else.'
  },
  {
    id: 'casual',
    label: '😊 Make Casual',
    isBuiltIn: true,
    prompt: 'Rewrite in a friendly, conversational, approachable tone. Return only the rewritten text, nothing else.'
  },
  {
    id: 'shorten',
    label: '✂️ Shorten',
    isBuiltIn: true,
    prompt: 'Make this significantly more concise without losing the key information. Cut unnecessary words and filler. Return only the shortened text, nothing else.'
  },
  {
    id: 'expand',
    label: '📝 Expand',
    isBuiltIn: true,
    prompt: 'Expand this with more relevant detail, context, and supporting points. Keep it coherent and useful. Return only the expanded text, nothing else.'
  },
  {
    id: 'grammar',
    label: '✅ Fix Grammar',
    isBuiltIn: true,
    prompt: 'Fix all grammar, spelling, and punctuation errors. Do not change the style or meaning. Return only the corrected text, nothing else.'
  },
  {
    id: 'bullets',
    label: '• Bullet Points',
    isBuiltIn: true,
    prompt: 'Convert this into clear, concise bullet points. Each bullet should be a distinct point. Return only the bullet points, nothing else.'
  },
  {
    id: 'summarise',
    label: '📌 Summarise',
    isBuiltIn: true,
    prompt: 'Summarise this in 1–2 sentences capturing the key point. Return only the summary, nothing else.'
  },
  {
    id: 'mom',
    label: '📝 Minutes Of Meeting',
    isBuiltIn: true,
    prompt: 'Transform this transcript or notes into professional, structured Minutes of Meeting. Include sections for: 1. Overview/Objective, 2. Key Discussion Points, 3. Action Items (with owners if specified), and 4. Next Steps. Use clear headings and bullet points. Return only the MOM, nothing else.'
  },
  {
    id: 'enhance-prompt',
    label: '🧠 Enhance Prompt',
    isBuiltIn: true,
    prompt: 'Act as an elite AI prompt engineer. Take this rough instruction or question and rewrite it into a highly detailed, clear, and structured prompt optimized for a Large Language Model. Ensure it establishes explicit context, specifies constraints and desired formatting, and eliminates ambiguity. Return only the final enhanced prompt, nothing else.'
  }
];

// ─────────────────────────────────────────────────────────────
// System prompt — the most important instruction
// ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a writing assistant embedded in a desktop app.
The user will provide text and an instruction for how to rewrite it.

CRITICAL RULES:
1. Return ONLY the rewritten text. Nothing else.
2. No preamble like "Here is the improved text:" or "Sure, here's..."
3. No explanation of what you changed.
4. No quotes around your output.
5. If the instruction asks for bullet points, use markdown "- " syntax.
6. Preserve the original language and any technical terms unless the instruction says otherwise.
7. If the text is very short (under 10 words), still fulfill the instruction faithfully.
8. Never add sign-offs, greetings, or closings unless they were in the original text.`;

// ─────────────────────────────────────────────────────────────
// Rewrite function
// ─────────────────────────────────────────────────────────────

export async function rewriteText(
  sourceText: string,
  instruction: string
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Right-click the tray icon → Settings to add your key.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: store.get('geminiModel'),
    systemInstruction: SYSTEM_PROMPT,
  });

  const prompt = `INSTRUCTION: ${instruction}\n\nTEXT TO REWRITE:\n${sourceText}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (!text) throw new Error('Gemini returned an empty response. Please try again.');
  return text;
}

// ─────────────────────────────────────────────────────────────
// Returns all presets: built-in first, then user custom presets
// ─────────────────────────────────────────────────────────────

export function getAllPresets(): AnyPreset[] {
  const customPresets = store.get('customPresets').map(p => ({
    ...p,
    isBuiltIn: false as const
  }));
  return [...BUILT_IN_PRESETS, ...customPresets];
}
