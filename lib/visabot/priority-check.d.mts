import type {Panel} from "../data/panel-core.mjs";
import type {ForecastStore} from "../data/forecasts-core.mjs";
export type PriorityCheckSpec={kind:"priorityCheck";title:string;subtitle:string;result:"needs_input"|"before"|"equal"|"after"|"current"|"unavailable"|"unknown";statement:string;priorityDate:string|null;country:string|null;category:string|null;table:string;bulletinMonth:string;cutoff:string|null;forecastNote:string|null;disclaimer:string;
  /** forecast for the user's date (months YYYY-MM): central path, 95% edges, horizon end */
  forecast:{status:"within"|"crossedBack"|"band"|"beyond";central:string|null;early:string|null;late:string|null;last:string}|null;
  /** the card's headline when there is a forecast; `statement` then reads as today's status */
  headline:string|null;
  rangeText:string|null};
export function validPriorityDate(s:unknown):boolean;
export const PRIORITY_SOURCE:{es:string;en:string};
export function parsePriorityDate(q:string):{date:string|null;issue:string|null;fragments:string[]};
export function isPriorityQuery(q:string):boolean;
export function buildPriorityCheck(q:string,panel:Panel,store:ForecastStore|null,lang:"es"|"en"):PriorityCheckSpec|null;
export function priorityCheckSummary(s:PriorityCheckSpec,lang:"es"|"en"):string;
export function priorityCheckSpec(args:{priorityDate:string|null;country:string|null;category:string|null;table:string},panel:Panel,store:ForecastStore|null,lang:"es"|"en",issue?:string|null):PriorityCheckSpec;
