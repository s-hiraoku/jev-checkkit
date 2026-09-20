# Checker definition schema

This file describes the JSON that `parseDefinition` in `src/definition.ts` accepts and the report that `jev-check` prints. The parser is strict about shape and lenient about meaning. It refuses wrong types, missing required fields, inverted bands, duplicate ids, and empty question lists. It does not cross-check `criteria` labels against `options`, does not range-check thresholds, and drops unknown keys without a message.

## CheckerDefinition

`CheckerDefinition` has five keys. `ApprovedDefinition` is the same type with `approval` narrowed to the approved variant. `parseDefinition` returns only `ApprovedDefinition`. `CheckerId` and `QuestionId` are branded strings in TypeScript. In JSON they are plain strings.

`i` is the zero-based question index. Every refusal has kind `malformed` unless the table says otherwise.

| Field | Type | Required | Refusal message when wrong |
| --- | --- | --- | --- |
| (root) | JSON object | yes | `definition must be a JSON object` |
| `id` | non-empty string | yes | `id must be a non-empty string` |
| `version` | integer, 0 or greater | yes | `version must be a non-negative integer` |
| `subject` | non-empty string | yes | `subject must be a non-empty string` |
| `approval` | object | yes | `approval must be an object` |
| `approval.status` | `"draft"` or `"approved"` | yes | `approval.status must be "draft" or "approved"` |
| `approval.at` | non-empty string | when status is `approved` | `approval.at must be a non-empty string` |
| `approval.by` | non-empty string | when status is `approved` | `approval.by must be a non-empty string` |
| `questions` | array | yes | `questions must be an array` |
| `questions` | at least one element | yes | kind `empty`. `questions is empty; a definition needs at least one question` |
| `questions[i]` | object | yes | `questions[i] must be an object` |
| `questions[i].id` | non-empty string | yes | `questions[i].id must be a non-empty string` |
| `questions[i].id` | unique across questions | yes | kind `duplicate-id`. `questions[i].id "<id>" repeats an earlier question id` |
| `questions[i].type` | `"noul"`, `"choice"`, or `"score"` | yes | `questions[i].type must be "noul", "choice", or "score"` |
| `questions[i].instructions` | string, object, array, or `null` | yes, the key must be present | `questions[i].instructions must be text, a JSON object, an array, or null` |
| `questions[i].applyWhen` | object | no | `questions[i].applyWhen must be an object` |
| `questions[i].applyWhen.path` | non-empty string, dot-separated | when `applyWhen` is present | `questions[i].applyWhen.path must be a non-empty string` |
| `questions[i].applyWhen.op` | `"exists"` or `"equals"` | when `applyWhen` is present | `questions[i].applyWhen.op must be "exists" or "equals"` |
| `questions[i].applyWhen.value` | any JSON value, including `null` | when `op` is `equals` | `questions[i].applyWhen.value must be a JSON value` |
| `noul` `criteria` | object with optional `true` and `false` descriptions, or `null` | no | `questions[i].criteria must be an object with optional "true" and "false" descriptions, or null` |
| `noul` `criteria.true`, `criteria.false` | string, object, array, or `null` | no | `questions[i].criteria.true must be text, a JSON object, an array, or null` |
| `noul` `passAt` | finite number | no, default 0.8 | `questions[i].passAt must be a finite number` |
| `noul` `failAt` | finite number | no, default 0.2 | `questions[i].failAt must be a finite number` |
| `noul` `passAt` vs `failAt` | `passAt > failAt` when both are present | | `questions[i].passAt <p> must be greater than questions[i].failAt <f>` |
| `choice` `criteria` | object, at least one label, each description a string, object, array, or `null` | yes | `questions[i].criteria must be an object with at least one label`, or per label `questions[i].criteria.<label> must be text, a JSON object, an array, or null` |
| `choice` `options` | object, label to `"pass"`, `"fail"`, or `"review"` | yes, `{}` is allowed | `questions[i].options must be an object mapping labels to pass, fail, or review`, or per label `questions[i].options.<label> must be "pass", "fail", or "review"` |
| `choice` `confidenceFloor` | finite number | no | `questions[i].confidenceFloor must be a finite number` |
| `score` `criteria` | array of at least two descriptions | yes | `questions[i].criteria must be a list of at least two descriptions` |
| `score` `passAt` | finite number | yes | `questions[i].passAt must be a finite number` |
| `score` `failAt` | finite number | yes | `questions[i].failAt must be a finite number` |
| `score` `passAt` vs `failAt` | `passAt > failAt` | yes | `questions[i].passAt <p> must be greater than questions[i].failAt <f>` |
| `score` `confidenceFloor` | finite number | no | `questions[i].confidenceFloor must be a finite number` |
| `approval.status` | `"approved"` to run | yes | kind `unapproved`. `approval.status is "draft"; approve every question before running this definition` |

### Approval

`Approval` is `{ "status": "draft" }` or `{ "status": "approved", "at": "<non-empty string>", "by": "<non-empty string>" }`. The parser does not validate `at` as a timestamp and accepts any non-empty `by`. Write `at` as ISO 8601 UTC so files stay sortable. Extra keys on a draft record are dropped.

### Questions

`Check` is the union of `NoulCheck`, `ChoiceCheck`, and `ScoreCheck`. The `type` key selects the variant. All three share `id`, `instructions`, and the optional `applyWhen`. The runner sends only `type`, `instructions`, and `criteria` to Jev. `passAt`, `failAt`, `options`, `confidenceFloor`, and `applyWhen` stay on the runner side.

A description is a string, a JSON object, a JSON array, or `null`. A bare number or boolean is refused.

#### noul

`NoulCheck` asks a yes or no question. Jev returns the probability of yes, from 0 to 1. `criteria` may carry `true` and `false` descriptions. `passAt` and `failAt` default to 0.8 and 0.2. At or above `passAt` is `pass`. At or below `failAt` is `fail`. Between them is `review`. The band check runs only when both values are present, so write both or neither. `confidenceFloor` on a `noul` is dropped.

#### choice

`ChoiceCheck` selects one label. `criteria` maps each label to a description. `options` maps each label to `pass`, `fail`, or `review`. A label absent from `options` yields `review`. When `confidenceFloor` is set and the answer's confidence is below it, the verdict is `review` whatever the label. The parser does not compare the label sets of `criteria` and `options`. Compare them yourself before you write the file.

#### score

`ScoreCheck` places the subject on an ordered rubric. `criteria` is an array of at least two descriptions, and index 0 is score 0. `passAt` and `failAt` are required and use the same bands as `noul`. `confidenceFloor` works as it does for `choice`. Thresholds are not range-checked, so keep them inside `0` to `criteria.length - 1`.

## ApplyWhen

`ApplyWhen` is `{ "path": "a.b", "op": "exists" }` or `{ "path": "a.b", "op": "equals", "value": <JSON> }`. `path` is dot-separated and walks nested objects in `state`. It cannot index arrays. A key present with value `null` counts as existing. `equals` is a deep strict comparison, so `1` differs from `"1"`. When the condition fails, the question becomes `not_applicable` and is not sent. When every question is skipped, the runner makes no Jev call.

## Parser order and error kinds

`DefinitionError` carries a `kind` of `malformed`, `unapproved`, `duplicate-id`, or `empty`. `parseDefinition` checks in a fixed order and the first failure wins. The order is the root object, `id`, `version`, `subject`, the `approval` shape, `questions` as an array, `questions` as non-empty, each question in index order, duplicate ids, and last the approval status. A draft file with well-formed questions fails with exactly the `unapproved` kind, so that error is a positive structural check of a draft. Unknown keys anywhere are dropped.

## CheckReport

`CheckReport` is `{ definition, items, usage, timing }`. `definition` carries `id` and `version`. `items` is one `ItemResult` per question in file order, each `{ id, verdict, reason, answer? }`. `answer` is the raw `JevAnswer` when Jev answered that question. `usage` carries `input_tokens` and `output_tokens`. `timing` carries `wallMs` and `jevMs`. No field permits an action.

### Verdict

`Verdict` is `pass`, `fail`, `review`, `not_applicable`, or `error`. `MappedVerdict` is the subset `pass`, `fail`, or `review` that a `choice` `options` table may name. The runner alone produces `not_applicable` and `error`. The exit code is 1 when any item is `fail`, otherwise 2 when any item is `review` or `error`, otherwise 0. Exit 2 also covers any refused file.

## Examples

This minimal draft definition is structurally valid. `parseDefinition` refuses it with kind `unapproved` until `approval` becomes `{ "status": "approved", "at": ..., "by": ... }`.

```json
{
  "id": "my-subject",
  "version": 0,
  "subject": "One sentence naming the unit being checked",
  "approval": { "status": "draft" },
  "questions": [
    {
      "id": "one_claim",
      "type": "noul",
      "instructions": "Does the subject make exactly one main claim?",
      "passAt": 0.8,
      "failAt": 0.2
    }
  ]
}
```

An approved file that exercises every type and `applyWhen` is [`sample-approved.checker.json`](../../../fixtures/sample-approved.checker.json). The same file as a draft is [`sample-draft.checker.json`](../../../fixtures/sample-draft.checker.json).

## Source of truth

The types are `src/types.ts`. The parser and its messages are `src/definition.ts`. When those files change, update this document. The `schema-types` rule in `scripts/validate-skill.mjs` fails when an exported type name from `src/types.ts` is missing here.
