import { pageMeta } from "@/lib/seo";
import { HomePage } from "@/components/pages/home-page";
export const metadata = pageMeta({ path: "/", lang: "en", title: "VisaPredict AI · U.S. Visa Bulletin forecasting", description: "Forecasting U.S. Visa Bulletin priority dates by chargeability area, category and table. Multi-series panel, CRISP-DM, 95% prediction intervals." });
export default function Page() { return <HomePage lang="en" />; }
