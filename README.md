# IntentForge

IntentForge combines Intent, Atlas, and Forge in one Docker environment. Choose a
workspace and open one browser page for development, software definitions, and
project context.

| Open | Use it for |
| --- | --- |
| **Work** — Forge | Give a Worker a Direction, steer it directly, and read its stored PROGRESS. |
| **Intent** | Define software Knowledge, implementation descriptions, and verification Checks. |
| **Atlas** | Connect questions to project knowledge, decisions, and primary sources. |

Install the `intentforge` command through npm and obtain the image from a
container registry. Neither requires this repository. Install a selected version:

```sh
npm install --global @neutral/intentforge@0.1.0
intentforge --help
```

Or run `npx @neutral/intentforge@0.1.0 --help` without a global installation.
The npm package supplies the command and guides. Docker supplies the applications,
browser services, shared Node runtime, and Codex. npm needs host Node; the
installed command uses a POSIX shell and ordinary system tools.

[Setup](docs/setup.md) covers installing the command, pulling the release's pinned
image, selecting a workspace, and returning to an environment. The
[image selection](distribution/image-release.json) records the exact image
reference selected by this repository. The published npm 0.1.0 command retains
its original image default; setup shows how to select the refreshed image with
`--image`. Then
[develop one change](docs/first-task.md).

Starting an environment starts services. Agent login and Worker instructions are
explicit actions. Keep project compilers and services inside the selected
environment. The current image targets `linux/amd64`; the reviewed ARM macOS host
runs it through Docker's amd64 emulation. [Verification](docs/verification.md)
identifies the actual image, observed behavior, and remaining limits.

This public repository contains image sources, pinned build inputs, a Compose
recipe, and guides. [Distribution](distribution/README.md) explains how to build
an image from selected component payloads. Image and npm command source is
maintained in `forge-dev/intentforge/`; the Forge development repository's
`workflows/intentforge-release/` coordinates public synchronization, GHCR, and npm.
The public repository is not an npm package source.

See the [usage guides](docs/README.md), [component responsibilities](docs/components.md),
and [feedback policy](CONTRIBUTING.md). Original IntentForge material uses
[CC0-1.0 OR 0BSD](LICENSE), at the recipient's choice.
[Third-party components](THIRD_PARTY.md) retain their own terms.
