# GitHub repository settings

Settings that live on GitHub, not in git. Apply with the GitHub UI or `gh` CLI. Document the **intended** state here; verify after changes.

Repository: `tgoliveira11/vault-core`

## Branch protection — `main`

| Rule | Intended value |
| --- | --- |
| Require pull request | Yes |
| Required status checks | `validate`, `branch-name` (strict / up to date) |
| Require linear history | Yes |
| Allow force pushes | No |
| Allow deletions | No |
| **Lock branch** | **Off** — publish workflow must push release metadata |

> **Current note (2026-06-29):** API reports `lock_branch: true` on `main`. The publish workflow succeeded once, but **lock branch should be disabled** so `github-actions[bot]` can push release commits reliably. Disable in **Settings → Branches → main → Lock branch**.

### Inspect current protection

```bash
gh api repos/tgoliveira11/vault-core/branches/main/protection
```

### Example: enable required checks (adjust check names to match workflow job names)

Required check contexts must match the **job names** in `.github/workflows/validate.yml`:

- `validate`
- `branch-name`

Configure in **Settings → Branches → Branch protection rules → main → Require status checks to pass**.

If checks do not appear in the UI, open a PR once so GitHub registers the workflows.

### Allow release bot to update `main`

Classic branch protection on this repo requires a **pull request** before merging (`required_approving_review_count: 0`, so no human approval is needed). There is **no** “bypass actors” option in the classic UI for personal repos — use one of:

1. **Recommended (automated):** the publish workflow opens a `chore/release-X.Y.Z-metadata` PR and squash-merges it when metadata changes.
2. **Optional GitHub setting:** **Settings → Actions → General → Workflow permissions** → enable **Allow GitHub Actions to create and approve pull requests** if automated `gh pr merge` is blocked.
3. **Rulesets (if available on your plan):** add a repository ruleset with bypass for `GitHub Actions` — not required when (1) works.

## Environment — `npmjs`

| Rule | Intended value |
| --- | --- |
| Environment name | `npmjs` |
| Deployment branches | `main` only |
| Required reviewers | **None** — publish runs immediately on `workflow_dispatch` |

### Inspect environment

```bash
gh api repos/tgoliveira11/vault-core/environments/npmjs
```

### Restrict deployments to `main`

**Settings → Environments → npmjs → Deployment branches → Selected branches → `main`**

## npm registry — trusted publisher

Configure at [npmjs.com](https://www.npmjs.com/) → package `@tgoliveira/vault-core` → **Publishing access** → **GitHub Actions**:

| Field | Value |
| --- | --- |
| Organization/user | `tgoliveira11` |
| Repository | `vault-core` |
| Workflow filename | `publish-vault-core.yml` |
| Environment | `npmjs` |

After OIDC works, remove legacy token publishing if still enabled.

## Optional (not configured by default)

- **CODEOWNERS** — automatic review routing
- **Required reviewers** on `npmjs` — human gate before every publish
- **Rulesets** — alternative to classic branch protection

Request these explicitly if you want them added.

## Verification checklist

```bash
# Branch protection summary
gh api repos/tgoliveira11/vault-core/branches/main/protection \
  --jq '{linear: .required_linear_history.enabled, force: .allow_force_pushes.enabled, lock: .lock_branch.enabled}'

# Environment
gh api repos/tgoliveira11/vault-core/environments/npmjs --jq '{name, reviewers: .protection_rules}'

# Latest published version
npm view @tgoliveira/vault-core version

# Latest release tag
gh release list --limit 3
```
