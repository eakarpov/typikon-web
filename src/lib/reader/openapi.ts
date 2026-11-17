import index from '@/data/reader/index-openapi.json';
import reader from '@/data/reader/openapi.json';
import deprecated from '@/data/reader/deprecations.json';
export function withReaderApi(document: any) {
    const translate = (value: any): any => Array.isArray(value) ? value.map(translate) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, v]) => [key, key === '$ref' && typeof v === 'string' ? v.replace('#/components/schemas/', '#/components/schemas/ReaderV1') : translate(v)])) : value;
    for (const [path, operations] of Object.entries(reader.paths)) document.paths['/api/v2/study/reader/v1' + path] = translate(operations);
    for (const [path, operations] of Object.entries(index.paths)) document.paths['/api/v2/study/reader/v1' + path] = operations;
    for (const [name, schema] of Object.entries(reader.components.schemas)) document.components.schemas['ReaderV1' + name] = translate(schema);
    for (const op of deprecated.operations) { const operation = document.paths[op.path]?.[op.method.toLowerCase()]; if (operation) { operation.deprecated = true; operation['x-reader-replacement'] = op.replacementNamespace + op.replacement; } }
    return document;
}
