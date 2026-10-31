import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectionRefs, collectionTitle } from './core';
const textId = '65f0c1e2a3b4c5d6e7f80910';
test('collection preserves order and repeated readings, strips injected URLs', () => { assert.deepEqual(collectionRefs([{ textId, statia: 2, href: 'javascript:alert(1)' }, { textId }]), [{ textId, statia: 2 }, { textId }]); });
test('collection rejects bad refs and limits', () => { for (const raw of [[{ textId, statia: 0 }], [{ textId: { $ne: '' } }], Array(201).fill({ textId }), null])
    assert.throws(() => collectionRefs(raw)); assert.throws(() => collectionTitle(' '.repeat(10))); assert.throws(() => collectionTitle('x'.repeat(121))); assert.equal(collectionTitle(' Моя подборка '), 'Моя подборка'); });
