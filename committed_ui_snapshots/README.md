# Committed UI snapshots (push these PNGs to git)

## Where the comparison comes from

Playwright does **not** look in `test-results/` for golden images. It resolves baselines from your config:

```js
// playwright.config.js (this repo)
expect: {
  toHaveScreenshot: {
    pathTemplate:
      'committed_ui_snapshots/{testFilePath}/{arg}{-projectName}{-platform}{ext}',
  },
},
```

- **`{testFilePath}`** — path of the spec file **relative to `testDir`** (`tests/`). So files for `tests/TC04_properties.spec.js` live under `committed_ui_snapshots/TC04_properties.spec.js/`.
- **`{arg}`** — the snapshot name you pass to `toHaveScreenshot` (without the trailing extension in the template slot).
- **`{-projectName}{-platform}`** — e.g. `-chromium-win32` on Windows, `-chromium-linux` on Linux CI.

So after you generate baselines, you should **`git add committed_ui_snapshots/**/*.png`** and push. Anyone who clones the repo gets the same baselines; CI compares the live run to those files.

If those folders contain **no PNGs**, visual tests fail with missing snapshot / mismatch until someone runs `--update-snapshots` and commits the output.

## Expected layout (after `npm run snapshots:update-all`)

Paths are under `Playwright/Tailorbird_UI_Automation/committed_ui_snapshots/`:

| Spec file | Baseline PNGs (base name; platform suffix added by Playwright) |
|-----------|------------------------------------------------------------------|
| `TC01_login.spec.js` | `login-visual-01-email-step`, `login-visual-02-password-step`, `login-visual-03-after-failed-signin` |
| `TC02_menu.spec.js` | `menu-left-navbar-shell` |
| `TC03_manageOrganization.spec.js` | `organization-main-workspace` |
| `TC04_properties.spec.js` | `properties-main-workspace`, `properties-filter-drawer`, `properties-main-empty-state` |

Example on **Windows** (one file):

`committed_ui_snapshots/TC04_properties.spec.js/properties-main-workspace-chromium-win32.png`

On **Linux** CI, the same test produces `...-chromium-linux.png`. Commit the variant(s) that match where tests run, or generate snapshots **on the CI image** and commit those too.

## One-time (or after UI changes): generate baselines locally

From `Tailorbird_UI_Automation`:

```bash
npm run snapshots:update-all
```

Or manually:

```bash
npx playwright test tests/TC01_login.spec.js tests/TC02_menu.spec.js tests/TC03_manageOrganization.spec.js tests/TC04_properties.spec.js -g "Full login regression|TC02-vis-01|TC03-vis-01|TC04-reg-bundle" --workers=1 --update-snapshots
```

Then verify and commit:

```bash
git status committed_ui_snapshots
git add committed_ui_snapshots/
git commit -m "chore(e2e): refresh Playwright UI snapshot baselines"
```

## `mcp_reference_crosscheck/`

Optional **manual** MCP captures for eyeballing against the app. **Tests do not read this folder.**

Do not move baseline PNGs out of `committed_ui_snapshots/<spec-file>/` or `pathTemplate` will not find them.
