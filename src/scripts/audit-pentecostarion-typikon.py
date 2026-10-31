"""Сопоставить read-only снимок audit-release-6-4.ts с редакторской сверкой Типикона.

python3 src/scripts/audit-pentecostarion-typikon.py /tmp/release-6-4.json > /tmp/typikon-review.json
Не подключается к БД и ничего не исправляет. Результат — JSON в stdout.
Редакторские выводы rules.json относятся к дате сверки, а не вычисляются заново.
"""
import collections
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
rules = json.loads((ROOT / 'docs/audits/pentecostarion-typikon-rules.json').read_text())
validation_path = ROOT / 'docs/audits/pentecostarion-local-validation.json'
validation = json.loads(validation_path.read_text()) if validation_path.exists() else {}
validated = {(p['dayId'], p['slot'], p['index']): p for p in validation.get('placements', [])}
snapshot = json.loads(Path(sys.argv[1]).read_text())
period = next(p for p in snapshot['periods'] if p['period'] == 'penticostarion')
days = []
seen = set()
for row in period['rows']:
    offset = ((row['value'] - 1) * 7 + row['weekIndex'] if row['type'] == 'Pascha'
              else 49 + row['weekIndex'])
    assert offset not in seen, f'Повтор дня +{offset}'
    seen.add(offset)
    rule = rules['days'][offset]
    checks = []
    for slot, expected in rule['expectedBible'].items():
        actual = [e['pericope'] for e in row['entries'] if e['slot'] == slot and e.get('pericope')]
        checks.append({'slot': slot, 'expected': expected, 'actual': actual,
                       'result': 'matches-book-number' if any(
                           all(p.get(k) == v for k, v in expected.items()) for p in actual)
                       else 'missing' if not actual else 'different'})
    classified = []
    for entry in row['entries']:
        e = dict(entry)
        book, slot = e.get('book'), e['slot']
        if e.get('pericope'):
            review = ('triodion-liturgical-text' if e['pericope'].get('liturgicalText')
                      else 'paremia-books-and-incipits' if e['pericope']['source'] == 'paremia'
                      else 'lectionary-book-number')
        elif e['status'] == 'continuous-reading':
            review = ('james-cycle-beginning' if e['continuousReading']['bookSlug'] == 'iakova'
                      else 'chosen-acts-variant')
        elif e['status'] == 'calendar-reference':
            review = 'calendar-prologue-reference'
        elif offset == 56 and slot in ['kathisma1', 'kathisma2']:
            review = 'holiday-gospel-commentary;division-editorial'
        elif offset == 49 and slot in ['kathisma1', 'kathisma2']:
            review = 'incipit-matches-attribution-open'
        elif offset == 42 and slot in ['kathisma1', 'kathisma2']:
            review = 'explicit-incipit-matches'
        elif offset == 48 and slot == 'kathisma1' and e.get('textId') == '68e77afb42faa8ee591f64a7':
            review = 'identified-chrysostom-1cor41-excerpt'
        elif offset == 0 and slot == 'song6' and book == 'Сборник слов Григория Богослова':
            review = 'conditional-kyrio-pascha-human-description'
        elif book == 'Беседы на Евангелие от Иоанна':
            review = 'john-cycle-book;division-editorial'
        elif book == 'Синаксари Цветной Триоди':
            review = 'day-synaxarion'
        elif book == 'Оглашения Феодора Студита':
            review = 'studite-general-rule;word-editorial'
        elif book == 'Толковый апостол' or slot == 'panagia':
            review = 'editorial-selection;not-numbered-by-typikon'
        elif book == 'Сборник слов Григория Богослова' or slot == 'apolutikaTroparia':
            review = 'named-holiday-reading'
        else:
            review = 'thematic-reading;exact-identification-open'
        local = validated.get((row['id'], slot, e['index']))
        if local:
            matches = (local['textId'] == e.get('textId')
                       and local['sha256'] == e.get('contentSha256')
                       and local.get('statia') == e.get('statia')
                       and local.get('bookIndex') == e.get('bookIndex')
                       and local.get('name') == e.get('name')
                       and local.get('book') == e.get('book')
                       and e.get('readiness') == 'ready')
            e['localValidation'] = {
                'status': 'passed' if matches and local.get('status') == 'passed' else 'stale-or-failed',
                'validatedAt': validation['validatedAt'],
                'report': 'pentecostarion-local-validation.json',
            }
            if e['localValidation']['status'] == 'passed':
                review = 'local-corpus-validated'
        e['sourceReview'] = review
        classified.append(e)
    findings = [f for f in rules['findings'] if f['offset'] == offset]
    days.append({**row, 'offset': offset, 'source': {k: v for k, v in rule.items()
                 if k.startswith('source')}, 'bibleChecks': checks, 'findings': findings,
                 'entries': classified})

assert seen == set(range(57)), f'Нет дней: {set(range(57)) - seen}'
days.sort(key=lambda d: d['offset'])
statuses = collections.Counter(e['status'] for d in days for e in d['entries'])
john = {e['bookIndex'] for d in days for e in d['entries']
        if e.get('book') == 'Беседы на Евангелие от Иоанна'}
result = {
    'reviewedAt': rules['reviewedAt'], 'snapshotGeneratedAt': snapshot['generatedAt'],
    'scope': rules['scope'], 'sources': rules['sources'], 'bibleTables': rules['bibleTables'],
    'companionSources': rules['companionSources'], 'openQuestions': rules['openQuestions'],
    'deferredValidationCases': rules.get('deferredValidationCases', {}),
    'resolvedFindings': rules.get('resolvedFindings', []),
    'withdrawnFindings': rules.get('withdrawnFindings', []),
    'resolvedDiscrepancies': rules.get('resolvedDiscrepancies', []),
    'localValidation': {'report': 'pentecostarion-local-validation.json',
                        'validatedAt': validation.get('validatedAt'),
                        'scope': validation.get('scope'),
                        'statuses': dict(collections.Counter(e['localValidation']['status']
                            for d in days for e in d['entries'] if e.get('localValidation')))},
    'summary': {'days': len(days), 'placements': sum(statuses.values()),
                'statuses': dict(statuses),
                'bibleChecks': dict(collections.Counter(c['result'] for d in days for c in d['bibleChecks'])),
                'missingPlacements': sum(f['count'] for f in rules['findings'] if f['kind'] == 'missing'),
                'differentBookPlacements': sum(f['count'] for f in rules['findings'] if f['kind'] == 'different-book'),
                'resolvedPlacements': sum(f['count'] for f in rules.get('resolvedFindings', [])),
                'liturgicalTextPlacements': sum(bool(e.get('pericope', {}).get('liturgicalText'))
                                               for d in days for e in d['entries'] if e.get('pericope')),
                'johnHomilies': sorted(john), 'johnHomiliesNotAssigned': sorted(set(range(1, 89)) - john),
                'sourceReview': dict(collections.Counter(e['sourceReview'] for d in days for e in d['entries']))},
    'days': days,
}
print(json.dumps(result, ensure_ascii=False, indent=2))
