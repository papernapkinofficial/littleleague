# AGENTS.md

## Repository Instructions for Codex

- Use the `playwright` skill whenever a task modifies the site UI or behavior (`index.html`, `style.css`, or any client-side JS).
- After making site changes, validate with Playwright before finalizing:
  - `npm run pw:test` for automated checks, or
  - `npm run pw:screenshot:file` for a quick visual verification of `index.html`.
- In your final response, briefly report which Playwright command you ran and the result.
- If the request is non-site work (docs, config-only, etc.), Playwright is optional.
