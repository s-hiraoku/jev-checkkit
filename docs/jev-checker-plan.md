# Jev checker plan

This program ships a TypeSafe Jev checker runner and a design skill that writes approved definitions. It is for an operator who wants many small Jev questions composed in code, not a review chatbot. The rule is that a definition cannot run until the operator approves every item, and a report never authorizes merge, delete, publish, or send. The stack is PR1 then PR2. Hooks, product checklists, and per-target skills stay out. The GitHub repository is https://github.com/s-hiraoku/jev-checkkit.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-stack.md`. The operator lands PR1 and PR2. Owners stop at merge-ready.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] On the operator's go, arm a `/goal` with this exact text. "Run `docs/jev-checker-plan.md`. Land PR1 then PR2. Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. The operator lands. Done when both PRs are stacked, verified, and the operator has the landing report."
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md`
  - [ ] `git show origin/main:pstack/skills/swarm/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/control-cli/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md`
  - [ ] `git show origin/main:pstack/skills/how/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/unslop/SKILL.md`
  - [ ] If a `git show origin/main:` path is missing because this repo does not vendor pstack, read the same file from the installed poteto-mode plugin and record that fallback in the tick report.
- [ ] Arm the 30-minute audit tick. In a local session, a real terminal `/loop`. In a cloud root, a cloud-sleeper wake chain. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk and the armed /goal. Audit the operation against both and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then post a status message to the operator in chat, whether or not anything changed, with the queue table of PR, owner, state, and head SHA, the verdicts since the last tick, what merged, open operator gates, and blockers."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle the execution playbook names.
- [ ] Follow this dependency graph. Start dependent work only after its parent merges, or base it on the parent branch when the execution playbook stacks.
  - [ ] PR1 is first. It branches from `main`.
  - [ ] PR2 after PR1.
- [ ] Hold the file boundaries. PR1 touches only `package.json`, `package-lock.json`, `tsconfig.json`, `src/**`, `tests/**`, `fixtures/**`, and `README.md`. PR2 touches only `skills/create-jev-cheker-skill/**`.
- [ ] Hold the review gate. PR1 and PR2 change an interaction. They wait for the operator's review in chat with screenshots and a video before merge.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Default to `gh`; if `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Record any fallback to `gh`. Never require `gt`.
- [ ] Open the PR ready, never draft, with `origin pr create --status open --base <base-branch>` or `gh pr create --base <base-branch>` according to the resolved forge. A stack child targets its parent branch.
- [ ] Run the repo's lint and typecheck once before the PR-facing push. Push with hooks on.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `../references/bugbot-triage.md`.
- [ ] Rebase onto current trunk before babysit and again before the merge-ready report.

### Verdict and merge, for every PR

- [ ] At the merge-ready head SHA, run the swarm per `pstack/skills/swarm/SKILL.md`. One gates lane. The ten live lanes from the PR's **Verify, live** block. The perf lane from its **Verify, perf** block. One audit lane that reads the diff and the receipts and distrusts the PR body.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner. A new head gets a fresh swarm and a fresh verdict.
- [ ] Owners do not merge. The root appends a clean verdict to the base-branch stack. The operator lands bottom-up. Before append or land, compare the recorded `git patch-id` of the verdict base-to-head diff with the current base-to-head patch-id. Re-verify when the patch changed. When it did not, keep the code verdict and re-run mergeability and CI.

### Boot recipe, for every live lane

Each live lane runs on its own cloud VM at the PR head. Drive through `control-cli` from `cursor-team-kit`. If that skill is missing, run the same commands in a real terminal and photograph that terminal. Record the fallback.

- [ ] `git fetch origin <head-branch> && git checkout <head SHA>`.
- [ ] Run `npm ci` and `npm run build`. Wait until the build prints a success line and `dist/cli.js` exists.
- [ ] Deliver input only through the control skill's commands, or through the recorded terminal fallback. Allowed reads are the process exit code, stdout, stderr, and the written report file. Do not open a browser.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report.

## Ship the runner and schema (PR1)

**Depends on.** None.

**Files.**

- [ ] Create `package.json`.
- [ ] Create `tsconfig.json`.
- [ ] Create `src/types.ts`.
- [ ] Create `src/definition.ts`.
- [ ] Create `src/evaluate.ts`.
- [ ] Create `src/jev.ts`.
- [ ] Create `src/report.ts`.
- [ ] Create `src/cli.ts`.
- [ ] Create `src/index.ts`.
- [ ] Create `fixtures/sample-approved.checker.json`.
- [ ] Create `fixtures/sample-draft.checker.json`.
- [ ] Create `fixtures/replay/pass.json`.
- [ ] Create `fixtures/replay/fail.json`.
- [ ] Create `fixtures/replay/review.json`.
- [ ] Create `fixtures/replay/not-applicable.json`.
- [ ] Create `fixtures/replay/missing-answer.json`.
- [ ] Create `tests/definition.test.ts`.
- [ ] Create `tests/evaluate.test.ts`.
- [ ] Create `tests/cli.test.ts`.
- [ ] Create `README.md`.
- [ ] Delete nothing. The repo has no prior source.

**Build.**

- [ ] Add `CheckerDefinition` in `src/types.ts` as a versioned record with a branded `id`, a branded question id, and an `approval` union of `{ status: "draft" }` or `{ status: "approved", at: string, by: string }`.
- [ ] Add `Verdict` in `src/types.ts` as `"pass" | "fail" | "review" | "not_applicable" | "error"`.
- [ ] Add question variants in `src/types.ts` for `noul`, `choice`, and `score`. Each variant holds Jev `instructions`, optional `criteria`, optional `applyWhen`, and the code-side threshold or option map.
- [ ] Add `CheckReport` in `src/types.ts` with `items`, `usage`, and `timing`. Give it no `action`, `merge`, `publish`, or `send` field.
- [ ] Parse JSON into `CheckerDefinition` in `src/definition.ts`. Refuse an unapproved definition. Refuse a duplicate question id. Refuse an empty question set.
- [ ] Evaluate `applyWhen` in `src/evaluate.ts` before any Jev call. Skip a question whose predicate is false and mark it `not_applicable`.
- [ ] Send every remaining question for one subject in one `TypeSafeClient.systemOne` call from `src/jev.ts`. Use `@typesafe-ai/sdk`. Do not invent a second HTTP client.
- [ ] Map answers in `src/evaluate.ts`. A missing answer is `error`. A noul at or above `passAt` is `pass`. A noul at or below `failAt` is `fail`. Everything between those two is `review`. A choice uses the option map, and an unmapped option is `review`. A score uses numeric bands the same way. A choice or score whose `confidence` is below the question's floor is `review` even when the mapped value would pass.
- [ ] Default noul bands to `passAt` 0.8 and `failAt` 0.2 when a question omits them.
- [ ] Record wall time from `evaluate` entry to report return, and Jev time around the single request, in `src/report.ts`.
- [ ] Add `src/cli.ts` as `jev-check --definition <file> --input <file>` with `--dry-run` and `--replay <file>`. Print the report as JSON. Print no secret. Exit 0 only when every item is `pass` or `not_applicable`. Exit 1 on any `fail`. Exit 2 on any `review`, `error`, or unapproved definition. Exit 3 on a missing key or a transport failure.
- [ ] Keep `fixtures/sample-approved.checker.json` as a fixture about a short English paragraph. Do not treat it as a product checklist.

**You see.**

- [ ] `npx jev-check --definition fixtures/sample-draft.checker.json --input fixtures/replay/pass.json` prints a JSON report whose `error` names the missing approval and exits 2. The process makes no network call.
- [ ] `npx jev-check --replay fixtures/replay/pass.json` prints one report whose items are `pass` or `not_applicable` and exits 0.
- [ ] `npx jev-check --dry-run --definition fixtures/sample-approved.checker.json --input fixtures/replay/pass.json` prints the planned `state` and `questions` object, prints no `answers`, and exits 0.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `tests/definition.test.ts` covers draft refuse, approved parse, duplicate ids, and empty questions. Run `npm test`.
- [ ] `tests/evaluate.test.ts` covers pass, fail, review, not_applicable, missing answer, one batched request, and a low-confidence choice forced to review. Run `npm test`.
- [ ] `tests/cli.test.ts` covers exit codes 0, 1, 2, and 3, and asserts stdout never matches `TYPESAFE_API_KEY=`. Run `npm test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `npx jev-check --help` at trunk and head. If trunk lacks the binary, record that and gate the help text plus a completed report on head. Save `pr1-regression.png`. Pass when trunk has no `dist/cli.js` and head prints the `--definition`, `--dry-run`, and `--replay` flags.
- [ ] Lane 2. Dry-run of the approved fixture. Save `pr1-dry-run.png`. Pass when stdout contains `"questions"` and does not contain `"answers"`, and the exit code is 0.
- [ ] Lane 3. Draft definition refuse. Save `pr1-draft-refuse.png`. Pass when the command exits 2 and stdout names `approval`.
- [ ] Lane 4. Replay pass. Save `pr1-replay-pass.png`. Pass when every item verdict is `pass` or `not_applicable` and the exit code is 0.
- [ ] Lane 5. Replay fail. Save `pr1-replay-fail.png`. Pass when at least one item verdict is `fail` and the exit code is 1.
- [ ] Lane 6. Replay review. Save `pr1-replay-review.png`. Pass when at least one item verdict is `review` and the exit code is 2.
- [ ] Lane 7. Replay not applicable. Save `pr1-replay-na.png`. Pass when the skipped question is `not_applicable` and the mocked Jev call omits that question id.
- [ ] Lane 8. Missing answer. Save `pr1-missing-answer.png`. Pass when the missing id is `error` and the exit code is 2.
- [ ] Lane 9. Batch proof. Save `pr1-batch.png`. Pass when `--dry-run` shows two or more question ids in one request object and the replay mock is invoked once.
- [ ] Lane 10. Secret hygiene. Save `pr1-no-secret.png`. Pass when `TYPESAFE_API_KEY` is set to a dummy value in the lane environment and neither stdout nor stderr contains that dummy value.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall milliseconds of `npx jev-check --replay fixtures/replay/pass.json` from process start to the report JSON on stdout. Trunk has no binary, so also name the replay work the diff adds and the printed report the user waits for.
- [ ] Probe. Run the replay command three times at head. At trunk, record that `dist/cli.js` is absent. Interleave a `date +%s%3N` stamp before and after each head run.
- [ ] Baseline. Record the trunk result first. The trunk result is "no binary".
- [ ] Rule. Head replay p50 must stay under 500 ms. Fail the PR if any of the three head runs exceeds 1500 ms or if the report JSON never appears.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2 and lane 3 screenshots into `/tmp/media/pr1-review-dry-run.png` and `/tmp/media/pr1-review-draft-refuse.png`.
- [ ] Record a 30 to 60 second video of the change on a lane VM. Save it as `/tmp/media/pr1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends PR1 to the base-branch stack. The operator squash-merges it.

## Rewrite the design skill (PR2)

**Depends on.** PR1.

**Files.**

- [ ] Create `skills/create-jev-cheker-skill/SKILL.md`.
- [ ] Create `skills/create-jev-cheker-skill/references/definition-schema.md`.
- [ ] Create `skills/create-jev-cheker-skill/scripts/validate-skill.mjs`.
- [ ] Delete nothing. Do not add `scripts/jev_check.py`. Do not add `references/generated-skill-template.md`.

**Build.**

- [ ] Write `skills/create-jev-cheker-skill/SKILL.md` so the skill investigates a subject, drafts a full checklist, shows every item, and waits for approval of the whole list. After a revision it shows the whole list again and waits again.
- [ ] Write the skill so an approved list becomes a `CheckerDefinition` JSON file that `jev-check` can parse. The skill does not run that file until approval exists on the file.
- [ ] Write the skill so it emits an execution skill only when the operator must teach Codex how to collect the subject. The default output is the definition file alone.
- [ ] Ban auto merge, auto delete, auto publish, and auto send in the skill text. Point at the report fields from PR1.
- [ ] Add `scripts/validate-skill.mjs` that fails if the skill file lacks the approval gate, mentions copying a Python runner, or tells the agent to generate a target skill by default.

**You see.**

- [ ] `node skills/create-jev-cheker-skill/scripts/validate-skill.mjs` exits 0 on the new skill and prints `ok approval-gate`.
- [ ] A reviewer can open `SKILL.md` and find an explicit stop before any `jev-check` run.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `node skills/create-jev-cheker-skill/scripts/validate-skill.mjs` is the unit check. Run that command.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `node skills/create-jev-cheker-skill/scripts/validate-skill.mjs` at trunk and head. If trunk lacks the file, record that and gate the new `ok approval-gate` line. Save `pr2-regression.png`. Pass when trunk has no skill path and head prints `ok approval-gate`.
- [ ] Lane 2. Approval stop is present. Save `pr2-approval-stop.png`. Pass when `SKILL.md` contains a heading or sentence that forbids inspection before the operator approves the whole list.
- [ ] Lane 3. Definition is the default product. Save `pr2-definition-default.png`. Pass when the skill lists a definition file as the default output and lists an execution skill as optional.
- [ ] Lane 4. Python runner is absent. Save `pr2-no-python.png`. Pass when the skill tree contains no `jev_check.py` and the skill text does not tell the agent to copy one.
- [ ] Lane 5. Old template is absent. Save `pr2-no-old-template.png`. Pass when `generated-skill-template.md` does not exist.
- [ ] Lane 6. Schema reference matches PR1. Save `pr2-schema-match.png`. Pass when `definition-schema.md` names `approval`, `Verdict`, and the three question types that `src/types.ts` exports.
- [ ] Lane 7. Validator catches a stripped gate. Save `pr2-validator-fail.png`. Pass when a temp copy of `SKILL.md` with the approval paragraph removed makes `validate-skill.mjs` exit 1.
- [ ] Lane 8. Name is exact. Save `pr2-name.png`. Pass when the skill directory is `create-jev-cheker-skill` with that spelling.
- [ ] Lane 9. No auto action. Save `pr2-no-auto-action.png`. Pass when the skill text forbids merge, delete, publish, and send from a report.
- [ ] Lane 10. Dry definition parse. Save `pr2-dry-parse.png`. Pass when a sample definition in the skill references parses with PR1 `definition.ts` and is refused until `approval.status` is `approved`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall milliseconds of `node skills/create-jev-cheker-skill/scripts/validate-skill.mjs`. Trunk has no script, so also name the validator work the diff adds and the `ok approval-gate` line the user waits for.
- [ ] Probe. Run the validator three times at head. At trunk, record that the script path is absent. Interleave a `date +%s%3N` stamp before and after each head run.
- [ ] Baseline. Record the trunk result first. The trunk result is "no script".
- [ ] Rule. Head validator p50 must stay under 200 ms. Fail the PR if any of the three head runs exceeds 1000 ms or if `ok approval-gate` never prints.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2 and lane 3 screenshots into `/tmp/media/pr2-review-approval-stop.png` and `/tmp/media/pr2-review-definition-default.png`.
- [ ] Record a 30 to 60 second video of the change on a lane VM. Save it as `/tmp/media/pr2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends PR2 onto PR1. The operator squash-merges it after PR1.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] Reply to the operator with the report the execution playbook names.

## Appendix A. Prototype evidence

No throwaway prototype was built. The remaining design forks were either already decided or are product calls.

Settled by reading, not by a run.

- Official TypeSafe docs state that Noul, Choice, and Score mix in one `POST https://api.typesafe.ai/v1/systemone` call and that added questions stay parallel. Source. [Introduction](https://docs.typesafe.ai/introduction) and [Quick start](https://docs.typesafe.ai/introduction/quickstart).
- Official confidence docs state that Choice and Score carry `confidence`, and that Noul does not. Source. [Confidence](https://docs.typesafe.ai/confidence).
- Official JS SDK is `@typesafe-ai/sdk` with `TypeSafeClient.systemOne`. Source. [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript).
- `tamaratran/fast-jev-compaction` keeps judgment in `src/` (`JevClient.ask`, `buildJevRequest`, `parseJevResponse`) and keeps the host in `hooks/` plus `.claude-plugin/`. Its `package.json` test command is `vitest run`. Compaction splits noul pairs with `batchCalls` against `maxRequestTokens` 30000, then `Promise.all`. The library `compact` throws. The hook `register` falls back to `next(event)` on throw or a weak `reductionRatio`. That policy is compaction, not a checker. Do not copy `compact.ts`, `messages.ts`, `batchCalls`, `questionsFor`, `decideCall`, `fitState`, or the hooks.

Still unproven.

- Live Jev accuracy, latency, and cost on any real subject. This environment has no `TYPESAFE_API_KEY`.
- Whether a PR description or a development log is the first product subject. The operator must pick that later and approve the list.
- Whether Granola holds extra decisions. The Granola MCP in this session rejected the account.

## Appendix B. Alternatives rejected

- Keep the old meta-skill that always writes a target skill and copies a Python runner. That design is what the redesign already discarded. The installed copy is stale.
- Port `jev_check.py` into the new core. It only understands Noul and it hard-codes the old threshold pair in a language the redesign left.
- Build a Next.js app because the repo is empty. The operator asked for a checker, not a page.
- Add Hook or plugin work in this program. No approved product list exists, so an event path has nothing honest to attach to.
- Generate an execution skill for every subject. Collection scripts belong in a skill only when Codex must remember a fetch procedure.
- Let the next agent invent the first product checklist. The operator has not approved one.
- Treat "judgment-driven development" as a platform to scaffold. The valuable object is one approved definition plus one runner.
- Hand-roll a second HTTP client when `@typesafe-ai/sdk` already parses the three answer types.
- Port `batchCalls` or a 30000-token splitter into PR1. A fixture checklist fits in one request. Split later only if a measured subject overflows.
- Put auto-action behind a flag. A flag becomes the next default. The report type must not grow an action field.

## Appendix C. Risks

- Missing API key. PR1 live lanes use `--dry-run` and `--replay`. Do not claim live accuracy. Owner of PR1 watches that no lane calls the network unless a key is present and the operator asked for that extra run.
- Missing `control-cli` in this environment. Live lanes still drive the real CLI. The owner photographs the terminal if the control skill is absent.
- pstack files are not in this repo. Tick reads that use `git show origin/main:pstack/...` will fail until someone vendors those files. Fall back to the plugin copy and write that down.
- Installed Codex copy at `~/.codex/skills/create-jev-cheker-skill/` is outside this repo. PR2 updates the repo copy only. The operator copies it out after landing, or asks for a later sync.
- Official TypeSafe "high confidence, act automatically" guidance conflicts with the no-auto-action rule. The runner follows the operator rule, not that docs example.
- A fixture checklist can be mistaken for a product checklist. Keep the fixture subject a short paragraph and label the file `sample-`.

## Appendix D. Links and reading list

Read these before editing PR1.

- [TypeSafe introduction](https://docs.typesafe.ai/introduction)
- [TypeSafe quick start](https://docs.typesafe.ai/introduction/quickstart)
- [Confidence](https://docs.typesafe.ai/confidence)
- [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)
- [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) `src/client.ts`, `src/request.ts`, `src/index.ts`, `package.json`

PR1 and PR2 both run `pstack/skills/how/SKILL.md` before the first edit of a new module boundary. Neither PR runs `pstack/skills/interrogate/SKILL.md` unless the operator contests the verdict union or the approval gate.

Keep a local decision trail per `pstack/skills/show-me-your-work/SKILL.md`. Do not commit it unless the operator asks for an audit record.
