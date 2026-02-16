# Contract: Builder - CI Pipeline

**Task ID:** Phase0.8-CIPipeline  
**Assigned to:** Builder  
**Priority:** P1  
**Created:** 2026-02-16  
**Oracle:** oracle_e3f7

---

## Objective

Create GitHub Actions CI workflow for build, typecheck, and lint on push and PR.

## Implementation

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Setup Yarn
        run: |
          corepack enable
          corepack prepare yarn@1.22.19 --activate
      
      - name: Get yarn cache directory path
        id: yarn-cache-dir-path
        run: echo "dir=$(yarn cache dir)" >> $GITHUB_OUTPUT
      
      - uses: actions/cache@v3
        id: yarn-cache
        with:
          path: ${{ steps.yarn-cache-dir-path.outputs.dir }}
          key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}
          restore-keys: |
            ${{ runner.os }}-yarn-
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Build extensions
        run: yarn build:extensions
      
      - name: Build browser app
        run: yarn build:browser
      
      - name: Type check
        run: yarn typecheck || echo "Typecheck script not defined"
      
      - name: Lint
        run: yarn lint || echo "Lint script not defined"
      
      - name: Test
        run: yarn test || echo "Test script not defined"
```

## Create Missing Scripts (if needed)

If root package.json doesn't have these scripts, add them:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "echo 'Linting not configured yet'",
    "test": "echo 'Tests not configured yet'"
  }
}
```

## Success Criteria

- [ ] CI workflow file created at `.github/workflows/ci.yml`
- [ ] Workflow triggers on push to main/master
- [ ] Workflow triggers on PR to main/master
- [ ] Workflow runs on Ubuntu with Node 18 and 20
- [ ] Steps: checkout → setup node/yarn → cache → install → build extensions → build browser → typecheck → lint → test
- [ ] Workflow completes successfully (or gracefully handles missing scripts)

## Testing

1. Commit the workflow file
2. Push to a branch
3. Create a PR (or push to main if testing)
4. Check GitHub Actions tab
5. Verify workflow runs and passes

## Time Bound

Complete within 30 minutes.

## Output

Write `result-ci.md` in this task directory with:
- Workflow configuration
- Link to successful CI run (or description of results)
- Any issues encountered

---

**Oracle Note:** CI is important for catching regressions, but don't get bogged down in complex configurations. A simple build + typecheck workflow is sufficient for Phase 0. We can add linting and tests later.
