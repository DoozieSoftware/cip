# Setting up the DoozieSoftware/cip GitHub Project

**Date authored:** 2026-06-30  
**Branch:** `main`  
**Author of this runbook:** Codex session (M12/M13 closeout)

This runbook creates a **ProjectsV2** board under the `DoozieSoftware`
GitHub org and wires it to the `DoozieSoftware/cip` repo. The Codex
session that produced the M12 + M13 closeout could not complete this
step because the active `gh` token is missing the `project` scope and
`gh auth refresh` triggers an interactive device flow that the sandbox
cannot complete.

## 1. Why the project matters

The platform has 16 milestones (`M1..M16`) and 410 tracked tasks. A
GitHub Project with four lanes — **Backlog / In progress / In review /
Done** — gives a single dashboard for steering, sprint planning, and
release readiness, and the M12/M13 work is already mirrored in
`.codex/current_milestone.md` + `.codex/completed_tasks.md`.

## 2. Prerequisite

The `gh` token needs the `project` scope in addition to the existing
ones. Two ways to get it:

### Option A — refresh the existing `gh` token (browser)

```bash
# 1. Refresh the active token with the new scope.
gh auth refresh -h github.com -s read:project -s project

# The CLI will print a one-time code and open https://github.com/login/device
# in your browser. Approve the request — the new scope is appended
# to the existing token.
```

### Option B — use a fine-grained PAT

1. Go to https://github.com/settings/tokens?type=beta
2. Create a fine-grained token scoped to the `DoozieSoftware` org
   and the `cip` repo with **Projects: Read + Write** + **Metadata: Read**.
3. Save the token in a file (e.g. `~/.config/gh/doozie-projects.pat`).
4. Tell the agent or export it:

```bash
export GH_TOKEN=$(cat ~/.config/gh/doozie-projects.pat)
```

## 3. Create the project

After the scope is granted, the agent (or you) runs:

```bash
# 3a. Create the org project.
gh project create --owner DoozieSoftware \
  --title "Civic Intelligence Platform — M1..M16" \
  --format "Kanban"

# 3b. Capture the project number from the URL.
# 3c. Link the project to the repo (optional — the new Projects
#     UI does this via "..." > "Linked repositories").
gh project link <PROJECT_NUMBER> --owner DoozieSoftware --repo cip
```

## 4. Recommended lanes (custom fields)

The default Kanban has Backlog / In progress / In review / Done. Add
these custom fields so the M1..M16 breakdown is one click away:

| Field          | Type       | Options / values                                    |
|----------------|------------|-----------------------------------------------------|
| Milestone      | Single     | M1, M2, M3, …, M16                                  |
| Status         | Single     | Backlog, In progress, In review, Done               |
| Priority       | Single     | P0, P1, P2, P3                                      |
| Size           | Single     | XS, S, M, L                                         |
| Release gate   | Checkbox   | needed for `M16` items                              |

## 5. Bulk-import the backlog (optional, but useful)

The single M12 commit alone carries 34 tasks; the platform's
`.codex/task_queue.md` enumerates all 410. A bulk import script can
read `.codex/task_queue.md` and create one issue per task, then add
them to the project. Example skeleton:

```bash
# Sketch — adapt per your real GitHub Project workflow.
awk '/^### T-/ {print}' .codex/task_queue.md | while read -r line; do
  id=$(echo "$line" | awk '{print $1}' | sed 's/###//')
  title=$(echo "$line" | sed -E 's/^### T-[A-Z0-9-]+ — //')
  body=$(...)
  gh issue create \
    --repo DoozieSoftware/cip \
    --title "[$id] $title" \
    --body "$body" \
    --label "task"
done
```

## 6. Why this is runbook-style and not automated

* ProjectsV2 (the modern GitHub Project UI) only accepts the `project`
  scope via the OAuth flow; the sandbox does not have a browser.
* The old `/projects` REST API is deprecated and returns 404 for
  every request without the `project` scope.
* The GraphQL endpoint that creates a project is
  `createProjectV2(input: CreateProjectV2Input!)` and requires the
  same scope.
