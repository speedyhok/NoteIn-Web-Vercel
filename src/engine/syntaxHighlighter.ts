// NoteIn Syntax Highlighter & Code Block Engine
// Supports zero-dependency tokenization, colorization, and code block formatting

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface CodeDetectionResult {
  isCode: boolean;
  language: string;
  cleanedCode: string;
}

const JS_TS_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'class', 'import', 'export',
  'from', 'default', 'if', 'else', 'switch', 'case', 'break', 'continue',
  'for', 'while', 'do', 'try', 'catch', 'finally', 'throw', 'new', 'typeof',
  'instanceof', 'async', 'await', 'interface', 'type', 'enum', 'implements',
  'extends', 'abstract', 'as', 'readonly', 'private', 'public', 'protected',
  'static', 'void', 'this', 'super'
]);

const PYTHON_KEYWORDS = new Set([
  'def', 'class', 'return', 'import', 'from', 'if', 'elif', 'else',
  'for', 'while', 'try', 'except', 'finally', 'raise', 'with', 'as',
  'pass', 'yield', 'lambda', 'global', 'nonlocal', 'assert', 'async',
  'await', 'self', 'in', 'is', 'not', 'and', 'or'
]);

const SQL_KEYWORDS = new Set([
  'select', 'from', 'where', 'insert', 'into', 'update', 'delete',
  'join', 'left', 'right', 'inner', 'outer', 'on', 'group', 'by',
  'order', 'having', 'limit', 'create', 'table', 'drop', 'alter',
  'view', 'index', 'distinct', 'union', 'all', 'values', 'set'
]);

const LITERALS = new Set([
  'true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'nil', 'NaN', 'Infinity'
]);

/**
 * Detects if a given text string represents code (either markdown fenced or raw code).
 */
export function detectCodeSnippet(rawText: string): CodeDetectionResult {
  if (!rawText || !rawText.trim()) {
    return { isCode: false, language: '', cleanedCode: rawText };
  }

  const trimmed = rawText.trim();

  // 1. Fenced Markdown Code Block (e.g. ```typescript\n...``` or ```\n...```)
  const fencedMatch = trimmed.match(/^```([a-zA-Z0-9_-]*)\r?\n([\s\S]+?)\r?\n?```$/);
  if (fencedMatch) {
    const lang = (fencedMatch[1] || 'code').toLowerCase();
    const code = fencedMatch[2].trim();
    return { isCode: true, language: lang, cleanedCode: code };
  }

  // 2. Check for embedded markdown code blocks
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    const lines = trimmed.split(/\r?\n/);
    const firstLine = lines[0].replace(/^```/, '').trim();
    const codeLines = lines.slice(1, -1);
    return {
      isCode: true,
      language: firstLine || 'code',
      cleanedCode: codeLines.join('\n')
    };
  }

  // 3. JSON Detection
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return { isCode: true, language: 'json', cleanedCode: trimmed };
    } catch {
      // not strict json, proceed
    }
  }

  // 4. HTML / XML Detection
  if (/^<(!DOCTYPE|[a-z0-9-]+)(\s+[^>]*)?>[\s\S]+<\/[a-z0-9-]+>$/i.test(trimmed)) {
    return { isCode: true, language: 'html', cleanedCode: trimmed };
  }

  // 5. Raw Code Detection Heuristics
  const lines = trimmed.split(/\r?\n/);
  if (lines.length >= 2) {
    let jsScore = 0;
    let pyScore = 0;
    let sqlScore = 0;
    let bashScore = 0;
    let syntaxScore = 0;

    // Specific language signature checks
    if (/\b(const|let|var|function|console\.log|=>|===|!==)\b/.test(trimmed)) jsScore += 4;
    if (/\b(def|elif|self\.|import\s+.+\s+from)\b|#\s+/.test(trimmed)) pyScore += 4;
    if (/\bSELECT\s+.+\s+FROM\s+/i.test(trimmed)) sqlScore += 5;
    if (/^\s*(npm|npx|pnpm|yarn|docker|curl|git)\s+[a-z0-9_-]+/m.test(trimmed)) bashScore += 5;

    const words = trimmed.toLowerCase().match(/\b[a-z_][a-z0-9_]*\b/g) || [];
    for (const w of words) {
      if (JS_TS_KEYWORDS.has(w)) jsScore++;
      if (PYTHON_KEYWORDS.has(w)) pyScore++;
      if (SQL_KEYWORDS.has(w)) sqlScore++;
    }

    if (/[{};]/.test(trimmed)) {
      syntaxScore += 2;
      jsScore += 2;
    }
    if (/\(\s*\)\s*=>/.test(trimmed) || /\bfunction\s+[a-zA-Z0-9_]+\s*\(/.test(trimmed)) {
      syntaxScore += 3;
      jsScore += 3;
    }

    // Indented lines check (typical in code)
    const indentedLines = lines.filter((l) => /^\s{2,}|\t/.test(l));
    if (indentedLines.length >= 1) syntaxScore += 2;

    const maxScore = Math.max(jsScore, pyScore, sqlScore, bashScore);
    const totalScore = jsScore + pyScore + sqlScore + bashScore + syntaxScore;

    if (totalScore >= 6 || maxScore >= 4) {
      let detectedLang = 'javascript';
      if (pyScore > jsScore && pyScore > sqlScore && pyScore > bashScore) {
        detectedLang = 'python';
      } else if (sqlScore > jsScore && sqlScore > pyScore) {
        detectedLang = 'sql';
      } else if (bashScore > jsScore) {
        detectedLang = 'bash';
      }
      return { isCode: true, language: detectedLang, cleanedCode: trimmed };
    }
  }

  return { isCode: false, language: '', cleanedCode: rawText };
}

/**
 * Tokenizes and highlights code into rich syntax colored HTML.
 */
export function highlightCodeToHtml(code: string, language: string = 'javascript'): string {
  const lang = (language || 'javascript').toLowerCase();

  // Pick keyword set
  const isPython = lang === 'python' || lang === 'py';
  const isSql = lang === 'sql';
  const keywords = isPython ? PYTHON_KEYWORDS : isSql ? SQL_KEYWORDS : JS_TS_KEYWORDS;

  // Tokenize using regex (Comments, Strings, Numbers, Words, Operators/Punctuation, Whitespace)
  const tokenRegex = /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)|([<>\/={}[\](),;.:+\-*%&|!~^?]+)|(\s+)/gm;

  let bodyHtml = '';
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    const [, comment, str, num, word, punct, ws] = match;

    if (comment) {
      bodyHtml += `<span style="color: #8b949e; font-style: italic;">${escapeHtml(comment)}</span>`;
    } else if (str) {
      bodyHtml += `<span style="color: #7ee787;">${escapeHtml(str)}</span>`;
    } else if (num) {
      bodyHtml += `<span style="color: #79c0ff; font-weight: 500;">${escapeHtml(num)}</span>`;
    } else if (word) {
      const lower = word.toLowerCase();
      if (keywords.has(lower)) {
        bodyHtml += `<span style="color: #ff7b72; font-weight: 600;">${escapeHtml(word)}</span>`;
      } else if (LITERALS.has(word)) {
        bodyHtml += `<span style="color: #ffa657; font-weight: 600;">${escapeHtml(word)}</span>`;
      } else if (code[tokenRegex.lastIndex] === '(') {
        // Function call
        bodyHtml += `<span style="color: #d2a8ff; font-weight: 500;">${escapeHtml(word)}</span>`;
      } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) {
        // Class or Interface or Type
        bodyHtml += `<span style="color: #ffa657; font-weight: 500;">${escapeHtml(word)}</span>`;
      } else {
        bodyHtml += escapeHtml(word);
      }
    } else if (punct) {
      bodyHtml += `<span style="color: #c9d1d9;">${escapeHtml(punct)}</span>`;
    } else if (ws) {
      bodyHtml += ws;
    }
  }

  // Display label for badge
  const displayLang = lang ? lang.toUpperCase() : 'CODE';

  // Responsive rich developer code container
  return `
<div class="notein-code-card" data-code-block="true" style="margin: 8px 0; background-color: #0d1117; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.25); font-family: 'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace; font-size: 13px; text-align: left; line-height: 1.6;">
  <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background-color: #161b22; border-bottom: 1px solid #21262d; font-size: 11px; color: #8b949e; user-select: none;">
    <div style="display: flex; align-items: center; gap: 6px;">
      <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background-color: #ff5f56;"></span>
      <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background-color: #ffbd2e;"></span>
      <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background-color: #27c93f;"></span>
    </div>
    <span style="font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; color: #79c0ff;">${displayLang}</span>
  </div>
  <pre style="padding: 12px 14px; margin: 0; overflow-x: auto; white-space: pre; color: #e6edf3; background: transparent; border: none; font-family: inherit; font-size: inherit; line-height: inherit;"><code>${bodyHtml || escapeHtml(code)}</code></pre>
</div>`.trim();
}
