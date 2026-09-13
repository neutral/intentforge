# Third-party components

The IntentForge container image includes the complete application payloads for Intent 0.1.0, Atlas
0.9.0, and Forge 0.1.0, one Node.js 24.18.0 runtime, Codex CLI 0.153.4, and base
image packages. Each retains its own license and notices. The npm package
delivers only the launcher, documentation, metadata, and retained notices; the
applications and runtimes travel in the separate image.

| Material | Installed notices |
| --- | --- |
| Intent and its dependencies | Original payload notices, licenses, and dependency files under `/opt/intent/`. |
| Atlas and its dependencies | Original payload notices and dependency inventory under `/opt/atlas/`, including `/opt/atlas/notices/`. |
| Forge | Original license files and guides under `/opt/forge/`. |
| Node.js runtime | `/usr/local/LICENSE`. |
| Codex CLI | `/usr/share/doc/codex/`. |
| Debian packages | `/usr/share/doc/`. |
| Original IntentForge material | `/usr/share/doc/intentforge/`. |

The public image sources and npm package retain the Codex
[LICENSE](container/notices/codex/LICENSE) and
[NOTICE](container/notices/codex/NOTICE), sourced from the versioned upstream
[license](https://github.com/openai/codex/blob/rust-v0.153.4/LICENSE) and
[notice](https://github.com/openai/codex/blob/rust-v0.153.4/NOTICE).

[Image inputs](distribution/image-inputs.json) pin application and runtime identities.
Installed assembly metadata under `/opt/intentforge/` records those inputs,
build sources, system-package inventory, and the shared Node executable checksum.
Keep the complete notices and dependency inventories when distributing or
extending the image. A component's recorded missing license metadata remains an
explicit limit; retention alone does not establish rights clearance.

IntentForge's license choice applies to its original material. Included products,
dependencies, and referenced project sources retain their publishers' terms.
Publication of project sources remains an explicit content selection.
