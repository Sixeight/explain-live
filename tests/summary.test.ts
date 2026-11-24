import { describe, expect, test } from "bun:test";

import { ask, parse } from "../hooks/summary";
import type { Understanding } from "../types";

const EMPTY: Understanding = {
  goal: null,
  approach: [],
  decisions: [],
  now: null,
  options: [],
  flow: null,
};

describe("parse", () => {
  test("reads an English reply into the panel", () => {
    const reply = [
      "GOAL: Add a retry to the uploader",
      "APPROACH: Wrap the HTTP call",
      "DECISION: User | Retry at most 3 times",
      "DECISION: AI | Back off 200ms",
      "NOW: Waiting for review",
      "OPTION: Make it configurable | recommended",
      "OPTION: Hard-code it",
      "TITLE: Upload flow",
      "STEP: upload() | sends the file | changed",
      "STEP: http.post | does the request | -",
    ].join("\n");
    const got = parse(reply, EMPTY);
    expect(got.goal).toBe("Add a retry to the uploader");
    expect(got.decisions).toEqual([
      { by: "User", text: "Retry at most 3 times" },
      { by: "AI", text: "Back off 200ms" },
    ]);
    expect(got.options).toEqual([
      { text: "Make it configurable", isRecommended: true },
      { text: "Hard-code it", isRecommended: false },
    ]);
    expect(got.flow?.steps.map((s) => s.isChanged)).toEqual([true, false]);
  });

  test("reads a Japanese reply the same way", () => {
    const reply = [
      "GOAL: アップロードに再試行を足す",
      "DECISION: ユーザー | 最大 3 回",
      "OPTION: 設定にする | 推奨",
      "TITLE: なし",
    ].join("\n");
    const got = parse(reply, EMPTY);
    expect(got.decisions).toEqual([{ by: "User", text: "最大 3 回" }]);
    expect(got.options[0]?.isRecommended).toBe(true);
    expect(got.flow).toBeNull();
  });

  test("treats none as empty and keeps the previous goal", () => {
    const got = parse("GOAL: none\nNOW: none", { ...EMPTY, goal: "kept" });
    expect(got.goal).toBe("kept");
    expect(got.now).toBeNull();
  });
});

describe("ask", () => {
  test("names no person and follows the language", () => {
    expect(ask("en", EMPTY, [])).not.toContain("Tomohiro");
    expect(ask("ja", EMPTY, [])).not.toContain("Tomohiro");
    expect(ask("en", EMPTY, ["a.ts"])).toContain("a.ts");
    expect(ask("en", EMPTY, [])).toContain("GOAL:");
    expect(ask("ja", EMPTY, [])).toContain("コード");
  });
});
