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

### Allow release bot to push

Either:

- Add `github-actions[bot]` to bypass list for administrators (if you are the only admin), or
- Use a ruleset that permits the `Publish package to npmjs` workflow to push release commits, or
- Temporarily disable lock branch (recommended minimum).

## Environment — `npmjs`

| Rule | Intended value |
| --- | --- |
| Environment name | `npmjs` |
| Deployment branches | `main` only |
| Required reviewers | Owner preference (default: none; current: `tgoliveira11`) |

### Inspect environment

```bash
gh api repos/tgoliveira11/vault-core/environments/npmjs
```

### Approve a pending deployment (when reviewers are configured)

```bash
RUN_ID=<workflow-run-id>
ENV_ID=$(gh api repos/tgoliveira11/vault-core/environments/npmjs --jq .id)
gh api --method POST "repos/tgoliveira11/vault-core/actions/runs/${RUN_ID}/pending_deployments" \
  --input - <<EOF
{
  "environment_ids": [$ENV_ID],
  "comment": "Approve npm publish",
  "state": "approved"
}
EOF
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
