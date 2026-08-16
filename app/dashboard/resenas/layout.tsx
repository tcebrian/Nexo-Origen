import { ReviewFiltersProvider } from "./_components/review-filters-context";

export default function ResenasLayout({ children }: { children: React.ReactNode }) {
  return <ReviewFiltersProvider>{children}</ReviewFiltersProvider>;
}
