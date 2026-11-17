import inventory from '@/data/reader/deprecations.json';
/** Edge-compatible: metadata only, never imports the DB or node:crypto. */
export function readerDeprecationHeaders(path: string): Record<string, string> {
    const matches = inventory.operations.some(op => new RegExp('^' + op.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+') + '/?$').test(path));
    return matches ? { Deprecation: '@1794614400', Link: (path.startsWith('/api/v2/study/')?'':'<https://www.typikon.info/license>; rel="license", ')+'<https://www.typikon.info/api/reader-migration>; rel="deprecation"', 'Access-Control-Expose-Headers': 'Deprecation, Link, X-Reader-Replacement', 'X-Reader-Replacement': '/api/v2/study/reader/v1/' } : {};
}
