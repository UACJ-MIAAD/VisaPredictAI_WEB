import { pageMeta } from "@/lib/seo";
import { RouteHeader } from "@/components/route-header";
import { AssistantConsole } from "@/components/visabot/assistant-console";

export const metadata = pageMeta({
  path: "/asistente",
  lang: "en",
  title: "Assistant",
  description:
    "VisaBot: a retrieval-augmented (RAG) conversational assistant over the project documentation, with cited answers.",
});

export default function Page() {
  return (
    <>
      <RouteHeader path="/asistente" />
      <AssistantConsole />
    </>
  );
}
