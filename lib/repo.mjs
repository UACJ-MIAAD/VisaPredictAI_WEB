// Single source of the data-repo raw base (audit r4). The scrape->RAG pipeline
// pointed at this URL from three places (fetch-data, build-rag-index, and the
// live bulletins component); the repo was already renamed once
// (VisaBulletinScraping -> VisaPredictAI), so a second rename must touch ONE
// line. Plain .mjs so both the Node build scripts and the Next component import it.
export const DATA_REPO_RAW = "https://raw.githubusercontent.com/UACJ-MIAAD/VisaPredictAI/main";
export const BULLETINS_FEED = `${DATA_REPO_RAW}/data/processed/bulletins.json`;
