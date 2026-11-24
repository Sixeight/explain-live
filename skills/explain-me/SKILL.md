---
name: explain-me
description: Explain a diff (PR, branch, or working tree) written by an AI so the user can understand it before reading the code. Use when the user says "/explain-me", "explain this diff", or "I don't know what changed".
argument-hint: "[PR number]"
effort: high
---

# Explain me

Build the map the reader needs before reading a diff. They asked for the change but have not read the code. With no PR number, cover the merge-base with origin/main through the working tree, uncommitted changes included. Summarize generated files and lock files in one line without reading them.

## Sections (in this order)

1. **What changes.** Behavior before and after, in the words of whoever uses it (end user, operator, calling code). 1-3 lines.
2. **Reading order.** From the entry point to the leaves. For each file, one sentence on what the file is for, then one on what this diff changes. For a PR, link to lines on GitHub.
3. **Flow diagram.** The changed path with the unchanged parts around it. A straight call chain or file layout is a monospace tree with `+` on added lines and `-` on removed lines. Branches, merges, or several parts talking, in HTML, are inline SVG with the changed boxes in a different color.
4. **Data change.** One realistic value from the tests or fixtures, followed through each stage before and after, in a table. If behavior does not change, say so and skip this.
5. **What the AI decided on its own.** Anything the diff settles that the instructions did not: names, locations, defaults, error handling, deletions. Read the instructions from the conversation, PR body, or linked issue; if they are missing, mark the item as a guess. If another session wrote the diff, `rg` the branch name in `~/.claude/projects/*/*.jsonl` and read the user's messages there.

## Leave out

- Review comments, severity, concerns. Report problems separately in the reply.
- Code excerpts over 15 lines.
- Unexplained abbreviations and names coined during the work.

## Output

Up to 3 files, not counting generated files and lock files: write sections 1, 3 and 5 in the reply, no HTML. Larger, or when HTML is requested: read the artifact-design skill (and artifact-diagramming for SVG), write one HTML file, and publish it with the Artifact tool. Without the Artifact tool, save it to a temporary directory and give the path. The reply is section 1 plus the link or path.
