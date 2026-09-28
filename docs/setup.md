# Run IntentForge

Choose a workspace, start its applications, and return to the same saved
environment when you need it. Use a local Docker engine and a browser on macOS
or Linux. npm needs Node.js to install the launcher; the installed command uses
a POSIX shell and ordinary system tools. The applications and Codex run in Docker.

Start with a new IntentForge environment and initialize Atlas in the project.
[Verification](verification.md) describes the supported setup and verified scope.
The image targets `linux/amd64`; ARM Macs require Docker's amd64 emulation.
Use local browser addresses and normal private Codex storage with this image.

## Install the launcher

```sh
npm install --global @neutral/intentforge
intentforge --help
```

Or use `npx @neutral/intentforge --help`. With npx, replace `intentforge` in
launcher commands with `npx @neutral/intentforge`.
Installation changes launcher files only; obtaining an image and starting an
environment are separate actions.

## Select the image

Use the qualified image in [image selection](../distribution/image-release.json).
For a published selection, replace `<GHCR_MANIFEST_DIGEST>` with its verified
manifest digest:

```sh
INTENTFORGE_IMAGE='ghcr.io/neutral/intentforge@sha256:<GHCR_MANIFEST_DIGEST>'
docker pull --platform linux/amd64 "$INTENTFORGE_IMAGE"
```

Keep this variable set for the creation commands below. The digest identifies
the exact image independently of mutable version tags. Null selection fields mean
that a qualified image still needs to be selected for these component inputs.

The launcher requires a loaded image and saves its immutable local ID when you
create an environment. Later tag changes leave that environment on the same
image. The launcher reports a missing image without downloading or building it.
For a saved archive, follow [offline installation](#offline-installation) and
set `INTENTFORGE_IMAGE` to the loaded image's recorded ID.
To build an image from source, follow [distribution](../distribution/README.md).

## Choose a workspace once

To preserve the original checkout, preview and create an independent copy:

```sh
intentforge copy-workspace "/projects/service" "/projects/service IntentForge"
intentforge copy-workspace "/projects/service" "/projects/service IntentForge" --confirm
mkdir "/projects/service IntentForge/atlas"
intentforge create service --workspace "/projects/service IntentForge" --direct \
  --image "$INTENTFORGE_IMAGE"
```

The first command shows the source and destination. The second copies the
project and refuses an existing destination. Create the empty Atlas directory,
then save the environment without starting services. Copies include local
project state; inspect the source before copying. The copier refuses symlinks and linked Git metadata.
Prepare projects needing those features with ordinary Git or file tools, keeping
Git metadata accessible inside the selected workspace.

To edit an existing checkout directly, use this alternative:

```sh
mkdir "/projects/service/atlas"
intentforge create service --workspace "/projects/service" --direct \
  --image "$INTENTFORGE_IMAGE"
```

Container edits appear in that checkout immediately. Choose one example per
environment name. The selected absolute directory becomes `/workspace` inside
Docker. New environments require unused configuration and state-volume names;
`create` does not adopt old volumes or synchronize copies back to their source.

### Select the Atlas directory

The default selection is the workspace's `atlas` directory, created in the
examples above. The Editor offers reviewed Atlas creation. Use
`--atlas-path knowledge/atlas` when creating the environment to select a different existing directory, or `--atlas-path .` for
the workspace root.

Atlas stores its `atlas/1.1` root definition in `atlas.json` and organizes knowledge
into Trees. Initialization offers explanatory and concise policies for perspectives,
subjects, or a central synthesis with supporting accounts. The installed catalogue
at `/opt/atlas/styles/README.md` explains all six choices; a complete custom
Style is also supported. Review the selected policy and all proposed files, then
apply initialization before adding knowledge. Its complete local Style governs
subsequent maintenance.

### Choose ports

| Service | Default host port |
| --- | --- |
| Landing page and Forge's Work view | 4800 |
| Direct Forge access | 4310 |
| Intent | 8787 |
| Atlas | 4721 |
| Atlas static preview | 4722 |

For another environment, choose distinct available ports with `--port`,
`--forge-port`, `--intent-port`, `--atlas-port`, and `--preview-port` at creation.
The launcher publishes them on host loopback. The Docker socket and host home
directory are not mounted into the workspace.

## Start and open

```sh
intentforge start service
intentforge status service
intentforge open service
```

`start` starts services and prints the landing URL. `open` also requests a browser.
Use `--no-browser` to leave browser opening to you. `status` shows the saved
workspace, image, active Codex version, container, volumes, and service state.

Choose **Work**, **Intent**, or **Atlas** on the landing page. Work is Forge's
cockpit at `/work`. Intent and Atlas open on their own ports with protected
session links. Return through the landing page after a restart to obtain current
links. Treat those links and the private service logs as authoring access.

Starting services creates no Direction, starts no Worker, and applies no authored
changes. Initialize an empty collection through its Editor and review the proposed
files before applying. Continue with [developing one change](first-task.md).

## Choose Codex

The default selection is `latest`. Before starting services, IntentForge checks
the official npm registry for the latest stable Codex release, installs that
exact version, and tests its startup contract with Forge. An installation or
startup-check failure tries an earlier stable release. The search is bounded;
if it finds no usable download, it tries a saved installation and then the
Codex version bundled in the image. Offline startup uses those local choices.

Choose a different policy when creating an environment:

```sh
# Use the image's bundled Codex without registry access.
intentforge create service --workspace "/projects/service" --direct \
  --image "$INTENTFORGE_IMAGE" --codex-version bundled
```

Use `--codex-version latest` for the default, or replace `bundled` with an exact
stable version such as `0.153.4`. An exact pin either starts with that version or
fails visibly; it does not fall back. Choose one creation example per environment.
A saved exact version can also be used offline.

`intentforge status service` reports the active version. The choice stays fixed
while the environment runs. After stopping and starting an environment that uses
`latest`, selection runs again; opening an already running environment does not
update Codex. A new Codex release needs no IntentForge image or launcher release.

Downloads and selection details live under `/state/tools/codex`. Credentials and
conversations stay in `/state/codex`. Startup checks use isolated empty account
state and make no model request. They check installation, protocol startup, and
Trellis skill discovery; they cannot establish every behavior of a future Codex
release. Authentication, quota, task, or saved conversation failures do not
trigger a downgrade or retry. Inspect those failures
before continuing work.

## Authenticate the selected environment

For device login in a running environment:

```sh
intentforge login service
intentforge auth-status service
```

Complete authorization with the intended account. Credentials and conversations
remain in the environment's `/state/codex` volume. If the running host needs to
reload a changed login, stop and start the environment.

To import a file-based login from this machine:

```sh
intentforge login service --from-host
# Or select a specific file:
intentforge login service --auth-file /absolute/private/auth.json
intentforge stop service
intentforge start service
```

`--from-host` selects `$CODEX_HOME/auth.json`, or `~/.codex/auth.json` when unset.
Import replaces only `/state/codex/auth.json` with owner-only permissions; it does
not copy configuration, sessions, or Keychain entries. A missing file returns an
error. Restart loads the copy; later starts retain credentials refreshed by Codex.

A saved login does not establish a successful model request. Service readiness,
authentication, and Worker execution are separate states. Read stored PROGRESS
for the Worker's independently authored account.

### Select native policy for a fresh Worker

Codex keeps its native sandbox and approval defaults. The Work cockpit cannot
answer native approval requests; use an approval-capable client when your policy
requires answers. Some Docker hosts also prevent the user namespaces needed by
Codex's Linux sandbox. Diagnose the actual failure before changing policy.

If you deliberately choose the container as this Worker's execution boundary,
Forge accepts an explicit policy on fresh STEER:

```sh
docker exec intentforge-service /opt/forge/bin/forge steer \
  --direction /workspace/.forge/directions/change --fresh \
  --sandbox danger-full-access --approval-policy never \
  --text 'Read your Direction, inspect the repository, and begin the change.'
```

Create the Direction first and substitute its path and container. This policy
allows commands without Codex sandboxing or interactive approval inside the
container, including access to its writable mounts and network. It is not the
suite default. Settings remain associated with that Worker for continuation;
ordinary follow-up STEER cannot override them. A fresh Worker does not stop an
older one. The [Forge binding guide](https://github.com/neutral/forge/blob/main/docs/codex-binding.md#native-settings)
defines these controls; [verification](verification.md) states the current review limits.

## Return to saved environments

```sh
intentforge list
intentforge select service
intentforge open
intentforge status
intentforge stop
```

Commands without a name use the saved selection. Configuration lives under
`$INTENTFORGE_HOME`, or `${XDG_CONFIG_HOME:-$HOME/.config}/intentforge` by default.
Keep that directory and use the same Docker engine. A different engine is refused;
select the original Docker context or create a separate environment there.

Stop retains the container, workspace, and volumes. Start restores services.
To resume development, send explicit STEER to the saved Worker. An unavailable
conversation fails visibly; choose a fresh Worker explicitly when needed.

## Connect an agent or use a command

Generate MCP configuration, inspect it, and add the entries through your host's
settings:

```sh
intentforge mcp-config service > intentforge-mcp.json
intentforge mcp-config service --format codex
```

The second form prints Codex TOML. Generation requires the saved Docker engine
and image; the container needs to be running when the host connects. The entries
use Docker with stdin and no TTY. Keep the host's Docker context pointed at that
engine. The launcher changes no agent-host settings.

The generated adapters select the project explicitly. Atlas Editor, CLI, and MCP
share `/state/atlas`; its source grant includes `/workspace`. Regenerate MCP
configuration after replacing an image. Use this launcher output
for a host outside Docker: Atlas's own **Connect agent** panel describes the
installation inside the container.

For direct commands, use the container name shown by `status`:

```sh
docker exec intentforge-service /opt/intent/bin/intent --version
docker exec intentforge-service atlas --version
docker exec intentforge-service /opt/forge/bin/forge --version
docker exec intentforge-service git -C /workspace status --short
```

A direct Atlas read grants the selected Atlas directory by default. Add
`--allow-source-root /workspace` before the command when project sources outside
that directory are needed. A reference alone grants neither access nor publication
permission. The installed Atlas agent guide is `/opt/atlas/docs/working-with-agents.md`.

Workers use the same installed tools. Put project verification commands in its
agent guidance and add compilers or services through an explicitly selected
derived image or Compose configuration.

## Use Trellis skills

Trellis 0.6.1 is included in the image and enabled by default for Codex inside the
container. Startup retains an explicit choice to disable it in Codex configuration.
Its two skills need no separate installation, Trellis account, or background
service. Their files remain available offline; running an agent still uses the
selected Codex host and its model access.

Ask a Worker to use **Shape Handbook** when you want to establish, adopt, review,
or improve a particular area's working guidance. Name the area and intended
improvement. For example:

> Use Shape Handbook to create a handbook for /workspace. Explain how contributors
> should select the project's verification commands and record their limits.

Creation and adoption require an explicit request. A review-only request returns
findings without changing files. Ask explicitly when you want a repeatable
procedure captured as a Playbook. Handbook files stay inside the selected
`handbook/` directory. If Shape Handbook supplies an `AGENTS.md` discovery blurb,
choose whether to add it through ordinary project editing; the skill does not
edit that file.

Ask **Learn From Work** to examine the current Worker conversation, selected
project artifacts, or an account of work you supply. It returns proposed lessons
and editable requests for Shape Handbook. It writes no files and does not adopt
its own proposals.

Desktop chats and host conversation history are not copied into the container.
Supply the selected notes or files needed for the lesson. Installing or enabling
Trellis creates no handbook and does not expand a Worker's task permissions.

## Preserve and replace deliberately

| Location | Keep it for |
| --- | --- |
| Workspace mounted at `/workspace` | Project files, authored Intent and Atlas, selected handbooks, Directions, checklists, PROGRESS, artifacts, and unfinished authored work. |
| Named volume at `/state` | Codex installations and selection details, authentication and conversations, Intent drafts, Atlas drafts and reports, and private service logs. |
| Named volume at `/exports` | Exported static sites. |
| Host launcher configuration | Saved image, engine, workspace, ports, and environment selection. |
| `/cache` | Rebuildable caches; do not keep unique work here. |

Keep the container's `/workspace` path stable because product state can be keyed
by that path. Persistent drafts survive restart; process-local observations and
unsaved proposals may not. Re-read current files and review recovered drafts.

Before replacing an image, stop writers and back up the workspace, state and
export volumes, and launcher configuration. Docker's `cp` can copy `/state` and
`/exports` from a stopped container to new host directories. Protect those backups
as source and credential material.

```sh
intentforge stop service
intentforge replace service --image "$INTENTFORGE_IMAGE" --confirm
intentforge status service
intentforge start service
```

Set `INTENTFORGE_IMAGE` to the reviewed replacement first. Replacement keeps the
mounts and volumes, retains the earlier container under a reported name, and
prepares the new container stopped. Inspect retained state before continuing a
Worker. Run only one container against a state volume.
Updating the npm package alone never replaces an environment's image.

For disposal, inspect the container and volume names in `status`, retain needed
backups, then remove only the selected Docker resources. Removing a container or
image leaves the workspace bind mount intact. Remove volumes, saved launcher
configuration, and project copies separately only when intended.

## Offline installation

On a host with npm and Docker already available, use a saved launcher archive
and its matching image. Compare their checksums with the supplied release
information, using `shasum -a 256 FILE` on macOS or `sha256sum FILE` on Linux.

```sh
npm install --global --offline /absolute/path/to/intentforge-launcher.tgz
intentforge load /absolute/path/to/intentforge-image.tar
```

Select the loaded image ID explicitly if the archive restores no tag or registry
reference. Retain the package, image, report, and checksums together. Use
`--codex-version bundled` when creating the environment to skip registry access.
The default `latest` policy falls back to saved or bundled Codex when offline.

## Advanced Compose

Use [compose.yaml](../distribution/compose.yaml) and
[.env.example](../distribution/.env.example) for direct service configuration.
Copy the example into a new environment file and set the image, absolute workspace,
Atlas path, ports, and persistent volume names. Set `INTENTFORGE_CODEX_VERSION` to
`latest`, `bundled`, or an exact stable version; it has the same meaning as
`--codex-version`. From the image source checkout:

```sh
docker compose --env-file /absolute/path/to/environment.env -f distribution/compose.yaml config
```

A global npm installation also includes the recipe:

```sh
INTENTFORGE_PACKAGE="$(npm root --global)/@neutral/intentforge"
docker compose --env-file /absolute/path/to/environment.env \
  -f "$INTENTFORGE_PACKAGE/distribution/compose.yaml" config
```

Inspect the resolved configuration before `up --no-recreate`. Use the same
`--env-file`, `-f`, and Compose project for later operations. Keep Compose and
launcher environments separate, with distinct state volumes. Preserve loopback
publications and keep the native app-server port internal. Changes to images,
mounts, or policy require a deliberate replacement.

The applications use loopback HTTP addresses. Codex keeps credentials and
conversations in the private `/state/codex` volume. [Verification](verification.md)
records the scope of installed checks.
