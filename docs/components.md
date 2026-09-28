# Components

IntentForge brings Trellis, Atlas, Intent, and Forge into one workspace. It supplies
the image, service startup, browser navigation, and saved environment selection.
Each product owns its files, operations, and review rules. The bundled Trellis
plugin supplies skills for maintaining the project's working methods.

The composition includes:

| Product | Version | Responsibility | Reference |
| --- | --- | --- | --- |
| [Trellis](https://github.com/neutral/trellis) | 0.6.1 | Skills to build practical handbooks, improve working methods, and learn from experience. | [Working methods](#trellis-working-methods) |
| [Atlas](https://github.com/neutral/atlas) | 1.1.0 | Navigable project context in Trees, Points, and Facets under one locally captured Style; Absorb and Route; reviewed authoring and selected publications. | Installed CLI and MCP references under `/opt/atlas/docs/reference/`. |
| [Intent](https://github.com/neutral/intent) | 0.1.0 | Software Knowledge, implementation Descriptions, Check definitions, reviewed authoring, and selected static exports. | [Integration](https://github.com/neutral/intent/blob/main/docs/integration.md) |
| [Forge](https://github.com/neutral/forge) | 0.1.0 | Directions, direct STEER, saved Worker associations, authored PROGRESS, and the Work cockpit. | [Integration](https://github.com/neutral/forge/blob/main/docs/integration.md) |

Atlas, Intent, and Forge share Node.js 24.18.0. Forge uses Codex CLI as its agent host.
IntentForge selects a stable Codex release at service startup and retains the
image's bundled 0.153.4 as an offline fallback. [Codex selection](setup.md#choose-codex)
also supports the bundled version or an exact stable pin. The active version
remains fixed until the environment stops and starts again.

[Verification](verification.md) identifies the selected image and the scope of
installed checks. [Third-party notices](../THIRD_PARTY.md) locate licenses and
dependency inventories.

## How the products work together

The Director chooses the goal, Worker, instructions, and changes to integrate.
The Worker develops in the selected container, uses project tools, assesses the
result, and writes useful PROGRESS. Each Worker has its own Direction; independent
Directions can share a workspace.

Directors and Workers read Intent and Atlas through their browsers, commands,
or MCP tools. Forge does not retrieve or interpret that material for them. Include
useful definition IDs, paths, and source references in a Worker's instructions.
The [first-change guide](first-task.md) shows this sequence.

Intent connects software meaning to implementation and verification definitions.
Atlas explains context and paths to supporting sources. Forge preserves the
Worker's Direction, association with its host conversation, and authored accounts.
The project supplies its implementation, development services, and verification
commands.

## Trellis working methods

[Trellis](https://github.com/neutral/trellis) 0.6.1 is bundled as a complete local
plugin and enabled for container Codex by default. It has two skills:

| Skill | Purpose |
| --- | --- |
| Shape Handbook | Create, adopt, review, or refine selected handbooks and their practices, Checks, requested Playbooks, and templates. |
| Learn From Work | Examine selected experience and propose useful handbook improvements for you to choose. |

A handbook stores working methods in `<area>/handbook/`; the area's actual work
stays in its own files. Shape Handbook edits only the selected handbooks when
requested. A review produces findings. Learn From Work produces proposals and
writes no files. Keeping a proposed lesson requires an explicit adoption request.
Neither skill starts because the environment opens or ordinary development runs.

Trellis adds no service, account, or separate runtime. Its skills, references,
templates, methodology, and contract are available from the image without a
network download. Codex still needs its own authentication and model access for
agent work. [Setup](setup.md#use-trellis-skills) explains how to use the skills.

## Similar terms have different jobs

| Term | Meaning |
| --- | --- |
| Intent Check | A software verification definition with subjects, criteria, and supported Knowledge. |
| Atlas Check | An adopted requirement for maintaining a particular Atlas. |
| Trellis Check | A reusable expectation and verification guidance for work covered by a handbook. |
| Forge checklist | Working concerns and references for one Direction. |
| Forge PROGRESS | An account deliberately written to the Direction by its Worker. |
| Native host event | Transport or execution metadata supplied by the agent host. |

People, agents, and project tools perform verification. Atlas MCP can record
supplied manual Check outcomes with their evidence; missing verification remains
`unable`. A Check report is separate from Forge PROGRESS. Neither establishes
permission to merge or publish.

IntentForge adds no workflow engine, Check runner, completion authority,
mandatory agent hierarchy, spending monitor, or automatic disposal. Opening
services creates no Direction or authored collection. Starting or continuing a
Worker requires explicit instructions.

## Atlas files and saved state

This integration uses `atlas.json` with format `atlas/1.1` and one complete locally
captured Style. Trees own Points, Branches organize detail, and Facets explain
connections to other Trees. Start a project with a fresh IntentForge environment
and select a curated Style or a complete custom policy during reviewed Editor
initialization. Read that policy before maintaining the account; ordinary edits
do not replace it.

The Editor, CLI, and MCP adapter share Atlas private state under
`/state/atlas`. [Setup](setup.md#preserve-and-replace-deliberately) explains
which workspace, volumes, and launcher settings to preserve.

## Use a product independently

Each application is also independently installable. Its own guide describes
supported npm and standalone routes:
[Intent](https://github.com/neutral/intent/blob/main/docs/install.md),
[Atlas](https://github.com/neutral/atlas/blob/main/docs/install.md), and
[Forge](https://github.com/neutral/forge/blob/main/docs/install.md).
A native Forge installation locates the controller on the host; its Workers still
execute in the selected container.

[Neutral Disciplines](https://github.com/neutral/neutral-disciplines) provides
optional engineering advice for Intent. Select useful practices or Sets and
review their adoption in the project.
