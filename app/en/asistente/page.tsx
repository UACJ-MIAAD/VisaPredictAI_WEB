import { pageMeta } from "@/lib/seo";
import { AssistantConsole } from "@/components/visabot/assistant-console";

export const metadata = pageMeta({
  path: "/asistente",
  lang: "en",
  title: "U.S. Visa Bulletin assistant (VisaBot)",
  description:
    "VisaBot: a retrieval-augmented (RAG) conversational console over the project documentation, with real-data charts and cited answers.",
});

export default function Page() {
  return <AssistantConsole />;
}
