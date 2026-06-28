export type TemplateListItem = {
  icon: string;
  title: string;
  description: string;
};

export type NegativeReviewTemplateData = {
  brandName: string;
  localName: string;
  logoUrl: string;
  nexoLogoUrl: string;
  authorName: string;
  authorInitial: string;
  reviewDate: string;
  reviewTime: string;
  stars: number;
  comment: string;
  foodScore: string;
  serviceScore: string;
  atmosphereScore: string;
  previousRating: string;
  currentRating: string;
  ratingDrop: string;
  quickSummaryItems: TemplateListItem[];
  impactItems: TemplateListItem[];
  finalNote: string;
  decor: {
    beans: string;
    burger: string;
    cup: string;
    fries: string;
    sad: string;
    bkSticker: string;
  };
  showBkDecor: boolean;
};
