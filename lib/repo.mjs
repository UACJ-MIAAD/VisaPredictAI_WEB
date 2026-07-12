// Single source of the data-repo raw base (audit r4). The scrape->RAG pipeline
// pointed at this URL from three places (fetch-data, build-rag-index, and the
// live bulletins component); the repo was already renamed once
// (VisaBulletinScraping -> VisaPredictAI), so a second rename must touch ONE
// line. Plain .mjs so both the Node build scripts and the Next component import it.
//
// US I6 (plan auditoría 3 repos): content that becomes RAG KNOWLEDGE is fetched
// at a pinned git SHA (dataRepoRawAt(sha), resolved in build from the release
// manifest's git_sha) so a rebuild of the same release reads the same bytes.
// DATA_REPO_RAW (= main) remains ONLY for freshness feeds that must track the
// repo head by design: the release manifest itself, the live bulletins feed,
// and fetch-data's artifact downloads (those are hash-verified per artifact
// against the manifest, so "main" there is a transport, not a trust anchor).
const DATA_REPO_RAW_BASE = "https://raw.githubusercontent.com/UACJ-MIAAD/VisaPredictAI";
export const dataRepoRawAt = (ref) => `${DATA_REPO_RAW_BASE}/${ref}`;
export const DATA_REPO_RAW = dataRepoRawAt("main");
export const BULLETINS_FEED = `${DATA_REPO_RAW}/data/processed/bulletins.json`;
