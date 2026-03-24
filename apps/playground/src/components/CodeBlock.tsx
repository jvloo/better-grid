import { useState, useCallback, useRef } from 'react';

/**
 * Collapsible code block with copy button and basic syntax highlighting.
 * Inspired by MUI's compact toolbar pattern — collapsed by default.
 */
export function CodeBlock({ code, title = 'Quick Start', language = 'tsx', defaultOpen = false }: {
  code: string;
  title?: string;
  language?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code.trim()).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      {/* Compact toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
      }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            border: '1px solid #e0e0e0',
            borderRadius: 6,
            background: open ? '#f0f4ff' : '#fff',
            color: open ? '#1a73e8' : '#555',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!open) e.currentTarget.style.background = '#f8f9fa'; }}
          onMouseLeave={e => { if (!open) e.currentTarget.style.background = '#fff'; }}
        >
          <span style={{ fontSize: 14, fontFamily: 'monospace' }}>&lt;/&gt;</span>
          {open ? 'Hide Code' : 'Show Code'}
        </button>

        {open && (
          <button
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              border: '1px solid #e0e0e0',
              borderRadius: 6,
              background: copied ? '#e8f5e9' : '#fff',
              color: copied ? '#2e7d32' : '#555',
              cursor: 'pointer',
              fontSize: 12,
              transition: 'all 0.15s',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}

        {open && title && (
          <span style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
          </span>
        )}
      </div>

      {/* Code panel */}
      {open && (
        <pre style={{
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: 16,
          borderRadius: 8,
          overflow: 'auto',
          fontSize: 13,
          lineHeight: 1.6,
          maxHeight: 440,
          margin: '4px 0 0',
          fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
        }}>
          <code data-language={language}>{highlightSyntax(code.trim())}</code>
        </pre>
      )}
    </div>
  );
}

/** Basic syntax highlighting — no dependency needed */
function highlightSyntax(code: string): (string | JSX.Element)[] {
  const lines = code.split('\n');
  const result: (string | JSX.Element)[] = [];

  let key = 0;
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) result.push('\n');
    const line = lines[i];

    // Simple token-based highlighting
    const tokens = tokenize(line);
    for (const token of tokens) {
      if (token.type === 'text') {
        result.push(token.value);
      } else {
        result.push(
          <span key={key++} style={{ color: TOKEN_COLORS[token.type] || '#d4d4d4' }}>
            {token.value}
          </span>
        );
      }
    }
  }

  return result;
}

type TokenType = 'keyword' | 'string' | 'comment' | 'number' | 'tag' | 'attr' | 'punct' | 'type' | 'text';

const TOKEN_COLORS: Record<string, string> = {
  keyword: '#c586c0',   // purple
  string: '#ce9178',    // orange
  comment: '#6a9955',   // green
  number: '#b5cea8',    // light green
  tag: '#569cd6',       // blue
  attr: '#9cdcfe',      // light blue
  punct: '#808080',     // gray
  type: '#4ec9b0',      // teal
};

const KEYWORDS = new Set([
  'import', 'from', 'export', 'const', 'let', 'var', 'function', 'return',
  'if', 'else', 'for', 'while', 'new', 'true', 'false', 'null', 'undefined',
  'typeof', 'instanceof', 'async', 'await', 'class', 'extends', 'interface',
  'type', 'enum', 'default', 'switch', 'case', 'break', 'continue', 'throw',
  'try', 'catch', 'finally', 'yield', 'of', 'in', 'as',
]);

const TYPES = new Set([
  'string', 'number', 'boolean', 'void', 'any', 'never', 'unknown', 'object',
  'Array', 'Record', 'Promise', 'Partial', 'Required', 'Readonly',
]);

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Comments
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ type: 'comment', value: line.slice(i) });
      break;
    }

    // Strings
    if (line[i] === "'" || line[i] === '"' || line[i] === '`') {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++;
        j++;
      }
      tokens.push({ type: 'string', value: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // JSX tags
    if (line[i] === '<' && /[A-Z/]/.test(line[i + 1] || '')) {
      let j = i + 1;
      if (line[j] === '/') j++;
      const start = j;
      while (j < line.length && /[a-zA-Z.]/.test(line[j])) j++;
      if (j > start) {
        tokens.push({ type: 'punct', value: line.slice(i, i + (line[i + 1] === '/' ? 2 : 1)) });
        tokens.push({ type: 'tag', value: line.slice(line[i + 1] === '/' ? i + 2 : i + 1, j) });
        i = j;
        continue;
      }
    }

    // Numbers
    if (/[0-9]/.test(line[i]) && (i === 0 || !/[a-zA-Z_$]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[0-9._eExXa-fA-F]/.test(line[j])) j++;
      tokens.push({ type: 'number', value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Words (keywords, types, identifiers)
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (TYPES.has(word)) {
        tokens.push({ type: 'type', value: word });
      } else if (word[0] >= 'A' && word[0] <= 'Z') {
        tokens.push({ type: 'tag', value: word });
      } else {
        tokens.push({ type: 'text', value: word });
      }
      i = j;
      continue;
    }

    // Punctuation
    if (/[{}()\[\];:,=<>!&|?+\-*/.]/.test(line[i])) {
      tokens.push({ type: 'punct', value: line[i] });
      i++;
      continue;
    }

    // Whitespace and other
    tokens.push({ type: 'text', value: line[i] });
    i++;
  }

  return tokens;
}
