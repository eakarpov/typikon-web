import { passportDescriptor } from './passport';
import { canonical, envelope, fail, revision, sha, utf16, validate, type Obj } from './core';

/** Cross-field checks complement OpenAPI: a valid shape can still mix two snapshots. */
function requireThat(condition: unknown, message: string): asserts condition {
    if (!condition) fail('contract_inconsistent', 409, message);
}
function same(a: unknown, b: unknown) { return canonical(a) === canonical(b); }
function index(rows: Obj[], name: string): Map<string, Obj> {
    const result = new Map<string, Obj>();
    for (const row of rows) {
        requireThat(!result.has(row.id), 'Повторный ID: ' + name + '/' + row.id);
        result.set(row.id, row);
    }
    return result;
}
export function checkHistoricalDate(value: Obj) {
    validate('HistoricalDateValue', value);
    const validDate = (date: Obj) => {
        const year = date.year;
        requireThat(year !== 0, 'Историческая дата не имеет нулевого года.');
        if (date.day !== undefined) requireThat(date.month !== undefined, 'День требует месяца.');
        if (date.month !== undefined) {
            const leap = value.calendar === 'julian' ? year % 4 === 0 : value.calendar === 'gregorian' ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) : year % 4 === 0;
            const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            requireThat(date.day === undefined || date.day <= days[date.month - 1], 'Несуществующий день месяца.');
        }
        return [year, date.month ?? 1, date.day ?? 1];
    };
    const compare = (a: Obj, b: Obj) => { const left = validDate(a), right = validDate(b); for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i]; return 0; };
    if (value.kind === 'point') {
        validDate(value.point);
        if (value.precision === 'day') requireThat(value.point.day !== undefined, 'Точность day требует дня.');
        if (value.precision === 'month') requireThat(value.point.month !== undefined, 'Точность month требует месяца.');
    }
    if (value.kind === 'interval') requireThat(compare(value.from, value.to) <= 0, 'Обратный интервал дат.');
    if (value.kind === 'bounds') {
        if (value.lower) validDate(value.lower.date);
        if (value.upper) validDate(value.upper.date);
        if (value.lower && value.upper) requireThat(compare(value.lower.date, value.upper.date) <= 0 && (compare(value.lower.date, value.upper.date) !== 0 || value.lower.inclusive && value.upper.inclusive), 'Пустые или обратные границы дат.');
    }
}
export function checkPassport(data: Obj, declaredDescriptor?: Obj) {
    validate('PassportResponse', envelope(data));
    const descriptor=declaredDescriptor??data.passportDescriptor;
    if(descriptor){validate('PassportDescriptor',descriptor);requireThat(descriptor.sourceId===data.sourceId,'Дескриптор паспорта принадлежит другому источнику.');requireThat(same(descriptor,passportDescriptor(data,descriptor.fields))&&descriptor.fields.length===Object.keys(data.fields).length,'Дескриптор ссылается на другие ревизии метаданных.');}
    const digest=descriptor?revision('pr1',descriptor):revision('pr1',{profile:'passport-r1',sourceId:data.sourceId,assertions:data.assertions,observations:data.observations,sources:data.sources,cases:data.cases,decisions:[],questions:data.questions,fields:data.fields});
    requireThat(digest===data.passportRevision,'Неверный digest паспорта.');
    const subjects = index(data.subjects, 'subject'), assertions = index(data.assertions, 'assertion');
    const observations = index(data.observations, 'observation'), sources = index(data.sources, 'source');
    const questions = index(data.questions, 'question'), cases = index(data.cases, 'case'), reviews = index(data.reviewEvents, 'review');
    const refs = (ids: string[], target: Map<string, Obj>, name: string) => { for (const id of ids) requireThat(target.has(id), 'Нет ссылки ' + name + '/' + id); };
    for (const observation of observations.values()) requireThat(sources.has(observation.sourceRef), 'Нет источника наблюдения.');
    for (const assertion of assertions.values()) {
        requireThat(subjects.has(assertion.subjectId), 'Нет субъекта утверждения.');
        refs(assertion.evidenceLinks.map((e: Obj) => e.observationId), observations, 'observation');
        if (assertion.value.type === 'historical_date') checkHistoricalDate(assertion.value);
        if (['composedAt', 'translatedAt'].includes(assertion.predicate)) requireThat(assertion.value.type === 'historical_date', 'Техническое время не является исторической датой.');
        if (assertion.predicate === 'originalPartOf') requireThat(assertion.value.type === 'entity' && assertion.value.ref?.namespace === 'rules.works', 'Родной канон должен ссылаться на произведение.');
    }
    for (const question of questions.values()) {
        requireThat(subjects.has(question.subjectId), 'Нет субъекта вопроса.');
        refs(question.checkedObservationIds, observations, 'observation'); refs(question.candidateAssertionIds, assertions, 'assertion');
    }
    for (const item of cases.values()) {
        requireThat(subjects.has(item.subjectId), 'Нет субъекта атрибуции.');
        refs(item.assertionIds, assertions, 'assertion'); refs(item.preferredAssertionIds, assertions, 'assertion'); refs(item.reviewEventIds, reviews, 'review');
        requireThat(item.preferredAssertionIds.every((id: string) => item.assertionIds.includes(id)), 'Предпочтение вне вариантов атрибуции.');
    }
    for (const field of Object.values(data.fields) as Obj[]) {
        refs(field.assertionIds, assertions, 'assertion'); refs(field.questionIds, questions, 'question');
        if (field.state === 'unknown') requireThat(field.assertionIds.length === 0, 'Unknown не означает отрицательное утверждение.');
        if (field.state === 'recorded') requireThat(field.assertionIds.length > 0 && field.assertionIds.every((id: string) => assertions.get(id)?.reviewStatus === 'accepted'), 'Непроверенная атрибуция не может быть записана как установленная.');
        if (field.state === 'disputed') requireThat(field.assertionIds.length >= 2 && [...cases.values()].some(c => c.status !== 'resolved' && field.assertionIds.every((id: string) => c.assertionIds.includes(id))), 'Спорное поле требует вариантов и открытого дела.');
    }
}
export function checkRead(data: Obj) {
    validate('ReadResponse', envelope(data));
    const { source, snapshot, resolvedAddress: address, sourceDescriptor: descriptor, profileSet } = data;
    requireThat([snapshot.sourceId, address.sourceId, descriptor.sourceId].every(id => id === source.sourceId), 'Смешаны источники.');
    requireThat(snapshot.sourceRevision === address.sourceRevision && snapshot.passportRevision === address.passportRevision, 'Смешаны ревизии адреса и снимка.');
    requireThat(revision('sr1', descriptor) === snapshot.sourceRevision, 'Неверный digest дескриптора.');
    requireThat(new Set(descriptor.units.map((u: Obj) => u.occurrenceId)).size === descriptor.units.length, 'Повторное вхождение в дескрипторе.');
    const projections = new Map<string, Obj>();
    for (const p of data.projections) {
        requireThat(!projections.has(p.projectionId), 'Повторная проекция.'); projections.set(p.projectionId, p);
        const [start, end] = p.rawWindow; utf16(p.rawText); utf16(p.viewText);
        requireThat(end - start === p.rawText.length && end <= p.bodyLengthUtf16, 'Неверное UTF-16 окно.');
        if (start === 0 && end === p.bodyLengthUtf16) requireThat('br1_' + sha(p.rawText) === p.bodyRevision, 'Неверная ревизия полного тела.');
        requireThat(p.profileSetId === profileSet.id && p.map.profileSetId === profileSet.id && p.map.bodyId === p.bodyId && p.map.bodyRevision === p.bodyRevision && same(p.map.rawWindow, p.rawWindow), 'Карта относится к другому телу или профилю.');
        requireThat(p.map.outputProfileId === profileSet.profiles.display && p.map.outputLengthUtf16 === p.viewText.length, 'Неверный профиль или длина отображения.');
        const base = { bodyId: p.bodyId, bodyRevision: p.bodyRevision, rawWindow: p.rawWindow, profileSetId: p.profileSetId, segments: p.map.segments };
        requireThat(revision('map1', base) === p.map.mapId && revision('proj1', { bodyId: p.bodyId, bodyRevision: p.bodyRevision, rawWindow: p.rawWindow, profileSetId: p.profileSetId, mapId: p.map.mapId }) === p.projectionId, 'Неверный digest карты/проекции.');
        let rawAt = start, outAt = 0;
        for (const segment of p.map.segments) {
            requireThat(segment.outRange[0] === outAt, 'Разрыв карты отображения.'); outAt = segment.outRange[1];
            for (const range of segment.rawRanges) { requireThat(range[0] === rawAt && range[1] >= range[0], 'Разрыв исходной карты.'); rawAt = range[1]; }
            if (segment.operation === 'copy') {
                const copied = segment.rawRanges.map((r: number[]) => p.rawText.slice(r[0] - start, r[1] - start)).join('');
                requireThat(copied === p.viewText.slice(...segment.outRange), 'Операция copy изменила буквы.');
            }
        }
        requireThat(rawAt === end && outAt === p.viewText.length, 'Карта не покрывает окно.');
        const tokenIds = new Set();
        for (const token of p.tokens) {
            const identity = { bodyId: token.bodyId ?? p.bodyId, bodyRevision: token.bodyRevision ?? p.bodyRevision, tokenizerProfileId: token.tokenizerProfileId, type: token.type, rawRanges: token.rawRanges };
            requireThat((token.bodyId === undefined || token.bodyId === p.bodyId) && (token.bodyRevision === undefined || token.bodyRevision === p.bodyRevision) && token.tokenizerProfileId === profileSet.profiles.tokenizer && revision('tok1', identity) === token.tokenId && !tokenIds.has(token.tokenId), 'Токен относится к другой версии или повторён.'); tokenIds.add(token.tokenId);
            requireThat(token.rawRanges.every((r: number[]) => r[0] >= start && r[1] <= end && r[1] > r[0]) && token.surfaceRanges.every((r: number[]) => r[0] >= 0 && r[1] <= p.viewText.length && r[1] > r[0]), 'Смешаны абсолютные и локальные диапазоны.');
            if (token.lookupKey) requireThat(token.lookupKey.profileId === profileSet.profiles.lookup && !token.blockedReason, 'Неверный словарный ключ.');
        }
    }
    for (const unit of data.units) {
        const declared = descriptor.units.find((u: Obj) => u.occurrenceId === unit.occurrenceId);
        requireThat(declared && declared.bodyId === unit.bodyRef.bodyId && declared.bodyRevision === unit.bodyRef.bodyRevision, 'Вхождение относится к другому дескриптору.');
        for (const id of unit.projectionIds) { const p = projections.get(id); requireThat(p && p.bodyId === declared.bodyId && p.bodyRevision === declared.bodyRevision, 'Вхождение ссылается на чужую проекцию.'); }
    }
}
