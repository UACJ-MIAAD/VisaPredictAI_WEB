import { pageMeta } from "@/lib/seo";
import { SectionsPage } from "@/components/pages/sections-page";
export const metadata = pageMeta({ path: "/recursos", lang: "en", title: "Resources", description: "Real project downloads, a working glossary of 42 terms and 64 IEEE references." });
export default function Page() { return <SectionsPage path="/recursos" lang="en" />; }
