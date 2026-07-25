// semantic-release config, run on every push to main (see
// .github/workflows/release.yml). Derives the next version from Conventional
// Commits since the last vX.Y.Z tag, bumps package.json, writes
// CHANGELOG.md, and publishes a GitHub Release. package.json is `private`,
// so @semantic-release/npm only touches the version field — nothing is
// published to the npm registry.
//
// `copy` and `design` are non-standard types this repo already commits with
// (see CLAUDE.md § Commits). Historically they've warranted a real release
// (e.g. 9c46247 "design(pencil): ..." shipped as v0.2.1), so both are wired
// as patch-level releases here instead of being silently dropped.
module.exports = {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "copy", release: "patch" },
          { type: "design", release: "patch" }
        ]
      }
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            { type: "feat", section: "Features" },
            { type: "fix", section: "Bug Fixes" },
            { type: "copy", section: "Copy" },
            { type: "design", section: "Design" },
            { type: "perf", section: "Performance" },
            { type: "revert", section: "Reverts" },
            { type: "refactor", section: "Code Refactoring" },
            { type: "docs", section: "Docs", hidden: true },
            { type: "style", section: "Styles", hidden: true },
            { type: "chore", section: "Chores", hidden: true },
            { type: "test", section: "Tests", hidden: true },
            { type: "build", section: "Build System", hidden: true },
            { type: "ci", section: "Continuous Integration", hidden: true }
          ]
        }
      }
    ],
    "@semantic-release/changelog",
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "package-lock.json", "CHANGELOG.md"],
        message: "chore(release): v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
};
