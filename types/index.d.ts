export type Step = { name: string; does: string; isChanged: boolean };
export type Flow = { title: string; steps: Step[] };
export type Decision = { by: "AI" | "User"; text: string };
export type Option = { text: string; isRecommended: boolean };
export type Understanding = {
  goal: string | null;
  approach: string[];
  decisions: Decision[];
  now: string | null;
  options: Option[];
  flow: Flow | null;
};
export type Touched = { path: string; added: number; removed: number };
export type Spend = {
  forks: number;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  effort: string | null;
};

declare module "claude-code" {
  interface PluginState {
    "explain-live": {
      understanding: Shaped<Understanding>;
      touched: Shaped<Touched[]>;
      spend: Shaped<Spend>;
    };
  }
}
