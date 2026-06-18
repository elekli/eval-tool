# TODOS

## Code refinements (deferred from review)

- **job-runner — judge cost dropped when runner returns no usage**(Chunk 6 review minor):`core/job/job-runner.ts` 的 `mergedUsage` 在 `record.usage` falsy 時設為 `undefined`,即使 judge 有成本也一起丟掉。真實 `OpenRouterRunner` 一定回 usage,故 v1 不觸發;但 usage-less 的 runner(或未來 harness adapter)會少算 judge 成本。修法:`totalCostUsd > 0` 或 judge 有跑時也構造 `mergedUsage`。另 `markRunError` 的 inline 型別應改用 `Run`。
- **judge.ts — ambiguous error when `choices` absent**(Chunk 4 review, Important-but-non-blocking):`core/judge/judge.ts` 在 `response.choices` 缺失/空陣列時,落入 `JudgeParseError('response had no content')`,訊息誤導(真因是 API 回應結構壞掉)。修法:在取 content 前加 `if (!response.choices?.length) throw new JudgeParseError('response missing choices array')`。不影響正確性,純診斷清晰度。
- **tooluse-metrics — NaN on empty calls**(Chunk 3 review minor):`argumentSchemaConformanceRate`(及 `toolSelectionHitRate` 若同時給 `expectedTool`)在 `calls: []` 時是 `0/0 = NaN`。實務上呼叫層(job/summary)會擋空 calls,但 raw 函式有未文件化的 NaN surface。修法:空 calls 時回 `0` 或省略該欄位。順帶補測 `toolSchema` 無 `expectedTool` 的路徑、修正一處測試註解字串。
- **OpenRouter client — malformed 2xx body is retried**(Chunk 2 code-quality minor):`core/runner/openrouter-client.ts` 在 200 回應但 `response.json()` 解析失敗時,落入泛用 catch 被歸類成 network error → 重試(對非冪等 LLM 呼叫重送)。罕見且最終會 loudly 失敗,非阻擋。修法:對 2xx-壞body 給一個具名的 `ParseError`(不重試),符合「every error has a name」。

## Deferred tasks

- **Port pair-watch → herdr**(獨立小任務,需自己的 spec)
  - 現況:`~/.claude/skills/pair-watch` 寫死綁 tmux;elek 環境已改用 herdr(`HERDR_ENV=1`,`HERDR_PANE_ID`,socket API)。
  - 可行性:herdr 暴露 `HERDR_PANE_ID`(等同 `$TMUX_PANE`)與 `herdr pane split/send-keys/read/close/report-metadata`,對得上 pair-watch 用到的 tmux 動作。
  - 要改的三處:啟動(`herdr pane split` 開 watcher pane + 擷取新 pane id)、DRIFT-DIR 彈窗(herdr 無瞬時 overlay → 降級為 FEEDBACK 檔 + 狀態列)、注入路徑的 pane 狀態讀取/`send-keys`。
  - 安全敏感:fail-closed 注入守則與唯讀 verifier 設定要保留,值得走 spec → plan → review,不要直接 hack 共用 skill 腳本。
