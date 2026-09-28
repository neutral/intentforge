# Verification

IntentForge supports projects starting with a fresh environment and Atlas
initialization. [Components](components.md) defines product responsibilities and
versions. [Setup](setup.md) describes installation, authentication, and operation.

## Artifact identity

[Image selection](../distribution/image-release.json) owns the selected artifact;
[image inputs](../distribution/image-inputs.json) records the component archives,
source revisions, plugin, and bundled runtime. Version numbers alone do not identify
those bytes. Both image-selection fields are null when no image is qualified for
the selected inputs; npm assembly requires a qualified image.

The historical identities below retain the scope of the earlier Atlas 1.0.0
qualification. Current release checks are described separately below.

| Artifact | Identity |
| --- | --- |
| Historical Docker image | `sha256:a9365999b15cfbaecb933cdfade8906459c6f7b61db3bf91c930850b1f311bd7` |
| Historical GHCR manifest digest | `sha256:2371d45816e52cce198ef9fab8b7bb2cb41882d7a54eee6a3dd7f32396238237` |

A local image ID differs from its registry manifest digest. Read the npm archive's
integrity from the registry:

```sh
npm view @neutral/intentforge@0.2.5 dist.integrity
```

The registry value identifies the published tarball. Keep it with any saved
launcher archive, image, checksums, and actual registry references.

Codex selection is independent of image identity. The image supplies bundled
Codex 0.153.4; historical native Worker coverage uses official Codex 0.158.0. The active version
appears in `intentforge status`. A later selected version needs its own evidence
for behavior beyond the startup checks.

## Supported setup

The launcher runs on macOS and Linux with Node.js for npm installation and a local
Docker engine. The image targets `linux/amd64`; ARM Macs use Docker's amd64
emulation. Applications use loopback HTTP addresses. Codex keeps credentials and
conversations in private storage under `/state/codex`.

Atlas Editor, CLI, and MCP share the selected project root and `/state/atlas`.
Sources outside the selected Atlas require an explicit grant. Static publication
requires a reviewed export; restart selects a new destination and preserves
existing exports. Authentication and Worker instructions remain explicit actions.

## Current installed scope

The Atlas 1.1.0 composition is qualified on an ARM Mac with Docker amd64
emulation. The installed Atlas package matches all 209 manifest-listed files and
modes, including its six complete Styles. The final image and retained build
sources agree with the input lock.

| Area | Coverage |
| --- | --- |
| Installation and services | npm-installed launcher; fresh configuration, workspace paths with spaces, named volumes and distinct loopback ports; full supervisor startup; application versions and shared Node SQLite; bundled Codex 0.153.4 and Trellis discovery. |
| Atlas | Root and nested initialization; six Style choices; shared Editor, CLI and MCP drafts; stale revision refusal and exact application; captured Style bytes; fixed-root MCP refusal; source and draft persistence across stop/start. |
| Preview | Explicit reviewed export; required search module and selected source text/HTML; refusal of unselected files and private paths; new preview destination after restart with prior exports retained. |
| Intent and Forge | Protected Intent service and MCP reads with fixed-root refusal; Direction and PROGRESS storage fixtures; persistent source and private Codex configuration. No Worker is dispatched by these fixtures. |
| Browser | Landing page at narrow and wide widths; Trellis request copying; reviewed Atlas initialization and Tree authoring; explicit image replacement preserving authored files; rendered Atlas export on the final image. |

These checks use isolated state without account import or model requests. They
do not repeat historical Worker, downloaded-Codex, or Intent browser-authoring
coverage below. Image layers can be cached in the existing Docker engine.

## Historical installed scope

That image's qualification covered isolated fresh workspaces and private state:

| Area | Coverage |
| --- | --- |
| Source and assembly | Forge, launcher, composition, distribution, release-tool, and repository checks; archive checksum and reload; installed versions, labels, selected inputs, and build-source correspondence. Linux checks include native process-group cleanup. |
| Atlas and Intent | Root and nested Atlas selection; HTTP initialization and authoring; shared Atlas Editor/CLI/MCP drafts; stale-write refusal; source grants; reviewed export and preview isolation; restart persistence and actual service-failure shutdown. Intent coverage includes Check authoring, recovery, apply, export, and MCP reads with fixed-root enforcement. |
| Codex selection | Online official installation and cached reuse; offline latest-to-bundled fallback; bundled startup without registry lookup; an offline exact cached pin; unavailable exact-pin refusal before application services. |
| Trellis registration | CLI and app-server discovery with bundled 0.153.4 and downloaded 0.158.0; both skill entries and complete package bytes; preservation of absent configuration, unrelated private content, and explicit disable choices. |
| Forge and native Workers | Direction storage, authored PROGRESS, and actual source diff; both Trellis skills in a fresh Worker's request metadata; native tool reads of the installed skills, methodology, Atlas, and a complete Intent Check; explicitly requested handbook writes; bound PROGRESS; saved-Worker follow-up; native-host restart and explicit continuation; observed turn interruption. |

The native fixture uses actual Codex and tool processes with container networking
disabled and a deterministic local Responses provider. The provider supplies the
tool instructions. This establishes discovery, file access, writes, and native
control mechanics. It does not establish model interpretation, compliance with
skill guidance, handbook quality, or production work. Turn interruption does not
guarantee that previously running tools or detached processes stop.

Startup checks use isolated empty account state without model requests. They
check executable identity, protocol schemas, app-server startup, and Trellis
registration and discovery. The `latest` policy has a 90-second preparation budget
and at most five downloads, with time reserved for local fallback. An exact pin
does not fall back. [Codex selection](setup.md#choose-codex) defines the operating
boundaries; startup checks cannot establish every behavior of a future release.

## Evidence limits

Installed qualification uses an ARM Mac with Docker's amd64 emulation. It does
not cover native Linux hardware, a native ARM image, or installation into a clean
Docker engine. HTTP/API checks do not establish browser behavior beyond the separate browser
journeys described above. Intent MCP
apply, real account authentication, paid model requests, and model interpretation
are outside this qualification.

Readiness, authentication, native delivery, authored PROGRESS, and verification
of the work are separate observations. Qualifying another setup requires its
exact image and active Codex version, relevant installed checks, and explicit
limits. A successful fixture does not establish safe continuation of any
particular saved conversation.
