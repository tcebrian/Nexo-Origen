import { textKicker, textSectionDesc, textSectionTitle } from "./ui/talento-styles";

type TalentoSectionHeaderProps = {
  kicker: string;
  title: string;
  description?: string;
};

export function TalentoSectionHeader({ kicker, title, description }: TalentoSectionHeaderProps) {
  return (
    <header className="mb-6 border-b border-white/[0.05] pb-5">
      <p className={textKicker}>{kicker}</p>
      <h2 className={`mt-1.5 ${textSectionTitle}`}>{title}</h2>
      {description ? <p className={textSectionDesc}>{description}</p> : null}
    </header>
  );
}
