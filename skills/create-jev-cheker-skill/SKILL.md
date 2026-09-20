---
name: create-jev-cheker-skill
description: "Investigate a subject, draft the full checklist, wait for the operator to approve the whole list, then write one approved CheckerDefinition JSON file that the Jev checker runner parses. Use when an operator wants a new or revised checker definition for one subject."
---

# Create a Jev checker definition

This skill produces one approved `CheckerDefinition` JSON file per subject. It is not the inspection loop and it is not a text editor.

## Inputs

Collect these before you start.

- The subject. One of the five candidates in `README.md` under 候補にする対象, or another subject the operator names.
- Source material to study. Examples of the subject and the procedure people follow today.
- The destination path for the definition file.
- The approver's identity, written into `approval.by`.

## Investigate the subject

Read examples of the subject and the current procedure. Sort every condition into two kinds. Code settles counts, syntax, file existence, and formats. A Jev question settles meaning, consistency, and omission. Only the second kind becomes a question. The second bullet under 規則 in `README.md` is the rule.

## Draft the complete checklist

Draft the checklist as definition-shaped JSON with `approval.status` set to `draft`. Give each question a stable snake_case `id`, a `type` of `noul`, `choice`, or `score`, `instructions`, `criteria`, thresholds or `options`, an optional `confidenceFloor`, and an optional `applyWhen`. Put all questions for one subject in one definition so the runner sends one request. Field rules live in `references/definition-schema.md`. A full worked example is `fixtures/sample-approved.checker.json`.

Before you show the draft, run the checks the parser does not do.

- For `choice`, the labels in `criteria` equal the labels in `options`.
- For `noul`, write both `passAt` and `failAt` or neither.
- Every threshold sits inside the answer range of its question.

## Whole-list approval stop

Show every item and every field of the whole checklist to the operator. Do not inspect the subject with this checklist and do not run `jev-check` until the operator approves every item as one whole list. Never ask for approval of a diff or a single item. Wait for the operator's explicit approval before you continue.

## Revise and show the whole list again

If the operator requests any edit, set `approval.status` to `draft`, apply the edit, and show the complete list again. Then return to the approval stop and wait for approval again. When the file was already approved, also increment `version`.

## Write the approved definition

Write the exact approved list to the destination path with `approval` set to `{ "status": "approved", "at": <ISO 8601 UTC>, "by": <approver> }`. Then confirm that the parser accepts the file.

```bash
npx jev-check --dry-run --definition <file> --input <a JSON file with a state key>
```

Exit 0 means the file parses. A refusal exits 2 and names the field in `{ "error": ... }`. If the fix changes a question, return to the approval stop. If the fix only touches the `approval` record, rerun the command.

## Output

The definition file is the default output and usually the only output. Write an execution skill only when the operator must teach Codex how to collect the subject, for example which files to gather and how to build the `state` object. That execution skill contains the collection steps and the `jev-check` command, nothing else. Do not copy a Python runner. `jev-check` is the runner.

## The report is evidence, not permission

`CheckReport` has four fields, `definition`, `items`, `usage`, and `timing`. None of them permits an action. Do not merge, delete, publish, or send anything because a report passed. Exit codes 0, 1, 2, and 3 are listed in `README.md` under 終了コード.

## Validate this skill

Run `node skills/create-jev-cheker-skill/scripts/validate-skill.mjs` from the repository root. It prints `ok approval-gate` among its lines and exits 0.
