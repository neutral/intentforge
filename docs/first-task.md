# Develop one change

Use this sequence to read the project's context, give a Worker a useful goal,
and review what it produces. [Start the environment](setup.md), confirm the
workspace on its landing page, and authenticate before asking a Worker to act.

Choose a small change. Read the project's agent instructions and find its
verification commands. The command examples use `intentforge-service`; substitute
the container name shown by `intentforge status`.

## Read the relevant definitions and context

Open **Intent** for applicable software Knowledge, implementation Descriptions,
and Checks. Open **Atlas** for explanations, decisions, and connections to sources.
People and Workers use these applications directly.

In Atlas, read its locally captured Style. Start with the relevant Tree's Base
Point and follow its outline into detail. Facets explain connections to other Trees. Read decision status and
observation dates with their evidence; structural validation alone does not
establish a claim's truth. The installed Atlas operating guide at
`/opt/atlas/spec/OPERATING.md`
explains reading and source boundaries.

When a reference leads to an Intent Check, read its assembled definition.
Discover the Check ID in the browser or with `intent query`, then use it here:

```sh
docker exec intentforge-service /opt/intent/bin/intent read-check /workspace CHECK_ID --json
```

The result includes subjects, evidence kinds, supported current Knowledge,
diagnostics, and limits. Reading only the Check's Markdown can omit some of
that meaning. MCP users discover IDs with `intent_query` and use
`intent_read_check`. The [Intent consumer guide](https://github.com/neutral/intent/blob/main/docs/using-intent.md#give-the-director-and-worker-the-complete-definition)
describes complete referrals.

## Improve knowledge when the change needs it

Define one useful software promise and a Check that could expose a plausible
wrong implementation. Use a Description to connect that meaning to code. Add
Atlas context when a decision or source helps answer a recurring question.
Intent Checks define what to assess; people, Workers, and project tools perform
the assessment.

Before authoring Intent, discover and read its installed guidance:

```sh
docker exec intentforge-service /opt/intent/bin/intent guidance
docker exec intentforge-service /opt/intent/bin/intent guidance GUIDANCE.md
docker exec intentforge-service /opt/intent/bin/intent guidance guidance/check.md
```

The `intent_guidance` MCP tool exposes the same guidance. Review the
complete proposed change before applying it. A stale draft requires another
inspection and preparation; review recovered drafts again after restart.

For a new collection, use the Editor's creation flow and confirm its scope.
Intent asks for its name, owners, and implementation roots; an empty implementation
scope is valid. Atlas uses the existing directory selected during setup. Opening
an empty directory offers creation without writing an Atlas. Review the proposed
Style and files, then apply initialization before adding the project's first Tree.

## Give a Worker a Direction

Open **Work** and create a Direction with a concrete goal. Add useful concerns or
references as ordinary files in that Direction's `checklist` folder. Work displays
those files. Explicit STEER starts a Worker.

Include the project guidance, relevant definition IDs and container paths, and
requested verification in the instruction. Ask the Worker to record which
definitions it consumed, assess their criteria, and retain verification results
beside the implementation. If a definition is ambiguous, propose a precise
improvement while preserving its intended promise.

The same operations are available through Docker:

```sh
docker exec intentforge-service /opt/forge/bin/forge init \
  --direction /workspace/.forge/directions/change --workspace /workspace \
  --text 'Implement the selected change. Read project guidance and applicable Checks. Verify the result and record useful PROGRESS.'
docker exec intentforge-service /opt/forge/bin/forge steer \
  --direction /workspace/.forge/directions/change --fresh \
  --text 'Read your Direction, inspect the repository, and begin the change.'
```

Review [native policy](setup.md#select-native-policy-for-a-fresh-worker) before
dispatch if the host requires an explicit sandbox or approval choice. Each Worker
has its own Direction. `--fresh` selects a new Worker and retains earlier
accounts; it does not stop the previously selected Worker.

## Inspect progress and steer

Read stored PROGRESS in Work, or through the command line. Reading it does not
invoke a Worker. Send follow-up STEER when an explanation or changed instruction
would help:

```sh
docker exec intentforge-service /opt/forge/bin/forge progress \
  --direction /workspace/.forge/directions/change --latest
docker exec intentforge-service /opt/forge/bin/forge steer \
  --direction /workspace/.forge/directions/change \
  --text 'Explain the remaining concerns and record PROGRESS.'
```

Follow-up STEER uses the saved Worker. If its conversation is unavailable, inspect
the failure and choose a fresh Worker explicitly when needed. Native commentary
and final responses become PROGRESS only when the Worker deliberately writes an
account. An old or missing account does not establish that the Worker is idle.

Use Forge's command line for a cooperative stop:

```sh
docker exec intentforge-service /opt/forge/bin/forge stop \
  --direction /workspace/.forge/directions/change --mode request
```

This submits an instruction for the Worker to settle and yield. Use
`--mode interrupt` instead to request native interruption of its active turn, then inspect
the subsequent turn and tool outcomes. The
[Forge host binding](https://github.com/neutral/forge/blob/main/docs/codex-binding.md)
defines their exact scope.

After stopping a Worker, an information request permits an account and supporting
inspection. Continuing development requires explicit STEER. Stopping the entire
environment also stops its services and running tools while retaining saved files
and conversations. Starting it restores services only.

## Review the result

Inspect changed source and knowledge, run relevant project verification, and
assess remaining concerns. Compare the Worker's account with the actual files
and results. The Director integrates selected changes through ordinary Git or
copying. IntentForge neither synchronizes workspace copies back to their source
nor decides completion or merging.

When code governed by Intent or its Description coverage changes, reconcile it:

```sh
docker exec intentforge-service /opt/intent/bin/intent reconcile /workspace --json
```

Read `complete`, `valid`, diagnostics, and scope. A zero command exit can accompany
invalid findings. Reconciliation inspects declared implementation relationships;
it does not execute software Checks. Run the project's own verification and use
its actual interface when relevant. Record results and limits with the work and
refer to them from PROGRESS.

## Improve the working method when needed

Use Trellis when the change reveals working guidance you want to improve. Ask
**Shape Handbook** to review or refine the selected handbook, naming the decision
or recurring problem it should help with. Request a Playbook explicitly when you
want to preserve a procedure. Ordinary development does not create one.

For lessons from this change, ask **Learn From Work** to examine the current
conversation and the specific review notes or artifacts you select. Review its
proposals, then explicitly adopt the ones you want through Shape Handbook.
Learning itself changes no files. Supply relevant desktop review notes as project
material when needed; container Codex cannot retrieve desktop chat history merely
because Trellis is installed.

Keep findings about this change with the change. A Trellis Check describes how to
assess recurring work; an Intent Check defines software verification, and a Forge
checklist tracks concerns for one Direction. [Components](components.md#similar-terms-have-different-jobs)
explains these distinctions.

## Export selected knowledge

Use a product's export control to prepare a static site. Intent requires an
explicit current-record selection. Atlas selects Trees, optional Points, and
separately requested source bytes. Permission to read a source does not grant
permission to publish it. Review the preview before building.

IntentForge gives Atlas a fresh destination under `/exports/atlas-site` at each
service start. Each destination is used once. The separate preview port serves
that launch's completed export; earlier exports remain saved. Restart services
for a new destination and an initially empty preview. Export creates local files;
hosting is a separate action.

Keep the environment for later inspection or continuation.
[Verification](verification.md) records the release's checks and limits.
