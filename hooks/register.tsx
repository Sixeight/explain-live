import { atom, read, update } from "claude-code";
import type { EngineInterface, ModelForkResult, Register } from "claude-code";

import type { Spend, Touched, Understanding } from "../types";

import { ask, languageOf, parse } from "./summary";
import type { Language } from "./summary";

const PANE = "explain-live";
const EMPTY: Understanding = {
  goal: null,
  approach: [],
  decisions: [],
  now: null,
  options: [],
  flow: null,
};

const LABELS = {
  en: {
    title: "Work summary",
    opened: "Opened the work summary pane.",
    command:
      "Show the session's goal, approach, decisions and changed files in a side pane",
    empty: "A summary appears here after the first reply.",
    goal: "Goal",
    approach: "Approach",
    decisions: "Decisions",
    now: "Now",
    options: "To decide",
    flow: "Flow",
    files: "Changed files",
    recent: (shown: number, all: number) => `(last ${shown} of ${all})`,
    explain: "Explain diff",
    legend:
      "marks a decision the AI made without being asked. A yellow border marks what this reply changed",
    spend: (s: Spend, k: (n: number) => string) =>
      `queries ${s.forks}  input ${k(s.input)}  cache read ${k(s.cacheRead)}  cache write ${k(s.cacheWrite)}  output ${k(s.output)}${s.effort ? `  effort ${s.effort}` : ""}`,
  },
  ja: {
    title: "作業の要約",
    opened: "作業の要約パネルを開いた。",
    command:
      "このセッションの目的・方針・判断・変えたファイルを横のパネルに出す",
    empty: "返答が 1 回終わると、ここに作業の要約が出る。",
    goal: "目的",
    approach: "方針",
    decisions: "判断",
    now: "いま",
    options: "決めること",
    flow: "流れ",
    files: "変えたファイル",
    recent: (shown: number, all: number) => `（直近 ${shown} / ${all}）`,
    explain: "差分を解説",
    legend: "は頼まれずに AI が決めたこと。黄色の枠は今回の返答で変えたところ",
    spend: (s: Spend, k: (n: number) => string) =>
      `問い合わせ ${s.forks} 回 入力 ${k(s.input)} キャッシュ読み ${k(s.cacheRead)} キャッシュ書き ${k(s.cacheWrite)} 出力 ${k(s.output)}${s.effort ? `  深さ ${s.effort}` : ""}`,
  },
} as const;

const understanding = atom(
  { plugin: "explain-live", key: "understanding" } as const,
  EMPTY,
  {
    shape: "understanding-2",
  },
);
const touched = atom({ plugin: "explain-live", key: "touched" } as const, [], {
  shape: "touched-1",
});
const spend = atom(
  { plugin: "explain-live", key: "spend" } as const,
  { forks: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, effort: null },
  { shape: "spend-1" },
);

const editedThisTurn = new Set<string>();

async function fork(
  $: EngineInterface,
  prompt: string,
): Promise<ModelForkResult> {
  const reply = await $.model.fork({ prompt });
  const used = "usage" in reply ? reply.usage : undefined;
  await update($, spend, (sum: Spend) => ({
    forks: sum.forks + 1,
    input: sum.input + (used?.input_tokens ?? 0),
    cacheRead: sum.cacheRead + (used?.cache_read_input_tokens ?? 0),
    cacheWrite: sum.cacheWrite + (used?.cache_creation_input_tokens ?? 0),
    output: sum.output + (used?.output_tokens ?? 0),
    effort: (reply.isAnswered ? reply.effort : undefined) ?? sum.effort,
  }));
  return reply;
}

const lines = (text: string) => (text === "" ? 0 : text.split("\n").length);

async function refresh(
  $: EngineInterface,
  paths: string[],
  language: Language,
) {
  const before = await read($, understanding);
  const reply = await fork($, ask(language, before, paths));
  if (!reply.isAnswered) return;
  const after = parse(reply.text, before);
  await update($, understanding, () => after);
  if (before.goal === null && after.goal !== null)
    await reveal($, LABELS[language].title);
}

async function reveal($: EngineInterface, title: string) {
  if ((await $.ui.panes()).some((pane) => pane.id === PANE)) return;
  await $.ui.open({
    id: PANE,
    title,
    backgroundColor: "transparent",
  });
}

async function touch(
  $: EngineInterface,
  path: string,
  added: number,
  removed: number,
) {
  editedThisTurn.add(path);
  await update($, touched, (list: Touched[]) => {
    const old = list.find((one) => one.path === path);
    const rest = list.filter((one) => one.path !== path);
    return [
      ...rest,
      {
        path,
        added: (old?.added ?? 0) + added,
        removed: (old?.removed ?? 0) + removed,
      },
    ];
  });
}

const kilo = (count: number) =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);

export const register: Register = (on, options) => {
  const language = languageOf(options.language);
  const text = LABELS[language];
  const explainCommand = String(
    options.explainCommand || "explain-live:explain-me",
  );
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "explain-live",
      description: text.command,
    });
    return next(e);
  });

  on("command.run", { command: "explain-live" }, async ($) => {
    await $.ui.open({
      id: PANE,
      title: text.title,
      backgroundColor: "transparent",
    });
    return { text: text.opened };
  });

  on("session.end", async ($, e, next) => {
    if (e.reason === "clear" || e.reason === "resume") {
      editedThisTurn.clear();
      await update($, understanding, () => EMPTY);
      await update($, touched, () => []);
      await update($, spend, () => spend.initial);
      await $.ui.close({ id: PANE });
    }
    return next(e);
  });

  on("tool.call", { tool: "Edit" }, async ($, e, next) => {
    const ran = await next(e);
    if (!ran.deny)
      await touch($, e.file_path, lines(e.new_string), lines(e.old_string));
    return ran;
  });

  on("tool.call", { tool: "Write" }, async ($, e, next) => {
    const ran = await next(e);
    if (!ran.deny) await touch($, e.file_path, lines(e.content), 0);
    return ran;
  });

  on("turn.complete", async ($, e, next) => {
    const ran = await next(e);
    const paths = [...editedThisTurn];
    editedThisTurn.clear();
    if (!e.isAborted)
      void refresh($, paths, language).catch((error) =>
        $.ui.log(`explain-live: ${String(error)}`),
      );
    return ran;
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);
    const now = await read($, understanding);
    const files = await read($, touched);
    const sum = await read($, spend);
    const cwd = await $.session.cwd();
    const short = (path: string) =>
      path.startsWith(`${cwd}/`)
        ? path.slice(cwd.length + 1)
        : path.split("/").slice(-2).join("/");
    const recent = files.slice(-8);

    return (
      <Box flexDirection="column" paddingTop={1} paddingLeft={1}>
        {now.goal === null && files.length === 0 && <Text>{text.empty}</Text>}
        {now.goal && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>{text.goal}</Text>
            <Text> {now.goal}</Text>
          </Box>
        )}
        {now.approach.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>{text.approach}</Text>
            {now.approach.map((one) => (
              <Text> • {one}</Text>
            ))}
          </Box>
        )}
        {now.decisions.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>{text.decisions}</Text>
            {now.decisions.map((one) => (
              <Text>
                {one.by === "AI" ? (
                  <Text color="warning"> ⚑ </Text>
                ) : (
                  <Text> • </Text>
                )}
                <Text>{one.text}</Text>
              </Text>
            ))}
          </Box>
        )}
        {now.now && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>{text.now}</Text>
            <Text> {now.now}</Text>
          </Box>
        )}
        {now.options.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>{text.options}</Text>
            {now.options.map((one) => (
              <Text>
                {one.isRecommended ? (
                  <Text color="warning"> ★ </Text>
                ) : (
                  <Text> • </Text>
                )}
                <Text>{one.text}</Text>
              </Text>
            ))}
          </Box>
        )}
        {now.flow && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>
              {text.flow}: {now.flow.title}
            </Text>
            {now.flow.steps.map((step, index) => (
              <Box flexDirection="column" alignItems="flex-start">
                {index > 0 && <Text> ↓</Text>}
                <Box
                  borderStyle="round"
                  borderColor={step.isChanged ? "warning" : "inactive"}
                  paddingX={1}
                >
                  <Text>
                    <Text bold={step.isChanged}>{step.name}</Text>
                    <Text> {step.does}</Text>
                  </Text>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        {files.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>
              {text.files}
              {files.length > recent.length
                ? text.recent(recent.length, files.length)
                : ""}
            </Text>
            {recent.map((one) => (
              <Text>
                <Text> {short(one.path)} </Text>
                <Text color="success">+{one.added}</Text>
                <Text> </Text>
                <Text color="error">-{one.removed}</Text>
              </Text>
            ))}
          </Box>
        )}
        <Box marginBottom={1}>
          <Button
            hotkey="d"
            onPress={() =>
              $.command
                .run({ command: explainCommand })
                .catch((error) => $.ui.log(`explain-live: ${String(error)}`))
            }
          >
            {text.explain}
          </Button>
        </Box>
        {(now.decisions.some((one) => one.by === "AI") || now.flow) && (
          <Text>
            <Text color="warning">⚑</Text> {text.legend}
          </Text>
        )}
        {sum.forks > 0 && <Text>{text.spend(sum, kilo)}</Text>}
      </Box>
    );
  });
};
