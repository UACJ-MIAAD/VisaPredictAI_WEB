import { PlanPage } from "@/components/pages/plan-page";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/plan",
  lang: "en",
  title: "MLOps plan and progress",
  description:
    "Verifiable dashboard for the VisaPredict AI MLOps plan: overall progress, epic status, user stories, execution route and progress log.",
});

export default function Page() {
  return <PlanPage lang="en" />;
}
