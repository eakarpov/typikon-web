"""Compare actual DayPartReading SSR with every complete selected corpus part.

python3 src/scripts/validate-pentecostarion-html.py /tmp/pentecostarion-validation
Uses only the standard library; writes a body-free technical report to stdout.
"""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys


class ReadingBody(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.skip = False
        self.text = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get('class', '').split()
        if tag == 'p':
            self.active = 'text-justify' in classes and 'text-lg' in classes
        if tag == 'a' and self.active:
            self.skip = 'text-xs' in classes  # Footnote labels are annotations, not source words.

    def handle_endtag(self, tag):
        if tag == 'p':
            if self.active:
                self.text.append(' ')
            self.active = False
        if tag == 'a':
            self.skip = False

    def handle_data(self, data):
        if self.active and not self.skip:
            self.text.append(data)


def visible_source(text):
    text = re.sub(r'\{(?:st|pl)\|([^}]+)}', lambda m: m[1].split('|')[-1].strip(), text)
    text = re.sub(r'\{k\|([^}]+)}', r'\1', text)
    return re.sub(r'\{\d+}', '', text)


def normalized(text):
    return ' '.join(text.split())


directory = Path(sys.argv[1])
raw = json.loads((directory / 'raw.json').read_text())
placements = raw['placements']
for i, p in enumerate(placements):
    html = ReadingBody()
    html.feed((directory / f'{i}.html').read_text())
    p['checks']['htmlCompleteSelectedPart'] = normalized(''.join(html.text)) == normalized(visible_source(p['selected']))
    for key in ['selected', 'content', 'footnotes']:
        del p[key]

pairs = []
for text_id in sorted({p['textId'] for p in placements if p['statia']}):
    group = [p for p in placements if p['textId'] == text_id]
    ok = sorted(p['statia'] for p in group) == list(range(1, group[0]['partCount'] + 1))
    pairs.append({'textId': text_id, 'statias': [p['statia'] for p in group], 'completeCoverage': ok})

failed = sum(not all(p['checks'].values()) for p in placements)
report = {
    'validatedAt': raw['validatedAt'], 'scope': 'read-only local corpus; assignments unchanged',
    'summary': {'placements': len(placements), 'texts': len({p['textId'] for p in placements}),
                'days': len({p['dayId'] for p in placements}), 'technicalPassed': len(placements) - failed,
                'technicalFailed': failed},
    'statiaPairs': pairs, 'placements': placements,
}
print(json.dumps(report, ensure_ascii=False, indent=2))
if failed or not all(p['completeCoverage'] for p in pairs):
    sys.exit(1)
