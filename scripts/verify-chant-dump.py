"""Verify an actual dump, and compare new files with a repeated build.

python3 scripts/verify-chant-dump.py /tmp/full /tmp/repeated > /tmp/report.json
Reads only local artifacts. No database or network access.
"""
import csv
import gzip
import hashlib
import json
from pathlib import Path
import sys

root, repeated = map(Path, sys.argv[1:3])
manifest = json.loads((root / 'manifest.json').read_text())
other = json.loads((repeated / 'manifest.json').read_text())
new_ids = {'chants', 'chant-witnesses'}
new_layers = [layer for layer in manifest['layers'] if layer['id'] in new_ids]
assert {layer['id'] for layer in new_layers} == new_ids
assert other.get('partial') is True and other['doi'] is None
copies = {f['path']: f for layer in other['layers'] for f in layer['files']}
data = {}
checked = 0
for layer in manifest['layers']:
    assert (root / layer['id'] / 'LICENSE.txt').is_file()
    assert (root / layer['id'] / 'README.md').is_file()
    for f in layer['files']:
        file = root / f['path']
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        assert digest == f['sha256'], f['path']
        assert file.stat().st_size == f['bytes'], f['path']
        count = 0
        with gzip.open(file, 'rt', encoding='utf-8', newline='') as stream:
            if file.name.endswith('.csv.gz'):
                reader = csv.reader(stream)
                next(reader)
                count = sum(1 for _ in reader)
            else:
                rows = [] if layer['id'] in new_ids else None
                for line in stream:
                    row = json.loads(line)
                    count += 1
                    if rows is not None:
                        rows.append(row)
                if rows is not None:
                    data[file.name.removesuffix('.jsonl.gz')] = rows
        assert count == f['records'], (f['path'], count, f['records'])
        if layer['id'] in new_ids:
            assert f['sha256'] == copies[f['path']]['sha256'], f['path']
        checked += 1

items = data['chant-items']
ids = {r['item_id'] for r in items}
assert len(ids) == len(items)
for key, table in [('group_id', 'chant-groups'), ('canon_id', 'chant-canons'),
                   ('akathist_id', 'chant-akathists'), ('prayer_id', 'chant-prayers')]:
    parents = {r[key] for r in data[table]}
    assert all(r[key] is None or r[key] in parents for r in items), table
assert all(r['language'] in ['cu', 'cu_gr'] for r in items)
assert all(r['item_id'] in ids and r['other_item_id'] in ids for r in data['chant-links'])
assert all(r['item_id'] in ids for r in data['chant-incipits'])
coverage = data['chant-coverage']
assert sum(r['shippedItems'] for r in coverage) == len(items)
assert all(r['totalItems'] == r['shippedItems'] + r['excludedItems'] for r in coverage)
assert all(not any(k in r for k in ['content', 'rawPath', 'model']) for r in data['witness-sources'])
assert all(r['rightsUrl'] and r['sourceLicense'] for r in data['witness-sources'])
assert all(not layer.get('doi') for layer in new_layers)
print(json.dumps({
    'status': 'passed', 'version': manifest['version'], 'checkedFiles': checked,
    'layers': [layer['id'] for layer in manifest['layers']],
    'newLayers': new_layers, 'coverage': coverage,
    'checks': {'allGzipAndRecordCounts': True, 'allHashesAndSizes': True,
               'repeatedNewFilesIdentical': True, 'parentReferencesPresent': True,
               'textLinksClosed': True, 'sourceBodiesNotShipped': True,
               'newLayersHaveNoInheritedDOI': True, 'partialBuildMarked': True},
}, ensure_ascii=False, indent=2))
