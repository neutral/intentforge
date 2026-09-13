ARG BASE_IMAGE
FROM ${BASE_IMAGE}
ARG DEBIAN_SNAPSHOT
ARG NODE_VERSION
ARG SUITE_VERSION
ARG SUITE_PLATFORM
# Dated, signature-checked repositories fix the system package inputs.
RUN rm /etc/apt/sources.list.d/debian.sources \
    && printf 'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/%s/ bookworm main\ndeb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/%s/ bookworm-security main\n' "$DEBIAN_SNAPSHOT" "$DEBIAN_SNAPSHOT" > /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git ripgrep python3 \
    && rm -rf /var/lib/apt/lists/*
COPY payloads/ /opt/
COPY container/ /opt/intentforge/container/
COPY image-inputs.json build-source.json /opt/intentforge/
COPY LICENSE LICENSE.CC0-1.0 LICENSE.0BSD THIRD_PARTY.md /usr/share/doc/intentforge/
COPY container/notices/codex/ /usr/share/doc/codex/
ENV ATLAS_NODE=/usr/local/bin/node INTENT_NODE=/usr/local/bin/node FORGE_NODE=/usr/local/bin/node \
    PATH=/opt/atlas/bin:/opt/intent/bin:/opt/forge/bin:/opt/codex/bin:$PATH \
    CODEX_HOME=/state/codex FORGE_WORKSPACE=/workspace FORGE_DIRECTIONS=/workspace/.forge/directions
# The flattened Atlas payload keeps libvips in its declared dependency tree.
# Register its exact bundled directory with the Linux loader; application bytes stay intact.
RUN find /opt/atlas/app -type f -name 'libvips-cpp.so.*' -printf '%h\n' > /etc/ld.so.conf.d/intentforge-atlas.conf \
    && test "$(wc -l < /etc/ld.so.conf.d/intentforge-atlas.conf)" = 1 && ldconfig
RUN ln -s /opt/codex/bin/codex.js /usr/local/bin/codex \
    && test "$(node --version)" = "v${NODE_VERSION}" \
    && atlas --version && intent --version && forge --version && codex --version \
    && test ! -e /opt/atlas/runtime && test ! -e /opt/intent/runtime && test ! -e /opt/forge/runtime/node \
    && dpkg-query -W > /opt/intentforge/system-packages.txt \
    && sha256sum /usr/local/bin/node > /opt/intentforge/node.sha256 \
    && test -f /usr/local/LICENSE
WORKDIR /workspace
EXPOSE 4800 4310 8787 4721 4722
LABEL org.opencontainers.image.title="IntentForge" org.opencontainers.image.version="${SUITE_VERSION}" \
      org.opencontainers.image.source="https://github.com/neutral/intentforge" \
      org.opencontainers.image.licenses="CC0-1.0 OR 0BSD" org.intentforge.platform="${SUITE_PLATFORM}" org.intentforge.distribution="intentforge"
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 CMD ["node", "/opt/intentforge/container/healthcheck.mjs"]
CMD ["node", "/opt/intentforge/container/supervisor.mjs"]
