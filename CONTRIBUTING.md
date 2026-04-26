# Contributing to Lighthouse

We are unapologetically eager to merge small, well-scoped contributions.

## Add a merchant rule (5-minute PR)

Lighthouse normalizes merchant names by walking a hand-curated rule set first, then falling back to an LLM. The rule set lives in [`packages/core/src/domain/merchant_rules.ts`](./packages/core/src/domain/merchant_rules.ts). To add a merchant:

1. Find the right category section (or create a new one).
2. Add a row:

   ```ts
   { canonical: 'klaviyo', display: 'Klaviyo', category: 'developer',
     domains: ['klaviyo.com'], aliasPatterns: [/^klaviyo\b/i] },
   ```
3. `npm run lint` and `npm run test` should both pass.
4. Open a PR. There's no review queue — we'll merge anything reasonable.

**Naming**

- `canonical`: lowercase, kebab-case slug. Used as the primary key in the DB.
- `display`: the form a user would recognize on a card statement.
- `category`: one of `shopping | groceries | food | streaming | productivity | developer | fitness | transit | travel | payments | utilities | cloud | news | apps | other`. Pick the closest match.

**Domain match wins**

If a rule provides a `domains` list, an email from any matching domain → that merchant, even if the name itself doesn't match. Aliases are a fallback for descriptors like card-statement strings.

## Improve a prompt

Prompts live in:
- `packages/core/src/llm/extractors/classifier.ts`
- `packages/core/src/llm/extractors/receipt.ts`
- `packages/core/src/llm/extractors/subscription.ts`
- `packages/core/src/domain/normalize.ts`

If you find an email type that's misclassified or extracted wrong:

1. Capture a redacted copy of the email body.
2. Run the pipeline against just that email (`scripts/replay-one.ts` is on the roadmap; for now you can paste the body into a manual `runStructured()` call in a test file).
3. Adjust the system prompt or schema. Prefer adding examples to changing rules.

## Add a test

Tests live in `test/` and use Vitest. Side-effecting tests should set `LIGHTHOUSE_HOME` to a tmpdir so they can't clobber a real install. See `test/vault.test.ts` for the pattern.

## Code style

- TypeScript strict mode. No `any` without a comment.
- Files under 300 lines. If you go over, split.
- Use the Edit tool / your editor's autofix to keep imports tidy.
- `npm run format` runs Prettier; `npm run lint` runs ESLint.

## Pre-push checks

`simple-git-hooks` is wired into the repo. After `npm install`, two hooks run automatically:

| Hook | When | What it runs |
| --- | --- | --- |
| `pre-commit` | Every `git commit` | `npm run check:fast` (typecheck + lint) |
| `pre-push` | Every `git push` | `npm run check` (typecheck + lint + test + build) |

The two manual scripts:

```bash
npm run check:fast   # typecheck + lint — runs in seconds
npm run check        # full CI gauntlet — typecheck + lint + test + build
```

If you skip the hooks (`git push --no-verify`), CI will catch you. Better to run `npm run check` once locally than to chase a red checkmark on GitHub.

## Commits and PRs

- Squash-merge style. Keep your commit history tidy on your branch.
- One logical change per PR. If you find yourself writing "and also...", split.
- Mention the issue number if there is one.

## Code of conduct

Be kind. Disagree with ideas, not with people. Assume the other contributor is acting in good faith.
