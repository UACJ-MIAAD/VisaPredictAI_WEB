import { PublicationPage } from "@/components/pages/publication-page";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/publicacion",
  lang: "en",
  title: "Indexed-journal publication plan",
  description:
    "Verifiable plan to take VisaPredict AI to an indexed journal: three target journals, expert round table, 10–30 year turn-date estimator and weekly route.",
});

export default function Page() {
  return <PublicationPage lang="en" />;
}
