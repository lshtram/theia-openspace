# Validation Contract: Phase 0 Scaffold

**Task ID:** Phase0-Validation  
**Assigned to:** Janitor  
**Created:** 2026-02-16  
**Oracle:** oracle_e3f7

---

## Objective

Validate that Phase 0 scaffold implementation meets all success criteria and that the project is in a good state to proceed to Phase 1.

## Phase 0 Summary

Phase 0 implemented 8 tasks:
1. Theia version research (1.68.2 pinned)
2. Monorepo scaffold (Yarn workspaces)
3. Extension stubs (6 extensions)
4. Browser app target (buildable)
5. Feature filtering (Debug/SCM/Notebook removed)
6. Custom branding (title, CSS, favicon)
7. AI chat panel (echo agent works)
8. CI pipeline (GitHub Actions workflow)

## Validation Requirements

### Build Validation
- [ ] `yarn install` completes without errors
- [ ] `yarn build:extensions` compiles all 6 extensions
- [ ] `yarn build:browser` generates browser-app/lib and src-gen
- [ ] No TypeScript compilation errors

### Runtime Validation
- [ ] `yarn start:browser` launches Theia at http://localhost:3000
- [ ] Browser tab shows "Theia Openspace" title
- [ ] All 6 extension modules load (check console for "[OpenSpace*] module loaded")

### Feature Validation
- [ ] Chat panel icon visible in sidebar
- [ ] Chat panel opens when clicked
- [ ] Typing message and pressing Enter sends it
- [ ] Echo response appears
- [ ] Debug panel NOT visible in sidebar
- [ ] SCM/Git panel NOT visible in sidebar

### CI Validation
- [ ] `.github/workflows/ci.yml` exists and is valid YAML
- [ ] Workflow has correct triggers (push, PR)
- [ ] Workflow has build steps

### Restriction Validation (NEW - CRITICAL)
- [ ] No files in `/Users/Shared/dev/opencode/` have been modified
- [ ] No files in Theia's node_modules have been patched/modified
- [ ] All extensions use proper Theia extension APIs (not monkey-patching)

## Method

1. Run validation commands
2. Take browser snapshots if needed
3. Check console output for evidence
4. Verify no unauthorized modifications

## Output

Write `validation_result.md` in this task directory with:
- Validation results for each criterion
- PASS/FAIL for each
- Any issues found
- Recommendation: PROCEED / FIX / BLOCK

---

**Oracle Note:** This validation is critical before proceeding to Phase 1. The two new restrictions (never modify opencode server, never modify Theia core) must be enforced throughout the project lifecycle.
