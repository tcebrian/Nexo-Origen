export type CommentDisplay = {
  text: string;
  sizeClass: "nra-comment--lg" | "nra-comment--md" | "nra-comment--sm";
  showReadMore: boolean;
};

function truncateAtWord(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const slice = trimmed.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

export function getCommentDisplay(comment: string): CommentDisplay {
  const text = comment.trim();
  const length = text.length;

  if (length <= 280) {
    return { text, sizeClass: "nra-comment--lg", showReadMore: false };
  }

  if (length <= 500) {
    return { text, sizeClass: "nra-comment--md", showReadMore: false };
  }

  return {
    text: truncateAtWord(text, 380),
    sizeClass: "nra-comment--sm",
    showReadMore: text.length > 380,
  };
}
