# Run IntentForge

Use Docker, a browser, and the `intentforge` launcher on macOS or Linux. npm
installs the launcher; a container registry supplies the image. No source
checkout is needed. npm itself needs host Node, but the installed launcher is a
standalone POSIX shell script. Codex, Intent, Atlas, Forge, and their shared Node
runtime run inside the image.

The current image targets `linux/amd64`. Docker on an ARM host needs amd64
emulation. [Verification](verification.md) records the exercised host and
operations. Windows launcher use and a Linux arm64 image remain unqualified.

## Install the launcher

Install a selected launcher version:

```sh
npm install --global @neutral/intentforge@0.1.0
intentforge --version
```

Or use `npx @neutral/intentforge@0.1.0 --help`. Replace `intentforge` with
`npx @neutral/intentforge@0.1.0` in subsequent launcher commands when using npx.
Installing or updating the npm package installs launcher files only. It neither
pulls an image nor creates, starts, or replaces an environment.

To install an exact downloaded npm archive, use its local path:

```sh
npm install --global /absolute/path/to/neutral-intentforge-0.1.0.tgz
intentforge --help
```

The release workflow creates and qualifies the exact npm archive.
[Distribution](../distribution/README.md#release-ownership) describes its ownership.
The command selects the image recorded in the archive's
`distribution/image-release.json`. Pull that image as described below, or use
the [offline installation procedure](#offline-installation) for a saved image.
An explicit `--image` selects another reviewed, loaded image.

## Pull the released image

Images use `ghcr.io/neutral/intentforge`. The `reference` field in
[image-release.json](../distribution/image-release.json) gives the complete
registry reference selected by this repository. Pull the current 0.1.0 image:

```sh
docker pull --platform linux/amd64 ghcr.io/neutral/intentforge:0.1.0
```

The published `@neutral/intentforge@0.1.0` archive retains the initial image digest
`sha256:883a63418387022bd5fd35dc1a44ad3d85852ee20001ac3e800bd9f6576004aa`.
Its default does not follow updates to the registry tag or this repository.
Use `--image ghcr.io/neutral/intentforge:0.1.0` when creating an environment with
the refreshed image, as shown below. For an exact registry selection, substitute
the full digest reference from `image-release.json` in both `docker pull` and
`--image`.

The launcher checks the loaded image's platform and IntentForge label and saves
its immutable local ID with the environment. Later tag changes leave that saved
selection unchanged. It reports missing images; it never silently downloads or
builds one.

A registry digest identifies the registry manifest. Docker's local image ID
identifies the image configuration; these are different values. Use the published
registry digest for `docker pull` and retain both identities in the release record.
A null `reference` identifies a local review selection; use its loaded image ID
explicitly instead of attempting a registry pull.

## Offline installation

Use the same npm archive and a saved Docker image on a host with npm and Docker
already available. Obtain both from the selected release and compare their
SHA-256 checksums with its retained release information before installation.
For example, use `shasum -a 256 FILE` on macOS or `sha256sum FILE` on Linux.
Then install the archive and load the image:

```sh
npm install --global --offline /absolute/path/to/neutral-intentforge-0.1.0.tgz
intentforge load /absolute/path/to/intentforge-0.1.0-linux-amd64-image.tar
```

`docker image load --input /absolute/path/to/image.tar` also loads a saved image.
A saved archive may restore no tag. Select its recorded image ID with `--image`
when creating an environment in that case. This also applies when the launcher
selects a registry digest that the loaded archive does not restore. Retain the
npm archive, image report, checksums, and image archive together. Installing the
command does not update the applications in an image.

## Choose a workspace once

An independent workspace preserves the original project. Preview a copy before
creating it; the preview shows both source and destination:

```sh
intentforge copy-workspace "/projects/service" "/projects/service IntentForge"
intentforge copy-workspace "/projects/service" "/projects/service IntentForge" --confirm
intentforge create service --workspace "/projects/service IntentForge" --direct \
  --image ghcr.io/neutral/intentforge:0.1.0
```

The first command only previews. The second makes the explicitly confirmed copy
and refuses an existing destination. The third saves that copy as the selected
workspace. Inspect the source before copying; ordinary copies retain its content,
including local project state. New environment names and first container creation require unused state and export
volume names. Existing volumes are never adopted through `create`.
Creating the saved environment starts no services
and performs no Git initialization, cloning, branch changes, or synchronization.

The combined form is `intentforge create service --copy-from SOURCE
--workspace DESTINATION --confirm-copy --image ghcr.io/neutral/intentforge:0.1.0`;
preview with `copy-workspace` first.
An independently prepared checkout is also a valid workspace. Keep its Git
metadata inside the selected directory; a linked worktree that points outside
the mount cannot access that metadata from the container. The built-in copier
refuses symlinks and linked Git metadata. Prepare such projects explicitly with
ordinary copying or Git tools before selecting them.

To work directly in an existing checkout instead, select that effect explicitly:

```sh
intentforge create service --workspace "/projects/service" --direct \
  --image ghcr.io/neutral/intentforge:0.1.0
```

Container edits appear in this checkout immediately. Choose one example for a
given environment name. The selected absolute path is mounted at `/workspace`.
Missing paths and occupied destinations return errors. The launcher neither
mounts the host home directory nor exposes the Docker socket to Workers.

Creation saves the workspace, immutable image identity, Docker engine identity,
Atlas selection, and ports. Container and volume names follow the saved environment
name. The default Atlas path is `atlas`, relative to `/workspace`.
Use `--atlas-path knowledge/atlas` to select another collection explicitly, or
`--atlas-path .` when the workspace root itself contains `atlas.md`.
Default host ports are 4800 for the landing page and Work, 4310 for direct Forge
access, 8787 for Intent, 4721 for Atlas, and 4722 for Atlas preview. Change these
before creation with
`--port`, `--forge-port`, `--intent-port`, `--atlas-port`, and `--preview-port`.
Choose distinct available ports when keeping several environments running.

## Start and open

```sh
intentforge start service
intentforge status service
intentforge open service
```

`start` starts the selected services and prints the landing-page URL. `open` starts
the saved environment if needed and opens that same page. Both accept
`--no-browser` to print the URL without launching a browser. When automatic
opening is unavailable, use the printed URL. `status` reports the saved selection
and container/service state; it does not continue development.

From the landing page, choose **Work**, **Intent**, or **Atlas**. Work opens at
`/work` on the landing page's origin. IntentForge passes only the supported cockpit
routes through to Forge and preserves its request headers, response headers, and
access checks. The dedicated Forge port remains available for advanced direct
access and native controllers.

Intent and Atlas use separate local ports. Their landing links contain per-launch
URLs that establish protected browser sessions. After restart, return through the
landing page to obtain current links. Each product retains its own session, Host,
and Origin checks. Ports bind to host loopback by default. Treat service links and
logs as private local authoring access.

Opening or starting creates no Direction, dispatches no Worker, initializes no
Intent or Atlas, and applies no authored changes. Empty projects show the
components' initialization previews. Confirm scope and review the proposed files
before applying them. Follow [the first task](first-task.md) for authoring and
explicit Worker instructions.

## Authenticate the selected environment

```sh
intentforge login service
intentforge auth-status service
```

Login runs Codex's device authentication inside the selected running container.
Complete the presented login deliberately with the intended account. Its
credentials and conversations stay in that environment's `/state/codex` storage.
Do not import credentials from an unrelated project. If the existing app-server
needs refreshed authentication, explicitly stop and start the environment:

```sh
intentforge stop service
intentforge start service
```

Service readiness only means the applications are available. Authentication
status is a separate check; successful Worker delivery and interpretation require
an actual authorized task. [Verification](verification.md) records the installed
review's authenticated Worker tasks, authored PROGRESS, and the exact outcomes and
limits of native control exercises.

Codex retains its native execution and approval defaults. A native approval
request requires a client able to answer that request. The Work cockpit supplies
Direction controls and is not an approval client. Advanced operators can choose
explicit native policies through Compose; select policies appropriate to the
project and available client. Workers run inside the container with access to its
selected mounts, tools, services, and network.

Some Docker hosts prevent the user namespaces used by Codex's Linux sandbox. In
that case, a Worker can authenticate but fail to launch a command. Diagnose the
reported host restriction before selecting a compatible environment or an
explicitly reviewed native policy. The [verification record](verification.md)
describes the restriction observed in this review and the exercised policy.

### Select native policy for a fresh Worker

Forge accepts explicit `--sandbox` and `--approval-policy` settings on fresh STEER.
If you deliberately choose Docker as the execution boundary for this project,
the following command selects the same native policy as Forge's dedicated Worker
recipe. Run it instead of the first task's fresh STEER, after creating the
Direction and reviewing its selected workspace and tools:

```sh
docker exec intentforge-example /opt/forge/bin/forge steer \
  --direction /workspace/.forge/directions/change --fresh \
  --sandbox danger-full-access --approval-policy never \
  --text 'Read your Direction, inspect the repository, and begin the change.'
```

Substitute the actual container and Direction. This policy lets that Worker run
commands without Codex sandboxing or interactive approvals inside the selected
container. It can change the writable workspace and persistent volumes and use
the container's network. The suite's default policy remains the native default.
Use an approval-capable native client when choosing a policy that requires answers;
the Work cockpit cannot provide them.

The Direction retains explicitly selected settings for continuation and stop.
Forge rejects these overrides on ordinary follow-up STEER. Changing service
environment variables does not replace explicitly saved Worker settings, and
`--fresh` does not stop a previously selected Worker. The
[Forge binding guide](https://github.com/neutral/forge/blob/main/docs/codex-binding.md#native-settings)
owns this behavior. The installed help exposes these options; the image's
[authenticated review](verification.md#authenticated-worker-observations) exercised
command-specific approvals, not this alternative policy.

## Return to saved environments

```sh
intentforge list
intentforge select service
intentforge open
intentforge status
intentforge stop
```

Commands without a name use the saved selection. Configuration lives under
`$INTENTFORGE_HOME` when set, otherwise
`${XDG_CONFIG_HOME:-$HOME/.config}/intentforge`. Keep that directory to preserve
selections. Use `status` to find the container and named volumes before operating
on them with Docker. Creation uses `intentforge-NAME` as the container name.

Return using the same Docker engine. The launcher refuses a selected Docker
context that points to a different engine, so it cannot silently create fresh
state volumes there. Select the original context or explicitly create a separate
environment for that engine.

Stop retains the workspace, container, and volumes. Start restores services;
send explicit STEER to continue Worker development. Follow-up STEER uses the
saved Worker unless the Director selects a fresh Worker. An unusable context
returns an error instead of silently starting another conversation.

## Connect an agent or use a command

Generate fixed-root MCP configuration for review:

```sh
intentforge mcp-config service > intentforge-mcp.json
```

Inspect the container name and `/workspace` root, then add the generated entries
through your chosen host's settings. `--format codex` prints Codex TOML instead.
The launcher does not change real host settings. The host needs Docker access;
it does not need product or Node installations. The selected container must be
running. Generated entries use the caller's current Docker context and do not run
the launcher's engine check. Keep that context pointed to the saved environment's
engine, and review it with the container name before enabling the entries.

The entries use `docker exec -i` without a TTY and invoke the installed Intent
and Atlas adapters directly. They select `/usr/local/bin/node` explicitly and
keep Atlas agent state at `/state/atlas/agent`, separate from Editor state.
Stdout carries only MCP protocol traffic; diagnostics use stderr. Source grants,
read and prepare operations, review, application, and authorized Atlas evaluation
retain each product's own boundaries.

Atlas's direct CLI source reads grant the selected Atlas root by default. A source
elsewhere in `/workspace` needs an explicit `--allow-root` for the directory being
read; the Editor and generated MCP adapter already use the fixed project grant.
Registering a Resource does not grant access to it or permission to publish it.
The [Atlas project guide](https://github.com/neutral/atlas/blob/main/docs/using-from-another-repository.md)
describes source reading and its limits.

For direct commands, substitute the container reported by `status`:

```sh
docker exec intentforge-service /opt/intent/bin/intent --version
docker exec intentforge-service /opt/atlas/bin/atlas --version
docker exec intentforge-service /opt/forge/bin/forge --version
docker exec intentforge-service git -C /workspace status --short
```

Workers can invoke these installed tools themselves. Record the project's
verification commands in its agent guidance. Add project-specific compilers or
services inside an explicitly selected derived image or advanced Compose setup.

## Preserve and replace deliberately

| Location | Retained content |
| --- | --- |
| Selected workspace mounted at `/workspace` | Project files, authored Intent/Atlas, Direction files, checklist documents, Forge SQLite routing and PROGRESS, artifacts, and unfinished project authoring operations. |
| Named volume at `/state` | `/state/codex` authentication, conversations, and app-server logs; `/state/intent` durable drafts; `/state/atlas/editor` drafts and recovery; `/state/atlas/agent` retained agent evidence; private service logs. |
| Named volume at `/exports` | Explicitly exported static sites. |
| `/cache` | Rebuildable cache; keep unique work in persistent storage. |
| Host launcher configuration | Saved environment selections, Docker engine identity, and mount/image/port configuration. |

Keep `/workspace` stable inside the container: product state can be keyed by
that canonical path. MCP observations and expired in-memory proposals do not
survive a process exit; re-read and prepare again when needed. Inspect recovered
Editor drafts before applying. The product installation and disposable container
filesystem are unsuitable for unique work.

Updating the npm launcher leaves saved environments on their selected images.
To update an environment, review and pull or load the new image, inspect its saved
configuration, and back up the workspace, `/state`, `/exports`, and launcher configuration. Stop all
writers before copying storage. With the selected container stopped, Docker's
`cp` can copy `/state` and `/exports` to new backup directories. Protect the backup
as source and credential material. Preserve the original workspace separately.

```sh
intentforge stop service
intentforge replace service --image intentforge:REVIEWED-VERSION --confirm
intentforge status service
intentforge start service
```

Replace the placeholder with the actual loaded image reference or ID. Replacement
requires a stopped container, preserves the same mounts and named volumes, and retains the
previous container under a reported name. The replacement is prepared stopped;
starting it is explicit. Review updated compatibility and inspect retained state
before sending continuation. A changed image reference never silently recreates a
running environment. Never run old and new containers against the same native
state at the same time.

Changed workspace mounts and disposal are separate deliberate choices. Back up
and inspect state before making a new environment with different mounts. Ordinary
stop and update delete no project files, drafts, conversations, or volumes. For
removal, use the container and volume names reported by `status`: stop the
environment, retain any needed backups, then explicitly remove selected Docker
containers and, only when no longer needed, their named volumes. Removing an
image or stopped container alone does not remove the project bind mount. Remove
saved configuration and project copies separately only when intended.

## Advanced Compose

[compose.yaml](../distribution/compose.yaml) and
[.env.example](../distribution/.env.example) expose the underlying service
configuration. Copy `distribution/.env.example` to a new environment file,
set the image, absolute workspace, selected Atlas, ports, and persistent volume
names, then inspect the resolved configuration from the public image source root:

```sh
docker compose --env-file /absolute/path/to/environment.env -f distribution/compose.yaml config
```

For a global npm installation, find the packaged recipe with `npm root --global`:

```sh
INTENTFORGE_PACKAGE="$(npm root --global)/@neutral/intentforge"
docker compose --env-file /absolute/path/to/environment.env -f "$INTENTFORGE_PACKAGE/distribution/compose.yaml" config
```

Copy its `distribution/.env.example` to your chosen environment file before running
that command. With npx, obtain the recipe from the
[public image sources](https://github.com/neutral/intentforge/tree/main/distribution)
or a separate global installation; its cache directory is not a stable
configuration location.

Use that same file and Compose project consistently. Keep launcher-managed and
Compose-managed environments distinct; do not start a second container against
an already active native-state volume.

Preserve loopback publications, exact browser origins, and persistent mount paths.
Keep the native app-server port internal. Use the same `--env-file` and `-f`
arguments for `up --no-recreate`, `stop`, and other Compose commands. Use a
deliberate replacement procedure for changed
images, mounts, ports, or native policies. Container lifecycle operations affect
all services and Workers; they do not substitute for Forge's scoped stop and
continuation controls.
