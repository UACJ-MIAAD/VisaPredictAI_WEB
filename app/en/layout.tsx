import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  description:
    "MIAAD UACJ thesis proposal. Predicting priority dates in the U.S. Visa Bulletin by country or chargeability area, immigration category and table type. Multi-series panel y_{p,c,b,t}, CRISP-DM methodology, 95% prediction intervals.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SiteShell lang="en">{children}</SiteShell>;
}
