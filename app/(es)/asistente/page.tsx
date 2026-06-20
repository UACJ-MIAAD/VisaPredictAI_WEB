import { pageMeta } from "@/lib/seo";
import { RouteHeader } from "@/components/route-header";
import { AssistantConsole } from "@/components/visabot/assistant-console";

export const metadata = pageMeta({
  path: "/asistente",
  lang: "es",
  title: "Asistente",
  description:
    "VisaBot: asistente conversacional con recuperación aumentada (RAG) sobre la documentación del proyecto, con respuestas citadas.",
});

export default function Page() {
  return (
    <>
      <RouteHeader path="/asistente" />
      <AssistantConsole />
    </>
  );
}
