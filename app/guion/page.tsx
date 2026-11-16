import type { Metadata } from "next";
import guionData from "./guion-data.json";
import GuionReader, { type GuionData } from "./GuionReader";

export const metadata: Metadata = {
  title: "Guion de la Cumbre | VisaPredictAI",
  description:
    "Guion de práctica y lectura para la exposición académica de VisaPredictAI.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function GuionPage() {
  const data: GuionData = guionData;
  return <GuionReader data={data} />;
}

