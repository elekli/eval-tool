# eval-tool 設計文件(v1)

> 狀態:設計草案,待 spec review。
> 日期:2026-06-17。
> 工作名稱:eval-tool(本機 web app)。

## 1. 目的與背景

一個 **OpenRouter 原生、本機 web 的 LLM eval 工具**,專注兩種 one-shot 評測,所有上下文都在提示詞裡給:

1. **行為 eval(behavior)** — 測某個 prompt/agent 對輸入的 one-shot 行為與回饋。例:一個「自動建議筆記名稱」的 system prompt,用 `openai/gpt-4o-mini`,給一批(可由規則生成的)多語系文章,逐筆檢視「測資 → 模型輸出」,並以**第二個模型(LLM-as-judge)對輸出給分數與評語**,與輸出並排呈現。
2. **工具選用 eval(tool_use,Tier 0 model 層)** — 給模型一組**虛擬工具定義**(JSON schema,agent 看到的那層,不真執行)+ 提示詞,觀察模型選哪個工具、帶什麼參數,並**跑 N 次量化一致性**。

### 研究背景結論(摘)

- promptfoo 等成熟工具覆蓋「LLM-judge + 對比表」約 90%,但:UX 偏紅隊/斷言、無「summary-first→drill-down」、**無一致性量化**、**無 prompt 規則生成測資**。這三塊(尤其同筆跑 N 次算 variance)是**開源空白**。
- tool_use 跨 harness 驅動(Claude Code/Cursor 等)工程量大、散佈需自備環境;**v1 只做 Tier 0 model 層**,但架構預留 harness adapter seam。
- 後端統一走 OpenRouter(OpenAI 相容格式),tool calling 與 structured output 跨模型可用;部分跨模型差異需實作前以 fixture 驗證(見 §11)。

## 2. 目標與非目標

### v1 目標
- 兩種 eval 型別共用同一套核心(define → dataset → run×N → judge/metrics → summary→drill-down)。
- LLM-as-judge 為一等公民:中性的「分數 + 評語」,與輸出並排,**非 pass/fail**;可關閉。
- prompt 規則生成測資:表單式(語系/筆數/長度/主題/補充)→ structured output → 可預覽/編輯/重生。
- 一致性量化:tool_use 用 entropy/schema 合規;behavior 用 judge 分數 mean±std + 相異輸出計數。
- summary-first → drill-down 的瀏覽,30+ 筆不必逐格捲。
- 零靜默失敗:單筆錯誤以 `error` 狀態呈現,不吞;retry+backoff;成本/token 呈現。

### 非目標(v1 明確砍掉)
- Tier 1+ 真實 harness 驅動(Claude Code/Codex/opencode…)——**只留 Runner seam**。
- 語意 embedding 一致性叢集——列 v-next。
- 多租戶 / 託管 / 帳號 / 計費——**只埋 seam**(見 §5)。
- 紅隊對抗測試。

## 3. 技術棧

- TypeScript、pnpm。
- **Next.js(App Router)**:前後端一體,`pnpm dev` 即起;route handlers 提供 API 與 SSE。
- React + 一個圖表庫(summary 視覺化)。
- **SQLite(`better-sqlite3`)**,走 repository 介面(可換 Postgres)。
- OpenRouter:用 `openai` SDK 指向 OpenRouter base URL(最穩;不採用未證實的專屬 SDK)。tool calling 用 `tools`;測資生成用 structured output(`response_format: json_schema`)。
- **`core/` 不 import 任何 Next 相依** → 可獨立單測、日後可抽成獨立服務。

## 4. 架構

```
┌─────────────────────────────────────────────────────────┐
│  前端 (React)  summary 儀表板 → drill-down 單筆檢視         │
└───────────────┬─────────────────────────────────────────┘
                │ HTTP / SSE(跑 eval 時串流進度)
┌───────────────┴─────────────────────────────────────────┐
│  Web 層 (Next.js route handlers)                          │
├──────────────────────────────────────────────────────────┤
│  core/(純 TS,無框架依賴)                                 │
│   ├─ Runner 介面 ──► OpenRouterRunner (v1)                 │
│   │                  └─[seam] MockMcpHarnessRunner (日後)  │
│   ├─ DatasetGenerator(prompt 規則 → 測資)                │
│   ├─ Judge(LLM-as-judge,評語+分數)                      │
│   ├─ Metrics(entropy / schema 合規 / 分數 variance)       │
│   └─ JobRunner(消化 run,逐筆寫 result)                  │
├──────────────────────────────────────────────────────────┤
│  storage(repository 介面)── SQLiteRepo (v1)              │
└──────────────────────────────────────────────────────────┘
```

## 5. 四個 seam(便宜的保險)

v1 不實作未來功能,只確保介面切在對的地方。

| Seam | v1 做法 | 解鎖 |
|---|---|---|
| 儲存 interface | `Repository` 介面,`SQLiteRepo` 實作 | 換 Postgres |
| eval = 持久化 job | 執行狀態寫 DB(`queued/running/done/error`),不綁 request;SSE 只讀進度 | 接 job queue + worker |
| `owner_id` 欄位 | 每筆 Suite/Run/Dataset 帶 `owner_id`,v1 固定單值 `local` | 加 auth + 多租戶過濾 |
| Runner 介面 | `OpenRouterRunner` | 接 Tier 1 `MockMcpHarnessRunner` |

## 6. 領域模型

```
Suite(type: behavior | tool_use)
  ├─ target:    model、systemPrompt、userPromptTemplate、temperature
  │             (tool_use 時) tools: VirtualToolDef[](JSON schema)
  ├─ judge:     { enabled, model, rubric } | null
  └─ runConfig: { nRepeats }

Dataset(source: manual | generated)
  ├─ genSpec?:  { languages[], countPerLang, lengthWords, topic, extra }
  └─ TestCase[]: { vars, expected? }   // expected 供 ground-truth(預期工具/參數)

Run: { suiteId, datasetId, status, nRepeats, startedAt, finishedAt, error? }
  └─ Result(每個 TestCase × repeat): {
        status, outputText? | toolCalls?, judgeVerdict?, metrics?, usage?, error?
     }

Summary(對一個 Run rollup): 分數分布、一致性指標、異常筆、成本/token
```

### 資料表(SQLite)
- `suites(id, owner_id, name, type, target_config, judge_config, run_config, created_at)`
- `datasets(id, owner_id, name, source, gen_spec, created_at)`
- `test_cases(id, dataset_id, vars, expected, created_at)`
- `runs(id, owner_id, suite_id, dataset_id, status, n_repeats, started_at, finished_at, error)`
- `results(id, run_id, test_case_id, repeat_index, status, output_text, tool_calls, judge_verdict, metrics, usage, error, created_at)`

JSON 欄位以 TEXT 存。**`Summary` 不落表,為讀時對 `results` 計算**(v1 單機資料量小,計算成本可忽略)。

## 7. 共用核心:Runner 介面

```ts
interface Runner {
  run(target: TargetConfig, testCase: TestCase): Promise<ExecutionRecord>;
}
type TargetConfig = {
  model: string;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature?: number;
  tools?: VirtualToolDef[];   // 選填;僅 tool_use 型別使用 → 一個介面服務兩型
};
type ExecutionRecord = {
  text?: string;
  toolCalls?: ToolCall[];     // { name, argumentsRaw, argumentsParsed? }
  usage?: Usage;              // prompt/completion tokens、估算成本
  raw?: unknown;              // 原始回應,除錯用
};
```

- **Runner 是 one-shot**:單次呼叫、不知道 repeat。**重複由 JobRunner 驅動**(§8),每個 repeat 是一次**獨立的 OpenRouter 呼叫**(而非單次 `n>1` 取樣)——否則 variance 無意義。
- v1 只有 `OpenRouterRunner`。behavior 取 `text`,tool_use 取 `toolCalls`;下游 judge/metrics/summary 不分型別共用。日後 `MockMcpHarnessRunner` 接同一介面,產出同形 `toolCalls`。

## 8. JobRunner 與執行流程

1. 建立 Run → 寫 `runs(status=queued)`,展開 `TestCase × nRepeats` 待辦。
2. JobRunner 以受限併發(預設 4)逐筆呼叫 Runner;**每筆完成即寫一筆 `results`**(成功或 `error`),即時更新 run 進度。
3. 全數完成 → `runs(status=done)`;有致命錯 → `status=error` 但已完成的 result 保留。
4. 前端用 SSE 訂閱 run 進度(讀 DB,不綁執行生命週期 → 關分頁不中斷)。
5. retry:單筆 OpenRouter 失敗以指數退避重試(預設 2 次);仍失敗則該 result 標 `error`,**不吞、不中斷整個 run**。

## 9. 功能流程

### 9.1 behavior
1. 定義 suite:被測 model、systemPrompt、temperature。
2. 測資:規則生成 或 手動。
3. 跑 N 次/筆(one-shot)。
4. judge(預設開、可關):第二模型依 rubric 對每個輸出給 `{ score, reasoning }`,並排呈現,非 pass/fail。
5. summary→drill-down:點一筆 → 測資、N 次輸出、judge 評語並排。

**一致性指標(v1)**:`scoreMean ± scoreStd`(judge 開啟時)+ `distinctOutputCount`(正規化後相異輸出數)。語意叢集為 v-next。

### 9.2 tool_use(Tier 0)
1. 定義 suite:model、prompt、一組虛擬工具 schema(不真執行)。
2. 測資:scenario prompts(手動或生成);`expected` 可填預期工具/參數。
3. 跑 N 次 → 擷取 `toolCalls`。
4. 指標(借 BFCL 三層):
   - `toolSelectionHitRate`(有 `expected.tool` 時)
   - `toolSelectionEntropy`(N 次選擇集合的熵 → 一致性單一數字)
   - `argumentSchemaConformanceRate`(參數以 **Ajv** 對工具 JSON schema 驗證)
   - `argumentExactMatch`(選填,有 ground-truth 時)
   - judge 可選(「選得恰當嗎」)。
5. summary→drill-down:工具選擇分布長條、entropy、schema 合規率;下鑽看 N 次 tool call 與參數並排。

## 10. prompt 規則生成測資

表單:`languages[]`、`countPerLang`、`lengthWords`、`topic`、`extra`(自由補充)→ 組成生成 prompt → OpenRouter structured output 產出 `TestCase[]` → 使用者**預覽 / 編輯 / 重生** → 存成可重用 dataset。生成用的 `genSpec` 一併存,供重現。

## 11. 錯誤處理與可觀測

- **零靜默失敗**:每個 OpenRouter 呼叫具名包裝;單筆錯誤落為 `result.status=error` + 錯誤訊息,UI 顯示,不中斷 run。
- retry + 指數退避;區分可重試(429/5xx/逾時)與不可重試(4xx schema 錯)。
- **成本/token**:OpenRouter 回 `usage`,逐筆記錄,summary 加總顯示。
- **實作前以 fixture 驗證的跨模型差異**(研究標未證實):
  1. `parallel_tool_calls` 經 OpenRouter 是否一致。
  2. `tool_choice`(auto/none/指定)各模型服從度。
  3. 不支援 tool calling 的模型退化行為。
  4. `arguments` 偶發回物件而非 JSON 字串 → 防禦性 parse。
  做法:用一個 OpenAI、一個 Anthropic、一個開源模型各打一次,存回應為 fixture。
- **fixture 不符時的 fallback 政策**:模型不支援 tool calling(`finish_reason` 非 `tool_calls`)→ 該筆落 `result.status=error`(訊息註明「模型未回 tool call」),**不阻擋整個 run**;summary 將該筆計入 schema 合規率分母的失敗。不在 run 階段硬性封鎖某模型——讓結果誠實呈現該模型在此工具下的行為。

## 12. 測試

- **unit**:metrics 為純函式(entropy、schema 合規率、score std、distinct count)→ 完整單測,含邊界(N=1、全相同、全不同、空輸出)。
- **integration**:eval 流程用 MSW mock OpenRouter,跑完整 run 驗 result/summary;含單筆失敗的 error 路徑。
- **型別**:`tsc --noEmit` strict 零錯。
- 優先 integration(真實 flow)> 複雜邏輯 unit。

## 13. 風險

- 自由文字一致性 v1 較粗(分數 variance + 相異計數),對「語意等價但字面不同」會高估不一致 → 已標 v-next 用 embedding/judge 叢集改善。
- OpenRouter 跨模型差異(§11)若與假設不符,影響 tool_use 結果正確性 → 以 fixture 先驗。
- 生成測資品質依賴生成模型 → 提供預覽/編輯/重生作人工關卡。

## 14. v1 交付邊界

完成定義為:能建立兩型 suite、(生成或手動)測資、跑 N 次、(選擇性)judge、看 summary→drill-down、單筆錯誤可見、成本可見;core 與框架解耦且四個 seam 就位;unit+integration 綠、`tsc` 零錯。
