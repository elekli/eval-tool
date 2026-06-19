# Eval Tool

Local LLM evaluation harness. Runs repeatable evals against OpenRouter models, scores outputs with a judge model, and surfaces results in a summary-first dashboard.

## Setup

```bash
pnpm install
export OPENROUTER_API_KEY=sk-or-...
# optional: default is ./eval.db in the working directory
export EVAL_DB_PATH=/path/to/eval.db
pnpm dev
```

Open `http://localhost:3000`.

## Eval Types

### Behavior (`type: "behavior"`)

The model produces free-form text. Each case is run N times (configurable repeats). An optional judge model scores each output 1–5 against a rubric you provide. The dashboard shows mean score, std dev, and distinct output count per case — std dev > 1.0 flags a case as an outlier.

### Tool Use (`type: "tool_use"`)

The model must call one of the virtual tools you define (JSON Schema). Each repeat is scored on:

- **Tool selection entropy** — lower is more consistent. > 0.5 flags as outlier.
- **Hit rate** — fraction of repeats that called the expected tool.
- **Argument schema conformance rate** — fraction of calls whose arguments validated against the schema.

## Example scenario: note naming

You have a note-taking assistant that must call `rename_note(title: string)`. You define a `tool_use` suite with the `rename_note` tool, write a prompt template that presents a note's body as `{{note_body}}`, generate 20 test notes across English and Japanese, set 5 repeats, and run. The dashboard immediately shows which notes produce high-entropy tool calls (model is inconsistent about naming) versus low-entropy ones (model is confident). Drill into a specific note to see each repeat's tool call side-by-side with parsed arguments.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Suite list + create link |
| `/suites/new` | Create a suite |
| `/suites/:id` | Edit suite, manage datasets, launch runs |
| `/runs/:id` | Summary dashboard + drill-down |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | (required) | Your OpenRouter API key |
| `EVAL_DB_PATH` | `./eval.db` | Path to SQLite database |
| `EVAL_SYNC_RUN` | `0` | Set to `1` to run evals synchronously (useful in tests) |
