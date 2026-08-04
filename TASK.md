# Challenge: turn the automation builder into a chat-first agent

## What exists today

This repo ships a node-based rules builder. Pick a trigger, add filters and
actions, fill in a form per step, save, run.

![The builder today: sidebar, canvas, step settings, and the assistant squeezed into a side dock](docs/screenshots/builder-with-assistant-dock.jpg)

There is already an assistant, and that screenshot is the problem. It is a ~320px
strip that only appears if you click **Ask AI**, competing for width with the
canvas and the step settings. Chat is bolted onto a form-driven product.

## What to build

Rebuild the experience so **chat is the product**: you describe recurring work in
plain language, an agent asks what it genuinely needs to know, does the work
visibly, and produces something worth reading.

The screenshots in [`docs/reference/`](docs/reference/) are the target. Study them
before designing anything — the detail in them *is* the specification.

## 1. The conversation

The whole surface is a conversation: task list on the left, transcript in the
middle. Reasoning, tool calls and questions all land inline, in order.

![The conversation with reasoning, tool calls and a clarifying card](docs/reference/01-clarifying-question.png)

**Reasoning, collapsed by default.** `> Thought for 3.0s` rows the user can
expand, several per turn, interleaved with the work — not one block up front.

**Tool calls as inline, expandable steps.** `Pulling your brand list…` with a
completion tick, expandable to its result, and results rendered richly: an entity
chip with a link-out, or a strip of ad thumbnails streaming in as they are
fetched. The user should be able to watch the agent work and audit what it
actually looked at.

![Tool calls streaming image results, with a Step 1/3 progress checklist](docs/reference/05-tool-progress.png)

**Clarifying questions as inline cards — the centrepiece.** When the agent needs
a decision it does not guess. It renders a card in the transcript with:

- the question as a heading, and a sentence on *why* it is asking
- radio options, each with a one-line explanation, one marked **(Recommended)**
- an optional free-text box for a custom answer
- **Skip** and **Next / Confirm**
- `Step 1 of 2` pagination with arrows when questions are batched

![Step 2 of 2, and the Writing / Polishing status](docs/reference/02-second-question-and-writing.png)

Some cards take free text instead of options — and the agent notices when an
answer is still a placeholder and asks again rather than proceeding:

![A clarifying card taking free text](docs/reference/04-freetext-question.png)

The bar: ask only when the answer changes what gets built, and never silently
assume.

**A status that names the phase.** `Writing · Polishing`, not a spinner. A
`Step 1/3` checklist with named stages for long work.

## 2. The output

![The finished answer, feedback row, and follow-up suggestion cards](docs/reference/03-answer-and-followups.png)

**The reply is a real document.** Headings, bullets, bold, tables, an emoji
callout for a caveat worth noticing. Reference 3 flags a timezone gotcha the user
never asked about — surfacing consequences unprompted is the point.

**Long output becomes an artifact, not a wall of chat.** A titled card lands in
the transcript; clicking it opens the document in a split right-hand pane with
share, export and close.

![Document card and split view](docs/reference/06-document-card-and-split-view.jpg)
![Summary with the document open alongside](docs/reference/07-summary-and-split-document.jpg)

The chat keeps a TL;DR and anything needing confirmation; the pane holds the full
piece. [`sample-output-document.md`](docs/reference/sample-output-document.md) is
a real generated briefing — that is the quality bar. Note how it states its
coverage window, flags ambiguity it could not resolve, and lists its own data
gaps.

**Follow-up suggestions as cards.** Three specific next moves (`Fix timezone
issue`, `Add Slack delivery`, `Turn insights into creatives`), dismissible, each
prefilling the composer. Generic prompts are worse than none.

**Feedback.** A quiet `Was this answer helpful?` with thumbs.

## 3. Automations as living things

![The Automations tab with no active runs](docs/reference/08-automations-tab-empty.jpg)
![A saved automation with a blocking requirement](docs/reference/09-automations-tab-list.jpg)

An automation created in chat becomes a row you can manage:

- `Active` / `Inactive` tabs with counts, and a `Created by me` filter
- schedule in plain words — `At 10:00, only on Monday`
- state chips (`Paused`) and **blocking requirements surfaced on the row**: the
  amber `Select a brand` pill means this rule cannot run until it is answered.
  Resolve it inline, not by hunting through a settings form.
- starter suggestions when the list is empty
- a task list showing runs, including `Needs Input` when one is blocked on a
  question

## What still has to be true

The chat must produce a **real, saved automation** — not a transcript.

- Every conversation resolves to a saved flow with the trigger/filter/action
  structure this repo already models. `automation-context.tsx` still owns it.
- Steps stay inspectable. Keep the node view as a secondary surface — a panel, a
  tab, a "show the flow" affordance, your call — so a user can see and hand-edit
  exactly what will run. Chat replaces the *primary* path, not the ability to
  verify.
- Saving, running, renaming, activating and the templates keep working.

## The backend

There is no model in this repo. `/api/automation-assistant/stream` and
`/api/chat/*` are served by the catch-all mock in `app/api/[...path]/route.ts`.

Either route is fine:

1. **Script it.** Implement the streaming endpoint with a scripted or rule-based
   responder emitting the reasoning, tool-call, question-card, artifact and answer
   events. Keeps the repo runnable with no keys.
2. **Wire a real model** behind an env var, still runnable without one.

The interaction design is what is judged, not the model.

## Where to start

| Thing | File |
| --- | --- |
| Page shell, view switching, assistant mounting | `app/(dashboard)/automation/page.tsx` |
| The assistant panel as it exists now | `app/(dashboard)/automation/components/assistant-panel.tsx` |
| Assistant state and stream consumption | `app/(dashboard)/automation/hooks/use-automation-assistant.ts` |
| Stream event types | `lib/chat/types.ts`, `lib/chat/sse.ts` |
| How the assistant writes steps into the flow | `app/(dashboard)/automation/lib/assistant-canvas.ts`, `.../assistant-step-order.ts` |
| Flow state, save, run | `app/(dashboard)/automation/contexts/automation-context.tsx` |
| The automations list | `app/(dashboard)/automation/components/automations-table.tsx` |
| What a step can be | `app/(dashboard)/automation/lib/automation-registry.ts` |
| Canvas and node card, if you keep them | `.../components/flow-builder.tsx`, `.../components/flow-node.tsx` |

`upsertAssistantNodeInFlow` in `assistant-step-order.ts` is the existing seam for
"the assistant produced a step" — start there rather than opening a second path
into the flow state.

## How it will be judged

1. **Does the clarifying loop work end to end?** A vague request becomes a correct
   automation through questions, not guesses.
2. **Can you trust it?** Reasoning, tool calls and resulting steps are all
   inspectable, and the agent admits what it could not resolve.
3. **Does the output earn a split pane?** Compare yours to the sample document.
4. **Does it feel like an agent working**, or a form with a chat skin?
5. **Is the code something you would keep?** Follow what is here: typed, small
   components, no `any`.

Scope honestly. A narrow slice done properly beats all of it done thinly — say
what you cut and why.

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
pnpm build
```

No environment variables, no database, no accounts. Read `README.md` for what is
real in this repo and what is stubbed before assuming something is broken.
