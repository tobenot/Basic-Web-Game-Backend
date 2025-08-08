## Template Migration Guide

This repository is used as a Git template. Projects may selectively copy updates.

### Controlled (safe-to-overwrite) areas
- `.github/`
- `scripts/`
- `src/framework/`
- `src/server.ts` (only the marked template blocks)
- `tsconfig.json`
- `vercel.json`
- Documentation files: `README.md`, `CONFIGURATION.md`, `CORS_GUIDE.md`, `CORS_SOLUTION_SUMMARY.md`

Business-specific code should live outside these areas (e.g. `src/app/**`, `src/modules/**`).

### Updating from template
- Preview changes:
  ```bash
  bash scripts/update-from-template.sh            # latest
  bash scripts/update-from-template.sh vX.Y.Z     # specific tag
  ```
- Apply with backup:
  ```bash
  APPLY=1 bash scripts/update-from-template.sh vX.Y.Z
  ```
  Backups are stored in `.template-backup/vX.Y.Z/`.

- The current project records template source in `template.lock`.

### Editing template-controlled code in a project
If you need to modify controlled areas for a project, prefer sending changes back to the template and then updating via the script. A non-blocking pre-commit hook will remind you when you modify controlled paths.

### Template blocks in files
For files like `src/server.ts`, only the code inside the `// <template:...>` blocks is intended to be overwritten by template updates. Avoid custom edits within these blocks.