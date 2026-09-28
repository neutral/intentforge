# IntentForge distribution

IntentForge has two delivery channels:

| Channel | Artifact | Contains |
| --- | --- | --- |
| npm | `@neutral/intentforge` | The `intentforge` command, user guides, Compose recipe, image metadata, and notices. |
| GHCR | `ghcr.io/neutral/intentforge` | Trellis, Atlas, Intent, Forge, Node, Codex, and the container services. |

Each npm archive pairs the command with a selected image.
An image refresh does not change an already published npm archive.
[Setup](../docs/setup.md) covers installation without a source checkout, including
an npm archive and saved Docker image for offline use.

## Release ownership

The [public repository](https://github.com/neutral/intentforge) contains the image
builder, runtime services, pinned inputs, Compose recipe, and consumer guides.
The npm package supplies the launcher directly. Installation runs no lifecycle
hooks and changes no Docker resources. Maintainers qualify the package and image
separately before publication.

[image-release.json](image-release.json) identifies the selected image and platform.
For a published image, its `reference` pins the verified GHCR manifest. Local
qualification uses `reference: null` and the reviewed local image ID. When neither
has been qualified for the current inputs, both fields are null and npm assembly
refuses. Supply a qualified image explicitly for local operation. Docker's local
image ID identifies the image configuration and cannot replace a registry digest
in a pull command. The Compose example and newly assembled npm archive use this
selection.

An npm update leaves saved environments on their selected image. Review and
pull or load a replacement explicitly, then follow
[the replacement procedure](../docs/setup.md#preserve-and-replace-deliberately).
[Verification](../docs/verification.md) describes the supported setup, performed
checks, and their limits.

## Build an image from public sources

Use a checkout of the public image sources, Python 3.12 or newer, and Docker with
Buildx. The builder installs complete application payloads prepared through the
owning component's distribution process. It does not install the products on the
maintainer's host.

| Input | Version or target | Installed location |
| --- | --- | --- |
| Trellis plugin | 0.6.1, complete public package | `/opt/intentforge/plugins/trellis` |
| Atlas npm archive | 1.1.0, `neutral-atlas-1.1.0.tgz` | `/opt/atlas` |
| Intent application payload | 0.1.0 | `/opt/intent` |
| Forge application payload | 0.1.0 | `/opt/forge` |
| Node.js | 24.18.0, Linux x64 | `/usr/local/bin/node` |
| Bundled Codex CLI | 0.153.4, Linux x64 | `/opt/codex` |
| Base image | Pinned Debian-based Node image for `linux/amd64` | Image layers |

[image-inputs.json](image-inputs.json) pins the archive names, SHA-256 checksums,
component source identities, Trellis package identity, runtime and bundled agent
versions, base image, and Debian package snapshot. Node 24.18.0 satisfies the
component integration requirements, including Forge's built-in SQLite use.
`/usr/local/bin/atlas` explicitly invokes that runtime; `INTENT_NODE` and
`FORGE_NODE` select it for the other products.

Atlas supplies a portable runtime-free npm archive without native addons.
Intent and Forge provide portable application payloads. Each complete payload
includes its browser assets, dependencies, guidance, and notices. Assembly
preserves that payload and supplies one shared runtime. It does not rebuild
Atlas, Intent, or Forge at startup. Codex selection is a separate operation
described below.

### Obtain and refresh component payloads

Prepare the exact files named by the input manifest through each component's
distribution procedure:

| Component | Distribution |
| --- | --- |
| Trellis | Obtain the complete public package from the source revision and archive URL in [image-inputs.json](image-inputs.json). The builder's `--download-trellis` option fetches this archive. |
| Atlas | Obtain the exact published runtime-free npm archive from the URL in [image-inputs.json](image-inputs.json); its installation guide is included at `docs/install.md`. |
| Intent | [Application payload guide](https://github.com/neutral/intent/blob/main/distribution/README.md#application-payload-and-shared-runtimes); assemble from the exact qualified public npm archive. |
| Forge | [Distribution guide](https://github.com/neutral/forge/blob/main/distribution/README.md); retain the application inventory from the selected public source. |

Retain each archive's source identity, release metadata, and checksum. A version
string can describe several local candidates and does not identify their bytes.
Native desktop bundles contain their own runtimes and cannot replace these
application payloads. Component publication procedures do not publish IntentForge.
The Atlas input is retained as `neutral-atlas-1.1.0.tgz`. Verify it against the
archive checksum, source identity, and complete package manifest identity in the
input lock. The selected archive is published as `@neutral/atlas@1.1.0`.

When refreshing the image, update `distribution/image-inputs.json` with the
actual replacement archives and hashes. Review the components' integration
contracts for payload layout, runtime requirements, startup flags, readiness,
MCP entry points, and persistent state. Keep the reviewed image available while
qualifying a new candidate. New component source or npm qualification does not
update an older image.

### Assemble a candidate

Place the exact input archives in a selected directory. Run from the public
source root with a new output directory:

```sh
python3 distribution/build-image.py \
  --inputs /absolute/path/to/verified-inputs \
  --output /absolute/path/to/new-image-artifacts \
  --tag intentforge:0.2.5-candidate
```

The builder verifies pinned checksums, retains the inputs, validates their
complete application and plugin layouts, stages the Docker context, and builds
the selected platform. The builder streams the complete staged context to Docker
from a retained `build-context.tar.gz`, preserving file contents, modes, and symlinks.
This transfers current bytes even when package files have unchanged sizes and
timestamps. Its output contains the image archive, `image.json`, `SHA256SUMS`,
`build.log`, retained inputs, staged context, and context archive. The image report records the
immutable local ID and archive checksum. The archive is exported by that ID and
may load without a local tag.

The default tag is `intentforge:VERSION-candidate`, leaving the reviewed image
tag unchanged. `--prepare-only` stages verified inputs without invoking Docker.
`--no-save` builds without exporting a Docker archive. `--download-codex` fetches
only missing Codex archives from their pinned URLs; their checksums still apply.
`--download-trellis` fetches the missing Trellis archive from its pinned public
source revision and checks its checksum and complete package inventory.
The public source supplies `distribution/Dockerfile`, its `.dockerignore`, Codex
configuration, the local marketplace definition, and the container services.

Verify the retained archive checksum, load it, and inspect the actual image:

```sh
cd /absolute/path/to/new-image-artifacts
shasum -a 256 -c SHA256SUMS
docker image load --input intentforge-0.2.5-linux-amd64-image.tar
docker image inspect IMAGE_ID
```

Linux also provides `sha256sum -c`. Substitute the exact local ID from `image.json`
for `IMAGE_ID`. To operate the candidate through the npm command, select that ID
explicitly with `--image`.
Compose users set `INTENTFORGE_IMAGE` to the same ID in their selected environment
file. Building or loading starts no Worker.

Inspect installed tools and services, actual browser authoring, MCP roots,
explicit Worker operations, and persistent state before selecting an image for
release. Record the image, source inventory, host, performed checks, and limits.
Authentication and Worker checks use an explicitly authorized isolated
environment. A successful build is not a claim of byte-identical rebuilds or
installed application behavior.

Installed assembly metadata lives under `/opt/intentforge/`: `image-inputs.json`,
`build-source.json`, `system-packages.txt`, and `node.sha256`.
[Third-party notices](../THIRD_PARTY.md) identify the retained licenses.

## Bundled Trellis plugin

The image retains the complete pinned public Trellis 0.6.1 package at
`/opt/intentforge/plugins/trellis`. It includes both skills, their references and
templates, methodology, contract, manifests, assets, license, and policy files.
Build input checks verify the selected package and its retained inventory.

IntentForge makes Trellis available to container Codex through its local
`intentforge` marketplace and enables it by default. Startup retains an explicit
disable choice in Codex configuration. Registration uses the package in the image,
so a new environment needs no Trellis download. This installs the plugin for
container Codex. No Trellis service, account, or additional runtime is required.

Codex selection checks the plugin registration and both skills as part of its
startup contract. A Codex version change retains the image's pinned Trellis
package; refreshing Trellis is a separate image change. Registration and skill
discovery establish availability; they do not establish a model's interpretation
or use of the skills. [Setup](../docs/setup.md#use-trellis-skills) describes their
use and scope.

## Codex selection at startup

`INTENTFORGE_CODEX_VERSION` selects the agent host:

| Value | Startup behavior |
| --- | --- |
| `latest` (default) | Resolve the latest stable official npm release, then try earlier stable releases when installation or startup checks fail. Use a saved installation or the bundled version if the search yields none. |
| `bundled` | Use `/opt/codex` without registry access. |
| Exact stable version | Install or reuse that version and run the startup checks. Failure stops startup without fallback. |

Selection completes before the application services start. Preparation has a
90-second budget, with time reserved for local fallback and at most five downloads.
Each download selects an exact published version from the official npm registry;
installation retains its integrity metadata, package notices, and selection
information under `/state/tools/codex`. The bundled version remains an immutable
build input. Downloading a newer Codex does not replace the image or require a
new IntentForge release.

The startup probe uses isolated empty account state. It checks the executable,
protocol schema, app-server handshake against Forge, and bundled Trellis skill
discovery without logging in or calling a model. It does not open the user's
conversations. The selected executable remains fixed for the lifetime of that
service start; a running Worker is never replaced to try another Codex version.
Authentication, quota, task, and saved-state failures do not trigger fallback.

These checks establish a bounded startup contract. They cannot establish every
behavior of a future release. The active version appears in launcher status;
record it with installed verification. Saved installations and the bundled version
support offline use.

## Services and persistent paths

After Codex selection, the container supervises the landing page, Forge's startup
adapter, Intent's `open` service, and Atlas's `open` service. All receive `/workspace`
explicitly. Atlas listens on internal loopback behind an IntentForge adapter that
checks the configured browser origin before forwarding to it. Codex's app-server
listens only inside the container.

| Service | Default host URL | Access |
| --- | --- | --- |
| Landing page | `http://127.0.0.1:4800` | Navigation and service status. |
| Forge Work | `http://127.0.0.1:4800/work` | Forge's session and controls through the suite origin. |
| Direct Forge access | `http://127.0.0.1:4310` | Direct access and native controllers. |
| Intent | `http://127.0.0.1:8787` | Per-launch protected URL and API token. |
| Atlas | `http://127.0.0.1:4721` | Per-launch protected URL and API token. |
| Atlas site preview | `http://127.0.0.1:4722` | Explicit selected export preview. |

Work forwarding preserves the supported routes, methods, request headers,
response headers, and access checks. Intent and Atlas retain separate origins;
open them through current landing links to establish their protected browser
sessions after each service restart. The suite keeps host ports on loopback by
default and does not expose the native app-server port.

Atlas preview serves only the current launch's reviewed export from a unique
directory under `/exports/atlas-site`. Atlas refuses to overwrite an export;
restart services before exporting another selection. Earlier exports stay in
the volume and are not automatically selected by the new preview service.

Project source, Direction files, and authored PROGRESS live under `/workspace`.
The `/state` volume holds Codex installations and selection details under
`/state/tools/codex`; authentication, conversations, and logs under `/state/codex`;
Intent durable drafts; and shared Atlas Editor, CLI and MCP state at
`/state/atlas`. `/exports` holds explicitly exported sites. `/cache` is rebuildable.
Installation files and disposable container storage hold no required persistent
user state.
[Setup](../docs/setup.md) describes backups and deliberate replacement.

The launcher checks the Atlas version label on the selected immutable image before
preparing an environment. The applications use loopback HTTP addresses.

Atlas 1.1 uses `atlas.json`, Trees, and a complete locally captured Style. MCP generation checks the selected image
and uses the Atlas 1.1 command with the saved project root. Regenerate
configuration after an explicit image replacement.

The selected image targets `linux/amd64`.
[Verification](../docs/verification.md) describes performed checks and their limits.
