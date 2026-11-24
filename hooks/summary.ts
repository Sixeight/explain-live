import type { Decision, Flow, Option, Step, Understanding } from "../types";

export type Language = "en" | "ja";

export const languageOf = (value: unknown): Language =>
  value === "ja" ? "ja" : "en";

const previous = (now: Understanding, language: Language) => {
  const none = language === "ja" ? "なし" : "none";
  const recommended = language === "ja" ? "推奨" : "recommended";
  return [
    `GOAL: ${now.goal ?? none}`,
    ...now.approach.map((one) => `APPROACH: ${one}`),
    ...now.decisions.map(
      (one) =>
        `DECISION: ${one.by === "User" ? (language === "ja" ? "ユーザー" : "User") : "AI"} | ${one.text}`,
    ),
    `NOW: ${now.now ?? none}`,
    ...now.options.map(
      (one) =>
        `OPTION: ${one.text}${one.isRecommended ? ` | ${recommended}` : ""}`,
    ),
  ].join("\n");
};

const PROMPT = {
  en: (
    now: string,
    paths: string,
  ) => `You have no tools. Answer right away without deliberating.

Rewrite the side panel so a user who has not read the code can see at a glance what is happening in this session. Update the previous panel to match the conversation so far.

Previous panel:
${now}

Files edited in this reply: ${paths}

Return only lines in the format below. No preface, decoration, or code quotes. Keep every line within 60 characters (OPTION within 90).
GOAL: what this session is trying to achieve (1 line)
APPROACH: how the work and edits are being done (1-4 lines; rewrite when the approach changes)
DECISION: AI or User | what was decided (only decisions that still hold, most important first, at most 6 lines; mark a decision the user did not ask for as AI)
NOW: what is happening now, or what is being waited on (1 line)
OPTION: one choice per line that the reply asked the user to pick, written out in full, never as a label alone. Append " | recommended" to the recommended one (only undecided ones, at most 4 lines; remove once decided)
TITLE: if the edited files call each other, the name of that flow (within 30 characters); otherwise "none"
STEP: function or file name | what this step does (within 30 characters) | "changed" if this reply changed the step, otherwise "-" (only with a TITLE; 3-6 lines in call order)`,
  ja: (
    now: string,
    paths: string,
  ) => `ツールは使えない。考え込まずにすぐ答える。

コードをまだ読んでいないユーザーが、このセッションで何が起きているかを横のパネルで一目で掴めるようにする。前回のパネルの内容を、ここまでの会話に合わせて書き直す。

前回のパネル:
${now}

この返答で編集したファイル: ${paths}

次の形式の行だけを返す。前置き、装飾、コードの引用は書かない。どの行も 40 字以内（OPTION は 60 字以内）。
GOAL: このセッションで達成しようとしていること（1 行）
APPROACH: どういう方針で作業・編集しているか（1〜4 行。方針が変わったら書き換える）
DECISION: AI またはユーザー | 決まったこと（いま有効なものだけ、重要な順に最大 6 行。ユーザーの指示になく AI が自分で決めたものは AI）
NOW: いま何をしているか、または何を待っているか（1 行）
OPTION: 返答でユーザーに選んでほしいと出した選択肢を 1 行に 1 つ。「選択肢の中身（ラベルだけにしない）」。推奨は末尾に「 | 推奨」（未決のものだけ、最大 4 行。決まったら消す）
TITLE: 編集したファイルが呼び合うなら、その処理の流れ（20 字以内）。そうでなければ「なし」
STEP: 関数名またはファイル名 | その段で何をするか（15 字以内） | この返答で変えた段なら「変更」、でなければ「-」（TITLE があるときだけ、呼ばれる順に 3〜6 行）`,
};

export const ask = (
  language: Language,
  now: Understanding,
  paths: string[],
): string =>
  PROMPT[language](
    previous(now, language),
    paths.length === 0
      ? language === "ja"
        ? "なし"
        : "none"
      : paths.join(", "),
  );

const EMPTY_VALUES = new Set(["", "なし", "none"]);

const values = (text: string, key: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`${key}:`))
    .map((line) => line.slice(key.length + 1).trim())
    .filter((value) => !EMPTY_VALUES.has(value.toLowerCase()));

const isUser = (by: string | undefined) => by === "User" || by === "ユーザー";

export const parse = (text: string, before: Understanding): Understanding => {
  const decisions: Decision[] = values(text, "DECISION").map((value) => {
    const [by, ...rest] = value.split("|");
    return {
      by: isUser(by?.trim()) ? "User" : "AI",
      text: rest.join("|").trim(),
    };
  });
  const steps: Step[] = values(text, "STEP")
    .map((value) => value.split("|").map((part) => part.trim()))
    .map(([name, does, mark]) => ({
      name: name ?? "",
      does: does ?? "",
      isChanged: mark === "changed" || mark === "変更",
    }))
    .filter((step) => step.name !== "");
  const title = values(text, "TITLE")[0];
  const flow: Flow | null =
    title && steps.length >= 2 ? { title, steps } : before.flow;
  return {
    goal: values(text, "GOAL")[0] ?? before.goal,
    approach: values(text, "APPROACH").slice(0, 4),
    decisions: decisions.filter((one) => one.text !== "").slice(0, 6),
    now: values(text, "NOW")[0] ?? null,
    options: values(text, "OPTION")
      .map((value): Option => {
        const [text, mark] = value.split("|").map((part) => part.trim());
        return {
          text: text ?? "",
          isRecommended: mark === "recommended" || mark === "推奨",
        };
      })
      .filter((one) => one.text !== "")
      .slice(0, 4),
    flow,
  };
};
