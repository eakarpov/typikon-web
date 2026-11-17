import { SERVICE_KINDS } from './priestQueueRules';
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { 'application/json': { schema } } });
const nullableDate = { type: ['string', 'null'], format: 'date-time' };
export const priestSchemas = {
    NotePartStatus: {type:'object',properties:{part:{enum:['living','departed']},namesCount:{type:'integer'},readAt:nullableDate,queueStatus:{enum:['waiting','assigned','read','expired']},assignment:ref('NoteAssignment')}},
    PriestMutationResult: { type: 'object', properties: { ok: { type: 'boolean' }, noteId: { type: ['string', 'null'] }, serviceId: { type: 'string' } } },
    PriestClaimResult: { type: 'object', properties: { claim: ref('PriestClaim'), domain: { type: 'object' } } },
    PriestNotice: { type: 'object', properties: { show: { type: 'boolean' }, serviceId: { type: 'string' }, userId: { type: 'string' }, startsAt: nullableDate } },
    PriestServiceSettings: { type: 'object', required: ['kind', 'enabled', 'namesLimit', 'startsAt', 'timeZone', 'reminderEnabled'],
        properties: { kind: { enum: SERVICE_KINDS }, enabled: { type: 'boolean', default: false },
            namesLimit: { type: 'integer', minimum: 1, maximum: 10000, default: 30 }, startsAt: nullableDate,
            timeZone: { type: 'string', description: 'Часовой пояс IANA; startsAt передаётся с UTC offset' },
            reminderEnabled: { type: 'boolean', default: false }, id: { type: 'string' },
            status: { enum: ['scheduled', 'reading', 'finished', 'expired'] },
            flowVersion:{type:'integer',enum:[1,2]},readingPhase:{enum:['living','departed',null]},readingMode:{enum:['batch','extra']},
            startedAt: nullableDate, expiresAt: nullableDate, finishedAt: nullableDate,
            editableUntil: { ...nullableDate, description: 'Править тип и дату можно только до этого срока, пока нет назначенных записок. Каждое сохранение даёт две минуты до подбора.' }, readyAt: nullableDate, acceptedNames: { type: 'integer' } } },
    PriestClaim: { type: 'object', required: ['title', 'dioceseUrl', 'email'], properties: {
        title: { type: 'string', maxLength: 120 }, dioceseUrl: { type: 'string', format: 'uri', maxLength: 300 },
        email: { type: 'string', format: 'email', maxLength: 200 }, evidence: { type: ['string', 'null'], maxLength: 1000 },
        status: { enum: ['pending', 'letter-sent', 'verified', 'approved', 'rejected'] },
        decisionNote: { type: ['string', 'null'] }, createdAt: nullableDate } },
    PriestProfile: { type: 'object', required: ['approved', 'claim', 'priest', 'services'], properties: {
        approved: { type: 'boolean' }, claim: { anyOf: [ref('PriestClaim'), { type: 'null' }] },
        priest: { type: ['object', 'null'], properties: { title: { type: 'string' }, place: { type: ['string', 'null'] },
            inviteCode: { type: 'string' }, donationDetails: { type: ['string', 'null'] } } },
        services: { type: 'array', items: ref('PriestServiceSettings') } } },
    PriestQueue: { type: 'object', properties: { services: { type: 'array', items: { allOf: [ref('PriestServiceSettings'), {
        type: 'object', properties: { items: { type: 'array', items: { allOf: [ref('Zapiska'), {
            type: 'object', properties: { extra: { type: 'boolean' }, part:{enum:['living','departed']} } }] } },
            waitingByPhase:{type:'object',description:'Отдельные количества свободных дополнительных записок и имён для living/departed'}, waitingNotes: { type: 'integer' }, waitingNames: { type: 'integer' } } }] } } } },
    NoteAssignment: { type: ['object', 'null'], properties: { serviceId: { type: 'string' }, startsAt: nullableDate,
        timeZone: { type: 'string' }, title: { type: 'string' }, place: { type: ['string', 'null'] },
        donationDetails: { type: ['string', 'null'] } } },
};
export function priestPaths(personal: any) {
    const errors = { '400': { description: 'Неверные данные' }, '401': { description: 'unauthorized — нет действующего ключа; session_required — нет действующей пользовательской сессии' },
        '403': { description: 'Доступ иерея не подтверждён' }, '409': { description: 'Очередь изменилась или требуется подтверждение переноса' },
        '429': { description: 'Лимит запросов' } };
    const operation = (summary: string, schema: string, input?: object, created = false) => ({
        tags: ['Помянник'], summary, security: personal,
        description: 'Личные данные: private,no-store. Заявка использует существующую административную проверку. Имена не передаются в push.',
        ...(input ? { requestBody: { required: true, ...json(input) } } : {}),
        responses: { [created ? '201' : '200']: { description: 'Успех', ...json(ref(schema)) }, ...errors },
    });
    return {
        '/api/v2/pomyannik/priest/profile': { get: operation('Статус заявки, права и настройки иерея', 'PriestProfile') },
        '/api/v2/pomyannik/priest/claim': { post: operation('Подать заявку на доступ иерея', 'PriestClaimResult', ref('PriestClaim'), true) },
        '/api/v2/pomyannik/priest/settings': { put: operation('Настроить приём на три вида служб', 'PriestMutationResult', {
            type: 'object', required: ['services', 'donationDetails'], properties: {
                services: { type: 'array', minItems: 3, maxItems: 3, items: ref('PriestServiceSettings') },
                donationDetails: { type: 'string', maxLength: 1000 }, policyOnly: { type: 'boolean', description: 'Настройки приёма без дат; даты задаются при создании службы' }, confirmReschedule: { type: 'boolean', default: false } } }) },
        '/api/v2/pomyannik/priest/queue': { get: {...operation('Пачки по службам и счётчики общей очереди', 'PriestQueue'),parameters:[{name:'flow',in:'query',schema:{enum:['two-stage']},description:'Раздельные карточки частей смешанной записки'},{name:'archive',in:'query',schema:{type:'boolean'}}]},
            post: operation('Создать, изменить, удалить в двухминутном окне, начать или завершить службу; помянуть записку или взять дополнительную', 'PriestMutationResult', {
                type: 'object', required: ['action'], properties: { action: { enum: ['create', 'edit', 'delete', 'start', 'advance', 'finish', 'read', 'extra'] },
                    twoStage:{type:'boolean',description:'Начать цепочку здравие → упокоение с независимыми отметками; повторное начало сохраняет исходный срок'},part:{enum:['living','departed']}, noteId: { type: 'string' }, serviceId: { type: 'string' }, kind: { enum: SERVICE_KINDS }, startsAt: nullableDate, timeZone: { type: 'string' } } }) },
        '/api/v2/pomyannik/priest/notice': { get: { ...operation('Проверить актуальность напоминания', 'PriestNotice'),
            parameters: [{ name: 'serviceId', in: 'query', required: true, schema: { type: 'string' } }] } },
    };
}
