# Challenge: make automations work through chat

## The problem

Our automation builder is too hard to start with.

To create one rule you pick a trigger, pick an app from a dialog, fill in a form,
add the next step, fill in another form. There are 51 config sections. Most people
open it, look at the empty canvas, and leave.

![The builder today](docs/screenshots/builder-with-assistant-dock.jpg)

There is an assistant, but it is a narrow strip you only see if you click **Ask
AI**. It fights the canvas and the settings panel for space. Chat is an add-on to
a form product.

## The task

Flip it. **You describe what you want, chat builds it.**

- Chat is how you create an automation.
- The nodes stay, but only for **editing afterwards** — to check what was built
  and change a detail. Never to create from scratch.
- Fewer settings on screen. The agent asks for what it needs; it does not show
  you every field.

## What good looks like

The screenshots in [`docs/reference/`](docs/reference/) are the bar. Match the
feel, not the pixels.

### Ask, don't assume

The agent asks the few things it can't work out, as a card in the chat. Options
with a recommended default, or a text box. Never a settings form.

![Inline clarifying question](docs/reference/01-clarifying-question.png)

![Second question and the writing status](docs/reference/02-second-question-and-writing.png)

![Free-text question](docs/reference/04-freetext-question.png)

If the answer is still vague, it asks again instead of guessing.

### Show the work

Thinking is collapsed but openable. Tool calls appear as steps you can expand,
with real results — not a spinner.

![Tool calls with results and a progress checklist](docs/reference/05-tool-progress.png)

### Give a real answer

A proper written result, with follow-up suggestions you can click.

![Answer with follow-up suggestions](docs/reference/03-answer-and-followups.png)

Long output opens as a document beside the chat, not a wall of text in it.

![Document card and split view](docs/reference/06-document-card-and-split-view.jpg)

![Summary with the document open](docs/reference/07-summary-and-split-document.jpg)

[`sample-output-document.md`](docs/reference/sample-output-document.md) is a real
example of the writing quality.

### Then manage it

Saved automations become simple rows: schedule in plain words, paused state, and
anything blocking them shown right there.

![Automations list](docs/reference/09-automations-tab-list.jpg)

![Empty state with starter suggestions](docs/reference/08-automations-tab-empty.jpg)

## Rules

- The chat must save a **real automation**, using the trigger/filter/action
  structure already in the repo. `automation-context.tsx` still owns it.
- Keep a way to see and edit the steps after they're built. A panel, a tab, the
  existing canvas — your call.
- Save, run, rename and activate keep working.

## The backend

There is no model here. `/api/automation-assistant/stream` and `/api/chat/*` are
served by a mock in `app/api/[...path]/route.ts`.

Either is fine:

1. **Script it** — a fake responder that emits the thinking, tool-call, question
   and answer events. Repo stays runnable with no keys.
2. **Plug in a real model** behind an env var, still runnable without one.

We're judging the design, not the model.

## Where to start

| Thing | File |
| --- | --- |
| The page | `app/(dashboard)/automation/page.tsx` |
| The assistant today | `app/(dashboard)/automation/components/assistant-panel.tsx` |
| Assistant state | `app/(dashboard)/automation/hooks/use-automation-assistant.ts` |
| Stream events | `lib/chat/types.ts`, `lib/chat/sse.ts` |
| Assistant → steps | `app/(dashboard)/automation/lib/assistant-step-order.ts` |
| Flow state, save, run | `app/(dashboard)/automation/contexts/automation-context.tsx` |
| The automations list | `app/(dashboard)/automation/components/automations-table.tsx` |
| Available steps | `app/(dashboard)/automation/lib/automation-registry.ts` |
| Canvas and node card | `.../components/flow-builder.tsx`, `.../components/flow-node.tsx` |

Use `upsertAssistantNodeInFlow` in `assistant-step-order.ts` to add steps. Don't
open a second path into the flow state.

## How we'll judge it

1. **Can someone build a working automation just by talking?**
2. **Is it simpler than what we have now?**
3. **Can you trust it** — see what it did and fix it after?
4. **Is the code clean?** Typed, small components, no `any`.

Do a narrow slice well rather than all of it badly. Tell us what you skipped.

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
pnpm build
```

No env vars, no database, no accounts. `README.md` says what's real and what's
mocked — read it before assuming something is broken.
