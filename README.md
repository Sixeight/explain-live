# explain-live

A side pane for Claude Code that keeps a running summary of the session, so you can follow what the AI is doing without reading every line.

After each reply the pane updates:

- **Goal** and **Approach** of the session
- **Decisions**, with ⚑ on the ones the AI made without being asked
- **To decide**: the options Claude asked you to pick, with ★ on the recommended one
- **Flow**: how the edited files call each other, with the steps changed in this reply outlined in yellow
- **Changed files** with added and removed line counts
- A **Explain diff** button (`d`) that runs the bundled `explain-me` skill

The plugin also ships the `explain-me` skill: it explains a PR, branch, or working-tree diff (what changes, reading order, flow diagram, data change, what the AI decided on its own).

## Install

```
/plugin marketplace add Sixeight/explain-live
/plugin install explain-live@explain-live
```

Open the pane with `/explain-live`. It also opens by itself after the first reply.

## Settings

| Key | Default | Meaning |
| --- | --- | --- |
| `language` | `en` | `en` or `ja`: language of the pane and of the summary |
| `explainCommand` | `explain-live:explain-me` | Skill or command the **Explain diff** button runs. Set it to any skill, e.g. `my-plugin:my-skill` |

## Cost

Each reply costs one extra model request that reads the conversation. The pane shows the token totals at the bottom.

## Development

```
bun test
```

Tests cover the prompt and the reply parser (`hooks/summary.ts`). The pane itself (`hooks/register.tsx`) needs Claude Code to run.

## License

MIT
