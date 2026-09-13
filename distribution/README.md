# IntentForge distribution

IntentForge has two delivery channels:

| Channel | Artifact | Contains |
| --- | --- | --- |
| npm | `@neutral/intentforge` | The `intentforge` command, user guides, Compose recipe, image metadata, and notices. |
| GHCR | `ghcr.io/neutral/intentforge` | Installed Intent, Atlas, Forge, Node, Codex, and the container services. |

Each npm archive pairs the command with an image selected when it was published.
An image refresh does not change an already published npm archive.
[Setup](../docs/setup.md) covers installation without a source checkout, including
an npm archive and saved Docker image for offline use.

## Release ownership

Maintained source lives in `forge-dev/intentforge/`. The Forge development
repository's `workflows/intentforge-release/` owns the release procedure, public
file projection, synchronization tools, package qualification, and retained
verification records. It coordinates image qualification, explicit GHCR
publication, recording the pulled registry digest, public repository
synchronization, and publication of the exact checked npm archive.

The [public repository](https://github.com/neutral/intentforge) contains the image
builder, runtime services, pinned inputs, Compose recipe, and consumer guides.
The npm command source, development tests, and release tools remain in the
Forge development repository. The npm package ships the command directly;
installation runs no lifecycle hooks and changes no Docker resources.

[image-release.json](image-release.json) records the selected image, target
platform, and release state. Its `reference` is the complete GHCR reference with
the selected registry digest. Release preparation records that reference after
pulling and verifying the image. The public Compose example and newly assembled
npm packages use that selection. Published npm 0.1.0 retains its original digest;
use the explicit image selection in [setup](../docs/setup.md#pull-the-released-image)
with that command. A null reference identifies a local review selection. The separate
local image ID identifies the image configuration and cannot substitute for a
registry digest in a pull command.

An npm update leaves saved environments on their selected image. Review and
pull or load a replacement image explicitly, then follow
[the replacement procedure](../docs/setup.md#preserve-and-replace-deliberately).
Publishing a package or image does not establish Worker behavior or state
compatibility. [Verification](../docs/verification.md) records the observed scope.

## Build an image from public sources

Use a checkout of the public image sources, Python 3.12 or newer, and Docker with
Buildx. The builder installs complete application payloads prepared through the
owning component's distribution process. It does not install the products on the
maintainer's host.

| Input | Version or target | Installed location |
| --- | --- | --- |
| Atlas application payload | 0.9.0, `linux-x64` | `/opt/atlas` |
| Intent application payload | 0.1.0 | `/opt/intent` |
| Forge application payload | 0.1.0 | `/opt/forge` |
| Node.js | 24.18.0, Linux x64 | `/usr/local/bin/node` |
| Codex CLI | 0.153.4, Linux x64 | `/opt/codex` |
| Base image | Pinned Debian-based Node image for `linux/amd64` | Image layers |

[image-inputs.json](image-inputs.json) pins the archive names, SHA-256 checksums,
component source identities, runtime and agent versions, base image, and Debian
package snapshot. Node 24.18.0 satisfies the component integration requirements,
including Forge's built-in SQLite use. `ATLAS_NODE`, `INTENT_NODE`, and
`FORGE_NODE` explicitly select the shared runtime.

Atlas requires its Linux x64 payload with the target's native dependencies.
Intent and Forge provide portable application payloads. Each complete payload
includes its browser assets, dependencies, guidance, and notices. Assembly
preserves that payload and supplies one shared runtime. It does not rebuild
products or fetch application dependencies at startup.

### Obtain and refresh component payloads

Prepare the exact files named by the input manifest using each component's
application assembly procedure:

| Component | Application assembly |
| --- | --- |
| Atlas | [Distribution guide](https://github.com/neutral/atlas/blob/main/distribution/README.md); qualify the complete `linux-x64` payload and native dependencies. |
| Intent | [Application payload guide](https://github.com/neutral/intent/blob/main/distribution/README.md#application-payload-and-shared-runtimes); assemble from the exact qualified public npm archive. |
| Forge | [Distribution guide](https://github.com/neutral/forge/blob/main/distribution/README.md); retain the application inventory from the selected public source. |

Retain each archive's source identity, release metadata, and checksum. A version
string can describe several local candidates and does not identify their bytes.
Native desktop bundles contain their own runtimes and cannot replace these
application payloads. Component publication procedures do not publish IntentForge.

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
  --tag intentforge:0.1.0-candidate
```

The builder verifies pinned checksums, retains the inputs, validates their
complete application layouts, stages the Docker context, and builds the selected
platform. Its output contains the image archive, `image.json`, `SHA256SUMS`,
`build.log`, retained inputs, and build context. The image report records the
immutable local ID and archive checksum. The archive is exported by that ID and
may load without a local tag.

The default tag is `intentforge:VERSION-candidate`, leaving the reviewed image
tag unchanged. `--prepare-only` stages verified inputs without invoking Docker.
`--no-save` builds without exporting a Docker archive. `--download-codex` fetches
only missing Codex archives from their pinned URLs; their checksums still apply.
The public source supplies `distribution/Dockerfile`, its `.dockerignore`, and
all container services needed by the staged build context.

Verify the retained archive checksum, load it, and inspect the actual image:

```sh
cd /absolute/path/to/new-image-artifacts
shasum -a 256 -c SHA256SUMS
docker image load --input intentforge-0.1.0-linux-amd64-image.tar
docker image inspect IMAGE_ID
```

Linux also provides `sha256sum -c`. Substitute the exact local ID from `image.json` for `IMAGE_ID`. To operate the
candidate through the npm command, select that ID explicitly with `--image`.
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

## Services and persistent paths

The container supervises the landing page, Forge's supported startup adapter,
Intent's `open` service, and Atlas's `open` service. All receive `/workspace`
explicitly. Codex's app-server listens only inside the container.

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

Project source, Direction files, and authored PROGRESS live under `/workspace`.
The `/state` volume holds Codex authentication, conversations, and logs; Intent
durable drafts; and Atlas Editor and agent state. `/exports` holds explicitly
exported sites. `/cache` is rebuildable. Installation files and disposable
container storage hold no required persistent user state.
[Setup](../docs/setup.md) describes backups and deliberate replacement.

The current image targets `linux/amd64` and was reviewed through amd64 emulation
on an ARM macOS Docker host. Native Linux x64 hardware, Linux arm64 images, and
Windows launcher use remain unqualified. See the exact reviewed image and
remaining limits in [verification](../docs/verification.md).
