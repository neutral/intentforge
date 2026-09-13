# Verification

The installed review and later delivery checks apply to the identities and scope
recorded here. Packaging, reorganizing source, or synchronizing the public
repository does not rebuild an image or refresh its component payloads.

## Refreshed image 0.1.0

On 13 September 2026, the image was rebuilt with refreshed Intent, Atlas, and
Forge payloads while retaining suite version 0.1.0. Its image ID is
`sha256:f7ed81f26d6c5dfbd3cb03daaef2fbf4af61fb11319cd393e8494f0ca8c13d91`.
[Image inputs](../distribution/image-inputs.json) identify its component archives
and source revisions. [Image selection](../distribution/image-release.json)
records the selected registry reference.

The refreshed image is published at `ghcr.io/neutral/intentforge:0.1.0`, with
manifest digest
`sha256:99ad8522bfee88ad04a97a7d0bf997faf20573588aba322ebd14ab23d5ab9b5e`.
Anonymous manifest verification matched its bytes and image configuration.
Pulling that digest passed in the existing Docker engine, which could reuse
cached layers.

The actual image started through the maintained npm command with an explicit
image selection and a copied Pigment workspace. Intent, Atlas, and Forge became
ready and reported their expected versions. Intent and Atlas validated the
copied project. Installed Intent common and Check guidance matched the refreshed
payload bytes. All 48 workspace files retained their hashes; the test container
was stopped and retained. Image metadata identifies version 0.1.0.

These checks cover local startup, installed versions, project validation, and
current guidance on Linux amd64 through macOS arm64 emulation. Browser authoring,
MCP, authenticated Worker controls, interruption, and replacement compatibility
were not repeated for this image. Earlier observations below retain their
original image scope.

The published npm 0.1.0 archive retains the initial image digest below. It uses
the refreshed image only when selected explicitly with `--image`; see
[setup](setup.md#pull-the-released-image). Refreshing the image does not change
the published npm archive or existing saved environments.

## Initial published image 0.1.0

The image built from the reorganized public sources was uploaded to GHCR on
13 September 2026. Its target is `linux/amd64`.

| Item | Identity |
| --- | --- |
| Registry tag at initial publication | `ghcr.io/neutral/intentforge:0.1.0` |
| Registry manifest digest | `sha256:883a63418387022bd5fd35dc1a44ad3d85852ee20001ac3e800bd9f6576004aa` |
| Image ID | `sha256:2623170f07383b95e3b287d3720bcb6b346e735b05b704c041abe4a8d0ce67e3` |

Its retained build inputs and current source files matched the built context;
Docker identity, platform, and labels passed verification. An npm-installed
command created, opened, inspected, and stopped an isolated environment with
this image. All three component services became ready. Installed Intent, Atlas,
Forge, and Codex versions and built-in Node SQLite passed. Five workspace files
retained their hashes. The probe used no credentials and created no Direction
or Worker.

The component payloads are the same versions and source identities listed in the
earlier review below. Browser authoring, authenticated Worker controls, and
replacement persistence were not repeated for this image. Their earlier
observations remain tied to the earlier images.

Anonymous GHCR access returned the exact manifest bytes for the digest above,
and its configuration matched the verified image ID. Pulling that digest into
the existing Docker engine succeeded. The engine could reuse cached layers;
this was not a download onto a clean Docker engine. The published npm 0.1.0
command retains this digest. The repository's current Compose example follows
the selection recorded in [image-release.json](../distribution/image-release.json).

## Earlier reviewed image

The image was built, saved, loaded, and exercised on 12–13 September 2026 using
macOS arm64 and Docker 29.4.0 through amd64 emulation.

| Item | Verified identity |
| --- | --- |
| Local tag | `intentforge:0.1.0-review` |
| Image ID | `sha256:9f426be8cd1b4e970bb82a23748853aa4583397c8689432ebb05c0ed9047a94b` |
| Image archive SHA-256 | `d38015f4beb31542c29a3b167678982d8a14947f000a5003791200bd8e60c88f` |
| Image archive | `intentforge-0.1.0-linux-amd64-image.tar`, 875,374,592 bytes |
| Atlas | 0.9.0; source `5751e2fc12dcbd0aef1f3229a3ad76d8d0ece2d0` |
| Intent | 0.1.0; source `ad2b7e18d5339e2bca77a50d09d3c25042ed3ef6` |
| Forge | 0.1.0; source `8c0a927de270efbe969b29467eafe2ffba44509d` |
| Runtime | Node 24.18.0 Linux x64; built-in SQLite available |
| Agent host | Codex 0.153.4 Linux x64 |

The table identifies this earlier build. Current
[image inputs](../distribution/image-inputs.json) and
[image selection](../distribution/image-release.json) describe the selected
release. A local image ID identifies an image configuration; it is not a pullable
registry manifest digest. Byte-identical image rebuilds have not been established.

## Installed observations

The complete installed payloads matched their retained application archives.
Version and help commands passed. Five Atlas native addons loaded as Linux x64
libraries; Sharp encoded a PNG using the bundled libvips without
`LD_LIBRARY_PATH`. Installed product files contained no dependencies on the
actual developer checkout paths.

Both MCP adapters passed protocol initialization, tool listing, guidance,
inspection, query/read, and fixed-root refusal through Docker stdio. Stdout
contained protocol traffic only. Read operations preserved the fixture files.
Intent's complete Check reading and explicit reconciliation were also exercised
against an isolated copy; all five commands passed and original files remained
unchanged. Atlas selection at the workspace root worked through the launcher,
service, and MCP adapter.

Actual HTTP and browser checks exercised Work's supported routes and origin and
token guards, Direction creation and reading, stored PROGRESS, and workspace
diffs. Intent and Atlas initialization wrote only explicitly reviewed files.
Browser authoring, stale-write refusal, recovered drafts, selected static exports,
and Atlas site preview were exercised. Recovery itself applied no authored
changes, and exporting deployed no site.

Real Docker checks exercised selected workspace copies, paths containing spaces,
service startup, explicit image replacement, browser-opening fallback, occupied
ports, and refusal to adopt unrelated existing state volumes. Stop/start and
replacement preserved selected workspace, state, and export content; the old
container was retained. Service readiness was checked separately from agent
authentication.

## Authenticated Worker observations

A separately authorized Worker probe used the same Forge and Codex payloads on
an earlier image, then retained its conversation through replacement with the
reviewed image above. The Worker authored a small module, five passing tests,
a checklist, and deliberate PROGRESS. An information-only follow-up authored an
account while preserving the implementation and checklist hashes.

Active STEER used the native active-turn route. Interruption returned
`interrupt_requested` and the native turn subsequently became `interrupted`.
An already-running 20-second command remained alive until it finished naturally.
Explicit continuation retained the Worker and reran the five tests before image
replacement. These observations establish turn interruption, not termination of
an already-running foreground command.

After replacement, the saved Worker, Direction, prior PROGRESS, native turns,
unfinished Intent and Atlas drafts, exports, and authentication hash survived.
Startup left the Worker unloaded and did not resume development. An explicit
information request continued the same Worker on the final image and added a
new PROGRESS record without changing the prior artifacts. The browser recovered
the unfinished drafts without applying them.

This Docker host prevented Codex's workspace sandbox from creating user
namespaces. The probe selected `workspace-write` and `on-request` and used
command-specific approvals through an attached native client. The Work cockpit
does not answer native approval requests. The alternative explicit fresh-Worker
policy described in [setup](setup.md#select-native-policy-for-a-fresh-worker) was
not the policy exercised by this authenticated probe.

## Local npm delivery

On 13 September 2026, a prepared npm archive was checked with Node.js 24.18.0 and
npm 11.16.0 on macOS arm64. Its exact inventory, file bytes, executable mode,
local guide links, and version agreement passed. Installation under an isolated
global prefix and `npm exec` outside the repository produced the expected help
and version output. All 32 launcher checks also passed against the installed
command with a restricted PATH; those checks used a Docker stub.

The installed npm command separately created, opened, inspected, stopped, and
reopened an isolated environment using the reviewed image. All three component
services became ready, the selected image ID matched, and five workspace file
hashes stayed unchanged. The probe used no credentials and created no Direction
or Worker. Source checks at that stage included 32 launcher, five service, and
eight image-assembly tests. Unit checks establish only their exercised behavior.

The repository reorganization retains the command and runtime behavior. Its
package and projection checks are recorded with the release workflow; the
installed observations above remain tied to their original image and archive.

## Remaining limits

Native Linux x64 hardware, a Linux arm64 suite image, and Windows launcher use
remain unqualified. The registry image targets Linux amd64, exercised through
emulation on macOS arm64. Package and registry checks establish distribution at
their recorded scope; they do not extend the earlier Worker, browser, or
replacement observations to the new image or to another host.

The initial npm default and earlier reviewed image contain abbreviated Intent
authoring guidance. The refreshed image includes the current guidance checked
above. The
[Intent guidance](https://github.com/neutral/intent/blob/main/spec/GUIDANCE.md)
and the [Check review guide](https://github.com/neutral/intent/blob/main/spec/guidance/check-review.md)
are also available in the Intent repository. Select the refreshed image
explicitly when using the published npm 0.1.0 command.

The Forge development repository retains the dated verification record and
reusable procedure in `workflows/intentforge-release/`. Full local reports and
fixtures identify performed commands and observed limits. Raw provider
conversations and credentials are excluded from public content.
