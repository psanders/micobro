// Extends the standard Conventional Commits rules, plus two types this repo
// already uses in practice: `copy` (user-facing text changes) and `design`
// (Pencil/visual changes) — see CLAUDE.md § Commits.
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "copy",
        "design",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test"
      ]
    ]
  }
};
