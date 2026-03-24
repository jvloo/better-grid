/** Lightweight code block — no external syntax highlighting dependency */
export function CodeBlock({ code, language = 'tsx' }: { code: string; language?: string }) {
  return (
    <details style={{ marginBottom: 16 }}>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 13,
          color: '#1a73e8',
          userSelect: 'none',
          padding: '4px 0',
        }}
      >
        Show code
      </summary>
      <pre
        style={{
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: 16,
          borderRadius: 8,
          overflow: 'auto',
          fontSize: 13,
          lineHeight: 1.5,
          maxHeight: 400,
          margin: '8px 0 0',
        }}
      >
        <code data-language={language}>{code.trim()}</code>
      </pre>
    </details>
  );
}
