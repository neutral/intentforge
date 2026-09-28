# Third-party components

The IntentForge 0.2.5 image includes Intent 0.1.0, Atlas 1.1.0, Forge 0.1.0,
Node.js 24.18.0, bundled Codex CLI 0.153.4, Trellis 0.6.1, and Debian packages.
Included products and dependencies retain their licenses and notices. The npm
package contains the launcher, guides, metadata, and retained notices;
applications, plugin, and runtimes are provided in the separate image.

| Material | Notices in the image |
| --- | --- |
| Intent and its dependencies | Licenses, notices, and dependency files under `/opt/intent/`. |
| Atlas and its dependencies | Licenses, `THIRD_PARTY.md`, and `dependency-inventory.json` under `/opt/atlas/`; original dependency notices in their bundled `node_modules/` directories. |
| Forge | License files under `/opt/forge/`. |
| Node.js | `/usr/local/LICENSE`. |
| Bundled Codex CLI | `/usr/share/doc/codex/`. |
| Trellis | `LICENSE`, `TERMS.md`, and `PRIVACY.md` in the complete package under `/opt/intentforge/plugins/trellis/`. |
| Debian packages | `/usr/share/doc/`. |
| IntentForge | `/usr/share/doc/intentforge/`. |

The image sources and npm package retain Codex's
[LICENSE](container/notices/codex/LICENSE) and
[NOTICE](container/notices/codex/NOTICE), from the versioned upstream
[license](https://github.com/openai/codex/blob/rust-v0.153.4/LICENSE) and
[notice](https://github.com/openai/codex/blob/rust-v0.153.4/NOTICE).

The public [Trellis package](https://github.com/neutral/trellis) is licensed under
CC0-1.0. The image retains its complete package, including both skill directories,
references, templates, methodology, contract, manifests, and assets.

At startup, IntentForge can install a separately selected official Codex npm
release. Its package notices and integrity metadata remain with that installation
under `/state/tools/codex`. Those notices apply to the downloaded version; the
bundled 0.153.4 notices describe the copy in the image. Retain the downloaded
package's notices when redistributing that installation.

[Image inputs](distribution/image-inputs.json) identify the selected application
archives and runtime. Installed metadata under `/opt/intentforge/` records those
inputs, build sources, system packages, and the Node executable checksum.
Preserve the complete notices and inventories when redistributing or extending
the image. Any missing license metadata remains a limit of that inventory.

IntentForge's [CC0-1.0 or 0BSD license](LICENSE) applies to its original material.
Included components and project sources retain their publishers' terms.
