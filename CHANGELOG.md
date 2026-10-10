# Changelog

## 0.1.3 - 2026-10-10

- Made the learning directory follow top-level folders under `01 知识库`, including empty folders.
- Included ordinary Markdown files without Study Club frontmatter.
- Grouped directory entries by their physical folder path.
- Repainted the open learning directory after file and folder changes.

## 0.1.2 - 2026-10-10

- Added an overdue-first review queue with progress and next-review dates.
- Added Space to reveal answers and number keys 1-4 for grading.
- Requeued "Again" cards within the current session and added one-step undo.
- Made legacy-folder migration repair absolute wiki links independently of Obsidian settings.
- Removed recognizable generated `学习目录.md` files during legacy migration.

## 0.1.1 - 2026-10-10

- Fixed the learning directory to read only from `01 知识库`.
- Unified new notes, questions, JSON imports, and adopted Markdown under `01 知识库`.
- Added a collision-safe command to migrate the legacy `Study Club` folder.
- Removed the generated static `学习目录.md`; directories now update from live Markdown files.
- Scoped the bundled Dataview queries to `01 知识库`.
