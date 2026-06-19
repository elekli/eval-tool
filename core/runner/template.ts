// Prompt-template helpers shared by the runner and run-start validation.
// Framework-agnostic; no Next imports.

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

/** Distinct {{placeholder}} names referenced by a template, in first-seen order. */
export function extractPlaceholders(tpl: string): string[] {
  const names = new Set<string>();
  for (const m of tpl.matchAll(PLACEHOLDER_RE)) {
    names.add(m[1]!);
  }
  return [...names];
}

/** Raised when a template references a variable absent from the supplied vars. */
export class MissingTemplateVarError extends Error {
  name = 'MissingTemplateVarError' as const;
  constructor(
    public readonly missing: string[],
    public readonly available: string[],
  ) {
    super(
      `User prompt template references variable(s) not present in the test case: ` +
        `${missing.join(', ')}. Available: ${available.length ? available.join(', ') : '(none)'}.`,
    );
  }
}

/**
 * Substitute {{var}} placeholders with values from `vars`.
 *
 * Throws MissingTemplateVarError when a referenced variable is absent — we do NOT
 * silently emit an empty string (Prime Directive: zero silent failures). A present
 * key with an empty-string value is legitimate user data and is substituted as-is;
 * only a *missing* key is an error, so we test `key in vars`, not truthiness.
 */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  const missing = extractPlaceholders(tpl).filter((k) => !(k in vars));
  if (missing.length > 0) {
    throw new MissingTemplateVarError(missing, Object.keys(vars));
  }
  return tpl.replace(PLACEHOLDER_RE, (_, key: string) => vars[key]!);
}
