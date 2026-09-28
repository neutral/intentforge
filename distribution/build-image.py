#!/usr/bin/env python3
"""Assemble locked application payloads. Maintainer tool; Python 3.12 or newer."""
import argparse
import hashlib
import json
import re
import shutil
import stat
import subprocess
import tarfile
import unicodedata
import urllib.request
from pathlib import Path, PurePosixPath


COMPONENT_IDS = {'atlas', 'intent', 'forge', 'trellis'}
DOWNLOAD_IDS = {'codex', 'codex-native'}
TRELLIS_SKILLS = {'shape-handbook', 'learn-from-work'}


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate_lock(lock):
    require(lock.get('schema') == 'intentforge.image-inputs.v1', 'Unsupported image input schema')
    require(lock.get('platform') == 'linux/amd64', 'Only the locked linux/amd64 assembly is implemented')
    for field in ['version', 'nodeVersion', 'codexVersion']:
        require(isinstance(lock.get(field), str) and re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?', lock[field]), f'Invalid {field}')
    require(lock['nodeVersion'].split('.')[0] == '24', 'The selected component contracts require shared Node 24')
    require(re.fullmatch(r'[^\s]+@sha256:[0-9a-f]{64}', lock.get('baseImage', '')), 'Base image must have a pinned SHA-256 digest')
    require(re.fullmatch(r'[0-9]{8}T[0-9]{6}Z', lock.get('debianSnapshot', '')), 'Invalid Debian snapshot')
    filenames = set()
    for field, expected in [('components', COMPONENT_IDS), ('downloads', DOWNLOAD_IDS)]:
        entries = lock.get(field)
        require(isinstance(entries, list) and all(isinstance(entry, dict) for entry in entries), f'Invalid {field}')
        ids = [entry.get('id') for entry in entries]
        require(len(ids) == len(expected) and set(ids) == expected, f'{field} must identify exactly {sorted(expected)}')
        for entry in entries:
            filename = entry.get('file', '')
            require(isinstance(filename, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', filename), 'Input file must be a plain filename')
            require(filename not in filenames, f'Duplicate input filename: {filename}')
            filenames.add(filename)
            require(re.fullmatch(r'[0-9a-f]{64}', entry.get('sha256', '')), f'Invalid checksum for {filename}')
            if field == 'components':
                require(isinstance(entry.get('version'), str) and re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?', entry['version']), f'Invalid version for {entry["id"]}')
                require(re.fullmatch(r'[0-9a-f]{40}', entry.get('sourceCommit', '')), f'Invalid source identity for {entry["id"]}')
                if entry['id'] == 'atlas':
                    require(entry['version'] == '1.1.0', 'The Atlas integration requires version 1.1.0')
                    require(isinstance(entry.get('manifestIdentity'), str) and re.fullmatch(r'[0-9a-f]{64}', entry['manifestIdentity']), 'Atlas requires a pinned package manifest identity')
                if entry['id'] == 'trellis':
                    require(entry.get('url') == 'https://codeload.github.com/neutral/trellis/tar.gz/' + entry['sourceCommit'], 'Trellis download must name its exact public source commit')
            else:
                require(isinstance(entry.get('url'), str) and entry['url'].startswith('https://'), f'Download requires HTTPS: {filename}')
    return lock


def extract(archive, destination):
    """Extract one relocatable application root with confined data-only members."""
    destination.mkdir(parents=True)
    with tarfile.open(archive) as bundle:
        members = bundle.getmembers()
        roots = set()
        for member in members:
            parts = PurePosixPath(member.name).parts
            require(parts and not member.name.startswith('/') and '..' not in parts, f'{archive.name}: invalid archive path {member.name!r}')
            roots.add(parts[0])
        require(len(roots) == 1, f'{archive.name}: expected one application root')
        root = destination / next(iter(roots))
        for member in members:
            if member.issym():
                target = (destination / member.name).parent / member.linkname
                require(not Path(member.linkname).is_absolute() and target.resolve().is_relative_to(root.resolve()), f'{archive.name}: symlink escapes application root')
            elif member.islnk():
                target = destination / member.linkname
                require(not Path(member.linkname).is_absolute() and target.resolve().is_relative_to(root.resolve()), f'{archive.name}: hard link escapes application root')
        bundle.extractall(destination, filter='data')
    require(root.is_dir() and not root.is_symlink(), f'{archive.name}: application root must be a directory')
    for entry in root.rglob('*'):
        if entry.is_symlink():
            require(entry.resolve().is_relative_to(root.resolve()), f'{archive.name}: symlink escapes application root')
    return root


def retained_inputs(lock, inputs, output, download_codex=False, download_trellis=False):
    retained = output / 'inputs'
    retained.mkdir()
    verified = []
    for entry in lock['components'] + lock['downloads']:
        source = inputs / entry['file']
        download = (download_codex and entry['id'] in DOWNLOAD_IDS) or (download_trellis and entry['id'] == 'trellis')
        if not source.exists() and download:
            with urllib.request.urlopen(entry['url'], timeout=90) as response, source.open('xb') as target:
                shutil.copyfileobj(response, target)
        require(source.is_file() and digest(source) == entry['sha256'], 'Missing or mismatched input: ' + entry['file'])
        target = retained / entry['file']
        shutil.copy2(source, target)
        require(digest(target) == entry['sha256'], 'Retained input checksum mismatch: ' + entry['file'])
        verified.append({**entry, 'bytes': target.stat().st_size})
    return verified


def require_layout(root, files=(), directories=()):
    for name in files:
        require((root / name).is_file(), f'{root.name}: missing required file {name}')
    for name in directories:
        require((root / name).is_dir(), f'{root.name}: missing required directory {name}')


def validate_atlas_package(root, entry, lock):
    """Verify the complete runtime-free Atlas npm archive without changing it."""
    require_layout(root, files=['package.json', 'manifest.json', 'VERSION', 'dependency-inventory.json',
                              'library/src/index.mjs', 'apps/portal/src/server.mjs',
                              'apps/editor/src/server.mjs', 'LICENSE', 'LICENSE.CC0-1.0', 'LICENSE.0BSD'],
                   directories=['apps/portal/public', 'node_modules/markdown-it', 'spec', 'checks', 'styles', 'docs'])
    require_layout(root, files=['styles/README.md',
                               'styles/explanatory-perspectives.md', 'styles/concise-perspectives.md',
                               'styles/explanatory-subjects.md', 'styles/concise-subjects.md',
                               'styles/explanatory-synthesis.md', 'styles/concise-synthesis.md'])
    require(entry['version'] == '1.1.0', 'The Atlas integration requires version 1.1.0')
    metadata = json.loads((root / 'package.json').read_text())
    require(metadata.get('name') == '@neutral/atlas' and metadata.get('type') == 'module', 'Unsupported Atlas package identity')
    require(metadata.get('version') == entry['version'] and (root / 'VERSION').read_text().strip() == entry['version'], 'atlas: payload version differs from locked version')
    require(metadata.get('engines') == {'node': '>=22.23.2'} and tuple(map(int, lock['nodeVersion'].split('.'))) >= (22, 23, 2), 'Unsupported Atlas Node runtime requirement')
    bins = {'atlas': 'apps/cli/src/cli.mjs', 'atlas-cli': 'apps/cli/src/cli.mjs', 'atlas-agent': 'apps/agent/src/server.mjs'}
    require(metadata.get('bin') == bins, 'Unsupported Atlas command layout')
    require_layout(root, files=bins.values())
    for filename in set(bins.values()):
        require((root / filename).stat().st_mode & 0o111, f'Atlas command must be executable: {filename}')
    require(metadata.get('dependencies') == {'markdown-it': '15.0.2'} and metadata.get('bundledDependencies') == ['markdown-it'], 'Unsupported Atlas bundled dependencies')
    require(not metadata.get('scripts'), 'Atlas package must not require lifecycle scripts')
    require(not (root / 'runtime').exists() and not (root / 'runtime').is_symlink(), 'atlas: expected a runtime-free payload')

    manifest_path = root / 'manifest.json'
    info = manifest_path.lstat()
    require(stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o644 and info.st_size <= 32 * 1024 * 1024, 'Invalid Atlas manifest file')
    manifest = json.loads(manifest_path.read_text())
    require(isinstance(manifest, dict) and set(manifest) == {'format', 'kind', 'name', 'version', 'files', 'identity'}, 'Invalid Atlas manifest fields')
    require(manifest['format'] == 'atlas.manifest/1' and manifest['kind'] == 'package' and manifest['name'] == '@neutral/atlas' and manifest['version'] == entry['version'], 'Unsupported Atlas manifest identity')
    content = {key: value for key, value in manifest.items() if key != 'identity'}
    identity = hashlib.sha256(json.dumps(content, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    require(manifest['identity'] == identity, 'Atlas manifest identity mismatch')
    require(isinstance(manifest['files'], list) and len(manifest['files']) <= 100000, 'Invalid Atlas manifest inventory')
    expected = {}
    for record in manifest['files']:
        require(isinstance(record, dict) and set(record) == {'path', 'bytes', 'sha256', 'mode'}, 'Invalid Atlas manifest file record')
        name = record['path']
        require(isinstance(name, str) and 0 < len(name) < 4096 and unicodedata.normalize('NFC', name) == name
                and not re.search(r'[\\\x00-\x1f\x7f:]', name) and all(part not in ('', '.', '..') for part in name.split('/')),
                'Unsafe Atlas manifest path')
        require(name != 'manifest.json' and name not in expected, 'Duplicate or reserved Atlas manifest path')
        require(type(record['bytes']) is int and 0 <= record['bytes'] <= 256 * 1024 * 1024
                and isinstance(record['sha256'], str) and re.fullmatch(r'[0-9a-f]{64}', record['sha256'])
                and record['mode'] in ('644', '755'), 'Invalid Atlas manifest file metadata')
        expected[name] = record
    require(list(expected) == sorted(expected, key=lambda name: name.encode('utf-16-be')), 'Atlas manifest files must be ordered')
    actual = set()
    for file in root.rglob('*'):
        info = file.lstat()
        name = file.relative_to(root).as_posix()
        require(not stat.S_ISLNK(info.st_mode), f'Atlas package contains a symbolic link: {name}')
        if stat.S_ISDIR(info.st_mode):
            continue
        require(stat.S_ISREG(info.st_mode), f'Atlas package contains a non-file entry: {name}')
        if name == 'manifest.json':
            continue
        require(name in expected, f'Atlas package contains an unlisted file: {name}')
        record = expected[name]
        require(info.st_size == record['bytes'] and stat.S_IMODE(info.st_mode) == int(record['mode'], 8)
                and digest(file) == record['sha256'], f'Atlas manifest file mismatch: {name}')
        actual.add(name)
    require(actual == set(expected), 'Atlas package is missing manifest files')
    require(manifest['identity'] == entry.get('manifestIdentity'), 'Atlas manifest differs from locked package identity')


def validate_trellis_package(root, entry):
    """Retain the complete text-only public plugin, including its notices."""
    require_layout(root, files=['.codex-plugin/plugin.json', 'plugin.json', 'SHA256SUMS',
                                'LICENSE', 'PRIVACY.md', 'TERMS.md', 'README.md', 'CONTRACT.md', 'METHODOLOGY.md'],
                   directories=['skills', 'assets'])
    metadata = json.loads((root / '.codex-plugin/plugin.json').read_text())
    portable = json.loads((root / 'plugin.json').read_text())
    for manifest in [metadata, portable]:
        require(manifest.get('name') == 'trellis' and manifest.get('version') == entry['version'], 'trellis: plugin version or identity differs from locked version')
        require(manifest.get('license') == 'CC0-1.0' and manifest.get('repository') == 'https://github.com/neutral/trellis', 'Unsupported Trellis license or source identity')
    require(metadata.get('skills') == './skills/', 'Unsupported Trellis skill directory')
    require(set(metadata) <= {'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'skills', 'interface'}, 'Trellis must contain skills without runtime integrations')
    require({item.name for item in (root / 'skills').iterdir()} == TRELLIS_SKILLS, 'Unsupported Trellis skill inventory')
    for skill in sorted(TRELLIS_SKILLS):
        require_layout(root, files=[f'skills/{skill}/SKILL.md', f'skills/{skill}/agents/openai.yaml',
                                    f'skills/{skill}/references/methodology.md', f'skills/{skill}/references/CONTRACT.md'])
        for source, copy in [('METHODOLOGY.md', 'methodology.md'), ('CONTRACT.md', 'CONTRACT.md')]:
            require((root / source).read_bytes() == (root / 'skills' / skill / 'references' / copy).read_bytes(), 'Trellis standalone guidance differs from its owner')

    inventory = root / 'SHA256SUMS'
    require(inventory.lstat().st_size <= 1024 * 1024, 'Trellis checksum inventory is too large')
    expected = {}
    for line in inventory.read_text().splitlines():
        record = re.fullmatch(r'([0-9a-f]{64})  (.+)', line)
        require(record is not None, 'Invalid Trellis checksum record')
        checksum, name = record.groups()
        require(unicodedata.normalize('NFC', name) == name and not re.search(r'[\\\x00-\x1f\x7f:]', name)
                and all(part not in ('', '.', '..') for part in name.split('/')), 'Unsafe Trellis checksum path')
        require(name != 'SHA256SUMS' and name not in expected, 'Duplicate or reserved Trellis checksum path')
        expected[name] = checksum
    require(expected, 'Empty Trellis checksum inventory')
    actual = set()
    for file in root.rglob('*'):
        info = file.lstat()
        name = file.relative_to(root).as_posix()
        require(not stat.S_ISLNK(info.st_mode), f'Trellis package contains a symbolic link: {name}')
        if stat.S_ISDIR(info.st_mode):
            continue
        require(stat.S_ISREG(info.st_mode), f'Trellis package contains a non-file entry: {name}')
        require(not info.st_mode & 0o7111, f'Trellis package contains an executable file: {name}')
        if name == 'SHA256SUMS':
            continue
        require(name in expected, f'Trellis package contains an unlisted file: {name}')
        require(digest(file) == expected[name], f'Trellis checksum mismatch: {name}')
        actual.add(name)
    require(actual == set(expected), 'Trellis package is missing checksum files')


def validate_payload(component, root, entry, lock):
    if component == 'atlas':
        validate_atlas_package(root, entry, lock)
        return
    if component == 'trellis':
        validate_trellis_package(root, entry)
        return
    require_layout(root, files=[f'bin/{component}'])
    require((root / f'bin/{component}').stat().st_mode & 0o111, f'{component}: launcher must be executable')
    if component == 'forge':
        require_layout(root, files=['forge-application.json', 'package.json', 'src/index.mjs', 'runtime/worker-entry.mjs', 'guides/operate.md'], directories=['cli', 'web', 'spec'])
        identity = json.loads((root / 'forge-application.json').read_text())
        require(identity.get('schemaVersion') == 1 and identity.get('layoutVersion') == 1 and identity.get('name') == 'forge', 'Unsupported Forge application layout')
        forbidden = root / 'runtime/node'
    else:
        require_layout(root, files=['payload.json'], directories=['app'])
        identity = json.loads((root / 'payload.json').read_text())
        forbidden = root / 'runtime'
        require_layout(root, files=['inventory.json', 'app/package.json'])
        require(identity.get('schema') == 'intent.application-payload.v1' and 'linux-x64' in identity.get('supportedTargets', []), 'Intent requires a Linux x64 compatible application payload')
        require(identity.get('entry') == 'bin/intent' and identity.get('application') == 'app' and identity.get('runtimeVariable') == 'INTENT_NODE', 'Unsupported Intent application layout')
    require(identity.get('version') == entry['version'], f'{component}: payload version differs from locked version')
    require(not forbidden.exists() and not forbidden.is_symlink(), f'{component}: expected a runtime-free payload; found {forbidden.relative_to(root)}')


def prepare_context(repo, lock, inputs, output, download_codex=False, download_trellis=False):
    validate_lock(lock)
    require(inputs.is_dir(), 'Input directory does not exist: ' + str(inputs))
    output.mkdir(parents=True, exist_ok=False)
    context = output / 'context'
    context.mkdir()
    verified = retained_inputs(lock, inputs, output, download_codex, download_trellis)
    payloads = context / 'payloads'
    payloads.mkdir()
    entries = {entry['id']: entry for entry in verified}
    for component in sorted(COMPONENT_IDS):
        entry = entries[component]
        root = extract(output / 'inputs' / entry['file'], output / ('unpack-' + component))
        validate_payload(component, root, entry, lock)
        target = payloads / ('intentforge/plugins/trellis' if component == 'trellis' else component)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(root), target)
    codex = extract(output / 'inputs' / entries['codex']['file'], output / 'unpack-codex')
    native = extract(output / 'inputs' / entries['codex-native']['file'], output / 'unpack-codex-native')
    require_layout(codex, files=['package.json', 'bin/codex.js'])
    require_layout(native, files=['package.json', 'vendor/x86_64-unknown-linux-musl/bin/codex'])
    for root, version in [(codex, lock['codexVersion']), (native, lock['codexVersion'] + '-linux-x64')]:
        identity = json.loads((root / 'package.json').read_text())
        require(identity.get('name') == '@openai/codex' and identity.get('version') == version, 'Codex package differs from locked version')
    shutil.move(str(codex), payloads / 'codex')
    shutil.move(str(native / 'vendor'), payloads / 'codex/vendor')
    shutil.copytree(repo / 'container', context / 'container')
    for name in ['Dockerfile', '.dockerignore', 'codex-config.toml', 'plugin-marketplace.json']:
        shutil.copy2(repo / 'distribution' / name, context / name)
    (context / 'image-inputs.json').write_text(json.dumps(lock, indent=2) + '\n')
    for name in ['LICENSE', 'LICENSE.CC0-1.0', 'LICENSE.0BSD', 'THIRD_PARTY.md']:
        shutil.copy2(repo / name, context / name)
    source_files = {str(path.relative_to(context)): digest(path) for path in sorted(context.rglob('*')) if path.is_file() and 'payloads' not in path.relative_to(context).parts}
    (context / 'build-source.json').write_text(json.dumps({'schema': 'intentforge.build-source.v1', 'files': source_files, 'inputs': verified}, indent=2) + '\n')
    return context, verified


def build_image(lock, output, context, verified, tag, no_save=False):
    iidfile = output / 'image-id.txt'
    atlas_version = next(entry['version'] for entry in lock['components'] if entry['id'] == 'atlas')
    trellis_version = next(entry['version'] for entry in lock['components'] if entry['id'] == 'trellis')
    arguments = {'BASE_IMAGE': lock['baseImage'], 'DEBIAN_SNAPSHOT': lock['debianSnapshot'], 'NODE_VERSION': lock['nodeVersion'], 'SUITE_VERSION': lock['version'], 'SUITE_PLATFORM': lock['platform'], 'ATLAS_VERSION': atlas_version, 'TRELLIS_VERSION': trellis_version}
    command = ['docker', 'buildx', 'build', '--load', '--platform', lock['platform'], '--provenance=false', '--iidfile', str(iidfile)]
    for name, value in arguments.items():
        command.extend(['--build-arg', name + '=' + value])
    # Stream the selected bytes instead of relying on local-directory metadata
    # comparisons: npm archives can retain equal sizes and fixed timestamps.
    context_archive = output / 'build-context.tar.gz'
    with tarfile.open(context_archive, 'x:gz', compresslevel=1, dereference=False) as archive:
        for source in sorted(context.iterdir()):
            archive.add(source, arcname=source.name)
    command.extend(['--file', 'Dockerfile', '--tag', tag, '-'])
    with context_archive.open('rb') as context_stream, (output / 'build.log').open('w') as log:
        subprocess.run(command, stdin=context_stream, stdout=log, stderr=subprocess.STDOUT, check=True)
    image_id = iidfile.read_text().strip()
    require(re.fullmatch(r'sha256:[0-9a-f]{64}', image_id), 'Build did not report a valid immutable image ID')
    image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image_id], text=True))[0]
    require(image.get('Id') == image_id and image.get('Architecture') == 'amd64' and image.get('Os') == 'linux', 'Built image identity or platform differs from the selected build')
    report = {'schema': 'intentforge.image-build.v1', 'version': lock['version'], 'tag': tag, 'id': image_id, 'platform': lock['platform'], 'inputs': verified, 'baseImage': lock['baseImage'], 'debianSnapshot': lock['debianSnapshot'], 'imageInputs': lock, 'nodeVersion': lock['nodeVersion'], 'codexVersion': lock['codexVersion'], 'buildSourceSHA256': digest(context / 'build-source.json')}
    if not no_save:
        archive = output / f'intentforge-{lock["version"]}-{lock["platform"].replace("/", "-")}-image.tar'
        subprocess.run(['docker', 'image', 'save', '--output', str(archive), image_id], check=True)
        report['archive'] = {'file': archive.name, 'sha256': digest(archive), 'bytes': archive.stat().st_size}
        (output / 'SHA256SUMS').write_text(report['archive']['sha256'] + '  ' + archive.name + '\n')
    (output / 'image.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inputs', type=Path, required=True, help='Directory containing the exact application, Trellis, and Codex archives')
    parser.add_argument('--output', type=Path, required=True, help='New staging and artifact directory (preserved on failure)')
    parser.add_argument('--tag', help='Local candidate tag (default intentforge:VERSION-candidate)')
    parser.add_argument('--download-codex', action='store_true', help='Fetch missing pinned Codex archives into the input directory')
    parser.add_argument('--download-trellis', action='store_true', help='Fetch the missing pinned public Trellis archive into the input directory')
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--no-save', action='store_true', help='Skip Docker image tar output during development')
    modes.add_argument('--prepare-only', action='store_true', help='Verify inputs and stage the build context without invoking Docker')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    lock = validate_lock(json.loads((repo / 'distribution/image-inputs.json').read_text()))
    context, verified = prepare_context(repo, lock, args.inputs.resolve(), args.output.resolve(), args.download_codex, args.download_trellis)
    if args.prepare_only:
        print(json.dumps({'context': str(context), 'platform': lock['platform'], 'status': 'prepared; no image built'}, indent=2))
        return
    report = build_image(lock, args.output.resolve(), context, verified, args.tag or f'intentforge:{lock["version"]}-candidate', args.no_save)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
