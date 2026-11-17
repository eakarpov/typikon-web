import { rules } from './native';
/** A newly generated native link explicitly identifies its dataset. Old bare URLs remain public IDs. */
export function nativeChantHref(id: string | number) { return '/chants/' + encodeURIComponent(String(id)) + '?dataset=' + rules().datasetRevision; }
