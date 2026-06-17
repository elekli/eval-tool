# TODOS

## Deferred tasks

- **Port pair-watch → herdr**(獨立小任務,需自己的 spec)
  - 現況:`~/.claude/skills/pair-watch` 寫死綁 tmux;elek 環境已改用 herdr(`HERDR_ENV=1`,`HERDR_PANE_ID`,socket API)。
  - 可行性:herdr 暴露 `HERDR_PANE_ID`(等同 `$TMUX_PANE`)與 `herdr pane split/send-keys/read/close/report-metadata`,對得上 pair-watch 用到的 tmux 動作。
  - 要改的三處:啟動(`herdr pane split` 開 watcher pane + 擷取新 pane id)、DRIFT-DIR 彈窗(herdr 無瞬時 overlay → 降級為 FEEDBACK 檔 + 狀態列)、注入路徑的 pane 狀態讀取/`send-keys`。
  - 安全敏感:fail-closed 注入守則與唯讀 verifier 設定要保留,值得走 spec → plan → review,不要直接 hack 共用 skill 腳本。
