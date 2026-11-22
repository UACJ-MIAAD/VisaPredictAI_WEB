import { ArticlePage } from "@/components/pages/article-page";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/articulo",
  lang: "en",
  title: "When will a priority date become current? · Article",
  description:
    "Web version of the VisaPredict AI scientific article: first-passage forecasts of Visa Bulletin cutoff dates, with the reference class as the yardstick.",
});

export default function Page() {
  return <ArticlePage lang="en" />;
}
