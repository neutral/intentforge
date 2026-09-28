# IntentForge

A portfolio of tools to help you develop software with agents, from organizing
project knowledge to guiding and coordinating their work.

IntentForge packages Trellis, Atlas, Intent, and Forge in one persistent Docker
environment:

| Application | Use it to |
| --- | --- |
| **Trellis** | Skills to build practical handbooks, improve working methods, and learn from experience. |
| **Atlas** | Develop project knowledge into navigable explanations, decisions, and connections to sources. |
| **Intent** | Define what the software promises, connect definitions to code, and describe how to check them. |
| **Forge** | Give a Worker a Direction, steer its work, and read its saved PROGRESS. |

People and agents use the same project files. Each application keeps its own
responsibilities; you choose the work, review changes, and decide what to retain.
Stopping the environment preserves its workspace and saved state. Start each
project with a new IntentForge environment.

[Trellis](docs/components.md#trellis-working-methods) supplies two skills for
container Codex: **Shape Handbook** maintains selected working guidance, and
**Learn From Work** proposes improvements from experience you select. Handbook
creation and adoption remain explicit choices.

## Get started

With Node.js and local Docker available on macOS or Linux, install the launcher:

```sh
npm install --global @neutral/intentforge
intentforge --help
```

Or run `npx @neutral/intentforge --help` without a global installation.
Follow [setup](docs/setup.md) to obtain the matching image, select a workspace,
and open the environment. Then [develop one change](docs/first-task.md).

The npm package supplies the launcher and guides. The Docker image supplies the
Trellis plugin, Atlas, Intent, Forge, Codex, and their shared runtime. Starting
an environment opens services; authentication and Worker instructions are explicit
actions.
The image targets `linux/amd64`, including Docker's amd64 emulation on ARM Macs.
At startup, IntentForge selects a current Codex release that passes its startup
checks, with a bundled fallback for offline use. [Setup](docs/setup.md#choose-codex)
explains version selection.

[Verification](docs/verification.md) records the selected image, exercised
behavior, and remaining limits.

## Find your way

Choose a task in the [guides](docs/README.md), read the
[component responsibilities](docs/components.md), or use the
[image build instructions](distribution/README.md).

This repository contains image sources, pinned inputs, a Compose recipe, and
consumer guides. The npm package is distributed separately.
[Feedback and submission policy](CONTRIBUTING.md) explains how to send questions.
Original material is available under [CC0-1.0 or 0BSD](LICENSE), at your choice.
[Third-party components](THIRD_PARTY.md) retain their own terms.
