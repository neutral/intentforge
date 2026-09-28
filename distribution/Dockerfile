ARG BASE_IMAGE
FROM ${BASE_IMAGE}
ARG DEBIAN_SNAPSHOT
ARG NODE_VERSION
ARG SUITE_VERSION
ARG SUITE_PLATFORM
ARG ATLAS_VERSION
ARG TRELLIS_VERSION
# Dated, signature-checked repositories fix the system package inputs.
RUN rm /etc/apt/sources.list.d/debian.sources \
    && printf 'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/%s/ bookworm main\ndeb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/%s/ bookworm-security main\n' "$DEBIAN_SNAPSHOT" "$DEBIAN_SNAPSHOT" > /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git ripgrep python3 \
    && rm -rf /var/lib/apt/lists/*
COPY payloads/ /opt/
COPY container/ /opt/intentforge/container/
COPY image-inputs.json build-source.json /opt/intentforge/
COPY plugin-marketplace.json /opt/intentforge/.agents/plugins/marketplace.json
COPY codex-config.toml /etc/codex/config.toml
COPY LICENSE LICENSE.CC0-1.0 LICENSE.0BSD THIRD_PARTY.md /usr/share/doc/intentforge/
COPY container/notices/codex/ /usr/share/doc/codex/
ENV ATLAS_STATE_HOME=/state/atlas INTENT_NODE=/usr/local/bin/node FORGE_NODE=/usr/local/bin/node \
    PATH=/opt/intent/bin:/opt/forge/bin:$PATH \
    CODEX_HOME=/state/codex FORGE_WORKSPACE=/workspace FORGE_DIRECTIONS=/workspace/.forge/directions
# IntentForge owns shared-runtime launchers outside the intact Atlas npm package.
RUN printf '%s\n' '#!/bin/sh' 'set -eu' 'unset NODE_OPTIONS NODE_PATH' 'exec /usr/local/bin/node /opt/atlas/apps/cli/src/cli.mjs "$@"' > /usr/local/bin/atlas \
    && printf '%s\n' '#!/bin/sh' 'set -eu' 'unset NODE_OPTIONS NODE_PATH' 'exec /usr/local/bin/node /opt/atlas/apps/agent/src/server.mjs "$@"' > /usr/local/bin/atlas-agent \
    && chmod 755 /usr/local/bin/atlas /usr/local/bin/atlas-agent \
    && ln -s /usr/local/bin/atlas /usr/local/bin/atlas-cli \
    && printf '%s\n' '#!/bin/sh' 'exec /usr/local/bin/node /opt/intentforge/container/codex-launch.mjs "$@"' > /usr/local/bin/codex \
    && chmod 755 /usr/local/bin/codex \
    && test "$(node --version)" = "v${NODE_VERSION}" \
    && atlas_version="$(atlas --version)" \
    && printf '%s\n' "$atlas_version" | node -e 'const v=JSON.parse(require("node:fs").readFileSync(0,"utf8")); if(v.format!=="atlas.version/1"||v.version!==process.argv[1]) throw new Error("Atlas CLI version differs from locked input"); console.log(JSON.stringify(v));' "$ATLAS_VERSION" \
    && intent --version && forge --version && node /opt/codex/bin/codex.js --version \
    && test ! -e /opt/atlas/runtime && test ! -e /opt/intent/runtime && test ! -e /opt/forge/runtime/node \
    && dpkg-query -W > /opt/intentforge/system-packages.txt \
    && sha256sum /usr/local/bin/node > /opt/intentforge/node.sha256 \
    && test -f /usr/local/LICENSE
WORKDIR /workspace
EXPOSE 4800 4310 8787 4721 4722
LABEL org.opencontainers.image.title="IntentForge" org.opencontainers.image.version="${SUITE_VERSION}" \
      org.opencontainers.image.source="https://github.com/neutral/intentforge" \
      org.opencontainers.image.licenses="CC0-1.0 OR 0BSD" org.intentforge.platform="${SUITE_PLATFORM}" org.intentforge.distribution="intentforge" \
      org.intentforge.atlas.version="${ATLAS_VERSION}" org.intentforge.trellis.version="${TRELLIS_VERSION}"
HEALTHCHECK --interval=10s --timeout=5s --start-period=150s --retries=12 CMD ["node", "/opt/intentforge/container/healthcheck.mjs"]
CMD ["node", "/opt/intentforge/container/supervisor.mjs"]
