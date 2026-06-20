import { pageMeta } from "@/lib/seo";
import { AssistantConsole } from "@/components/visabot/assistant-console";

export const metadata = pageMeta({
  path: "/asistente",
  lang: "es",
  title: "Asistente",
  description:
    "VisaBot: consola conversacional con recuperación aumentada (RAG) sobre la documentación del proyecto, gráficos de datos reales y respuestas citadas.",
});

export default function Page() {
  return <AssistantConsole />;
}
