import type {Panel} from "../data/panel-core.mjs";
export const COUNTRY_ALIASES: [RegExp,string][];
export function queryEntities(q:string,panel:Panel): {country:string|null;category:string|null;table:string|null;block:string|null};
