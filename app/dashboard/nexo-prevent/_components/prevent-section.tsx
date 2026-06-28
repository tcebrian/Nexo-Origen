import type { PreventRecord } from "@/lib/prevent/types";
import { PreventRestaurantCard } from "./prevent-restaurant-card";
import { sectionPad, textKicker, textSectionTitle } from "./ui/prevent-styles";

type PreventSectionProps = {
  kicker: string;
  title: string;
  description?: string;
  records: PreventRecord[];
  emptyMessage: string;
};

export function PreventSection({
  kicker,
  title,
  description,
  records,
  emptyMessage,
}: PreventSectionProps) {
  return (
    <section className={`border-b border-white/[0.05] ${sectionPad} py-9 last:border-b-0`}>
      <p className={textKicker}>{kicker}</p>
      <h2 className={`mt-2 ${textSectionTitle}`}>{title}</h2>
      {description && <p className="mt-2 text-[13px] text-gray-600">{description}</p>}

      {records.length === 0 ? (
        <p className="mt-10 text-[14px] text-gray-600">{emptyMessage}</p>
      ) : (
        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          {records.map((record) => (
            <PreventRestaurantCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </section>
  );
}
