/**
 * Chinese titles for entries whose source content is written in English.
 * The `/zh` routes reuse the English entries, so the display title has to be
 * translated here instead of coming from frontmatter.
 */
const ZH_TITLES: Record<string, string> = {
  "advanced-postgresql-jsonb": "PostgreSQL 与 JSONB：关系型数据库的文档灵活性",
  "autonomous-ai-agents-2026": "自主 AI 智能体：2026 年构建软件的新方式",
  "docker-compose-best-practices":
    "2026 年的 Docker Compose：真正实用的最佳实践",
  "hidden-danger-of-open-source": "开源深处的隐藏危机",
  "modern-css-2026": "2026 年的现代 CSS：容器查询、:has() 与锚点定位",
  "react-19-new-apis":
    "React 19：useActionState、useOptimistic 与手动加载状态的终结",
  "rust-for-javascript-devs": "写给 JavaScript 开发者的 Rust：值得迈出的一步",
  "terminal-productivity-2026": "终端生产力：改变我工作流的工具",
  "typescript-5-new-features": "TypeScript 5.x：改变编码方式的特性",
  "urban-city-photography": "城市摄影：在喧嚣中寻找画面",
  "vibe-coding-new-era": "Vibe Coding：与 AI 一起以思维的速度编程",
  "urban-photography": "城市摄影 · 层叠之城",
};

const entryKey = (id: string) =>
  id
    .replace(/^(en|es|zh)\//, "")
    .replace(/\/index$/, "")
    .replace(/\.(md|mdx)$/, "");

export function getLocalizedTitle(
  id: string,
  title: string,
  locale: string
): string {
  if (locale !== "zh") return title;
  return ZH_TITLES[entryKey(id)] ?? title;
}
