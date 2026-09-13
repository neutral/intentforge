# Develop one change

[Start the selected environment](setup.md) and open its landing page. Confirm the
workspace shown there. Choose a small change, read the project's agent
instructions, and identify its verification commands. Authenticate the selected
environment before asking a Worker to act.
Use the container name reported by `intentforge status` in the commands below.
`intentforge-example` is a placeholder for that selected container.

## Read and author context

Open **Intent** for applicable software definitions, Descriptions, and Checks.
Open **Atlas** for useful decisions, questions, and granted sources. Directors
and Workers use each product's own browser or tools directly.

In Atlas, start with the relevant Map's question and read the Points that answer
it. Follow references when primary detail matters. A Point's state distinguishes
current assertions, proposals, open questions, and historical context. Structural
validation does not establish the truth of a claim or read its external sources.
When a reference leads to Intent, read the current assembled Intent definition.
The [Atlas operating guide](https://github.com/neutral/atlas/blob/main/spec/OPERATING.md)
describes this reading sequence and source boundaries.

A project without a collection opens the product's initialization flow. Choose
its scope, inspect the proposed files, and apply only the reviewed result. For
Intent, select the name, owners, and implementation roots; an empty implementation
scope is valid. For Atlas, confirm the selected collection and source grants.
Opening either product alone does not create authored files.

For existing knowledge, prepare changes and review the complete original and
proposed text before applying. If source changed after preparation, the product
refuses a stale write. Inspect the new source and prepare again. After restart,
review a recovered draft before applying it.

Define one useful promise and a Check that could expose a plausible wrong
implementation. Use a Description to connect that meaning to code. Add Atlas
context when a decision or source helps answer a recurring question. Intent
Checks define what to assess; the Worker and project tools perform the assessment.

Before authoring Intent, discover its installed guidance and read the common and
relevant kind guides. Select optional families from that discovery when useful.
The [authoring guidance](https://github.com/neutral/intent/blob/main/spec/GUIDANCE.md)
and [Check review guide](https://github.com/neutral/intent/blob/main/spec/guidance/check-review.md)
are also available in the Intent repository. Read the guidance installed in the
selected environment:

```sh
docker exec intentforge-example /opt/intent/bin/intent guidance
docker exec intentforge-example /opt/intent/bin/intent guidance GUIDANCE.md
docker exec intentforge-example /opt/intent/bin/intent guidance guidance/check.md
```

For an existing Check, discover its actual ID in the browser or with `intent query`
and substitute it for `CHECK_ID`:

```sh
docker exec intentforge-example /opt/intent/bin/intent read-check /workspace CHECK_ID --json
```

This reading includes the full definition, global subjects and evidence kinds,
directly supported current Knowledge, diagnostics, and limits. The Markdown file
alone omits some of that meaning. Read additional design context separately.
MCP users inspect the project, discover the ID with `intent_query`, and use
`intent_read_check`; `intent_guidance` supplies the same authoring guides.
The [Intent consumer guide](https://github.com/neutral/intent/blob/main/docs/using-intent.md#give-the-director-and-worker-the-complete-definition)
owns the complete referral procedure.

## Give a Worker a Direction

Open **Work**, create a Direction with a concrete goal, and add useful concerns or
references to its checklist. Creation saves the Direction. Explicit STEER starts
its Worker. Include the project guidance, applicable knowledge, and the requested
verification in the instruction. Supply selected definition IDs and paths that
exist inside the container. Ask the Worker to record which definitions it consumed,
assess their criteria, and keep actual verification results in the implementation
area. Propose a precise definition improvement when inspection exposes an ambiguity;
do not weaken a current promise to make a failing implementation pass.

If native policy needs explicit selection, read the
[per-Worker setup](setup.md#select-native-policy-for-a-fresh-worker) before dispatch.
The same Direction operations are available through Docker:

```sh
docker exec intentforge-example /opt/forge/bin/forge init \
  --direction /workspace/.forge/directions/change --workspace /workspace \
  --text 'Implement the selected change. Read project guidance and applicable Checks. Verify the result and record useful PROGRESS.'
docker exec intentforge-example /opt/forge/bin/forge steer \
  --direction /workspace/.forge/directions/change --fresh \
  --text 'Read your Direction, inspect the repository, and begin the change.'
```

`--fresh` explicitly selects a new Worker and retains earlier accounts and their
attribution. It does not stop the earlier Worker; stop that Worker separately
before changing the selection when it should cease work. Each Worker has its own
Direction. The Director chooses how independent Directions share the workspace.

## Inspect and steer

Read stored PROGRESS in Work. Reading it does not invoke a Worker. Send follow-up
STEER when context changes or an account is useful:

```sh
docker exec intentforge-example /opt/forge/bin/forge progress \
  --direction /workspace/.forge/directions/change --latest
docker exec intentforge-example /opt/forge/bin/forge steer \
  --direction /workspace/.forge/directions/change \
  --text 'Explain the remaining concerns and record PROGRESS.'
```

Follow-up STEER uses the saved Worker. An unusable conversation returns an error;
choose a fresh Worker explicitly if needed. Native commentary, final responses,
and turn events remain separate from the Worker's authored PROGRESS. An empty or
old account does not establish that the Worker is idle. No reporting heartbeat is
required; ask for an account when useful.

Work exposes cooperative stop and native interruption. The equivalent commands
are `forge stop --direction PATH --mode request` and `--mode interrupt`, executed
inside the selected container. A cooperative stop result reports submission.
`interrupt_requested` reports an accepted request for the active native turn.
Observe the subsequent turn outcome and any running tools separately. The
[Forge host binding](https://github.com/neutral/forge/blob/main/docs/codex-binding.md)
defines these scopes.

After either Worker stop, an information request permits an account and supporting
inspection. It does not authorize further development or a verification campaign.

Stopping the environment stops the whole container, including its services and
running tools, while retaining saved conversations and files. Starting it restores
services only. To continue development after a stop, send explicit STEER to the
saved Worker, for example: “Continue the selected change from your saved work,
verify the result, and record PROGRESS.”

## Review and retain the result

Inspect changed source and knowledge, run relevant verification, and assess
remaining concerns. Review the Worker's account against the actual files and
results. The Director integrates selected changes through ordinary Git or
explicit copying. IntentForge does not synchronize a workspace copy back to its
source or decide completion and merging.

When the change affects governed code or its Description coverage, explicitly
reconcile Intent:

```sh
docker exec intentforge-example /opt/intent/bin/intent reconcile /workspace --json
```

Inspect `complete`, `valid`, diagnostics, and declared scope. A zero command exit
status can accompany invalid findings. Ordinary Intent inspection does not scan
implementation roots, and reconciliation does not execute software Checks. Run
the project's own verification commands and inspect its actual UI when relevant;
unit results alone do not establish browser behavior. Record results and limits
beside the implementation and refer to them from useful PROGRESS.

For a static knowledge site, use the product's **Export site** control. Intent
requires an explicit current-record selection. Atlas requires a reviewed
publication profile; permission to read a source does not authorize publishing
it. Choose an output under `/exports` and review the captured preview. Export
writes local static files; hosting is a separate explicit operation.

Keep the environment and its storage for further inspection or continuation.
[Verification](verification.md) records the authenticated Worker observations,
container persistence, and remaining host limits for the reviewed image.
