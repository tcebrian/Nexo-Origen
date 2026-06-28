import type { MenuIcon } from "./menu";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function SidebarIcon({
  name,
  className = "h-[18px] w-[18px]",
}: {
  name: MenuIcon;
  className?: string;
}) {
  switch (name) {
    case "home":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case "store":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M4 10h16M6 10V20h12V10M9 14h6M10 6h4l1 4H9l1-4Z" />
        </svg>
      );
    case "chat":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 3v-3H7.5A2.5 2.5 0 0 1 5 12.5v-6Z" />
        </svg>
      );
    case "alert":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M12 8v4m0 4h.01M10.3 4.5h3.4L20 18.5H4L10.3 4.5Z" />
        </svg>
      );
    case "ranking":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M7 20V10M12 20V4M17 20v-7" />
        </svg>
      );
    case "shield":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M12 3 19 6v6c0 4.2-3 7.8-7 9-4-1.2-7-4.8-7-9V6l7-3Z" />
        </svg>
      );
    case "talento":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M6 20h12M9 20V10l3-3 3 3v10M12 7V4m-2 3h4" />
        </svg>
      );
    case "reports":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M7 4h7l3 3v13H7V4Zm7 0v3h3M9 12h6M9 16h4" />
        </svg>
      );
    case "settings":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path
            {...stroke}
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5-1.4-.2a6.2 6.2 0 0 0-.5-1.2l.8-1.2-2-2-1.2.8c-.4-.2-.8-.4-1.2-.5L14 6h-4l-.2 1.4c-.4.1-.8.3-1.2.5l-1.2-.8-2 2 1.2.8c-.2.4-.4.8-.5 1.2L6 12l.2 1.4c.1.4.3.8.5 1.2l-.8 1.2 2 2 1.2-.8c.4.2.8.4 1.2.5l.2 1.4h4l.2-1.4c.4-.1.8-.3 1.2-.5l1.2.8 2-2-.8-1.2c.2-.4.4-.8.5-1.2L20 12Z"
          />
        </svg>
      );
    default:
      return null;
  }
}
