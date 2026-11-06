// Sample pictures for the fictional QuickKart brand. Photographs are CC0; see the README for credits.

export interface DemoImage {
  src: string;
  name: string;
  label: string;
  hint: string;
  alt?: string;
}

export const DEMO_IMAGES: DemoImage[] = [
  { src: "/demo/fresh-basket.jpg", name: "fresh-basket.jpg", label: "Fresh basket", hint: "Built to follow the kit", alt: "Fresh vegetables on a table with the QuickKart name and a free delivery offer." },
  { src: "/demo/diwali-offer.jpg", name: "diwali-offer.jpg", label: "Diwali offer", hint: "Wrong name, risky claims" },
  { src: "/demo/night-drive.jpg", name: "night-drive.jpg", label: "Night drive", hint: "Wrong mood and subject" },
];
