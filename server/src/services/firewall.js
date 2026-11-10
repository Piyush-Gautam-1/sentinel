// server/src/services/firewall.js

const RULES = [
  { id: "override", re: /(ignore|disregard)\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|directions)/i },
  { id: "role_spoof", re: /(you\s+are\s+now|pretend\s+you\s+are|act\s+as\s+if\s+you\s+are)/i },
  { id: "system_leak", re: /(reveal|show|print|output)\s+(your\s+)?(system\s+)?(prompt|instructions)/i },
  { id: "delimiter", re: /(<\|im_start\|>|<\|im_end\|>|\[INST\]|<\/?SYS>|<\/?system>)/i },
  { id: "jailbreak", re: /(do\s+anything\s+now|developer\s+mode|jailbreak)/i },
];

const BLOCK_THRESHOLD = 1;

export function runHeuristics(messages) {
  const text = messages
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  const matched = [];
  for (const rule of RULES) {
    if (rule.re.test(text)) matched.push(rule.id);
  }

  const score = matched.length;
  const verdict = score >= BLOCK_THRESHOLD ? "block" : "allow";

  return { verdict, score, matched };
}