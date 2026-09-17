import { Dashboard } from "@/components/dashboard";
import { getMarketData } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getMarketData({ refresh: false });
  return <Dashboard initialData={initialData} />;
}
