export const CATEGORY_IDS = [
  "football",
  "histoire",
  "geographie",
  "sciences",
  "mathematiques",
  "informatique",
  "litterature",
  "cinema",
  "musique",
  "jeux-video",
  "anime-manga",
  "animaux",
  "cuisine",
  "mythologie",
  "espace",
  "medecine",
  "economie",
  "politique",
  "inventions",
  "arts",
  "langues",
  "automobile",
  "technologie",
  "culture-generale",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type Category = {
  id: CategoryId;
  emoji: string;
  /** Gradient used as card background / glow. Hex values keep Tailwind from purging dynamic classes. */
  from: string;
  to: string;
};

export const CATEGORIES: Category[] = [
  { id: "football", emoji: "⚽", from: "#22c55e", to: "#0ea5e9" },
  { id: "histoire", emoji: "🏛️", from: "#f59e0b", to: "#b45309" },
  { id: "geographie", emoji: "🌍", from: "#14b8a6", to: "#0f766e" },
  { id: "sciences", emoji: "🔬", from: "#38bdf8", to: "#4f46e5" },
  { id: "mathematiques", emoji: "➗", from: "#8b5cf6", to: "#4338ca" },
  { id: "informatique", emoji: "💻", from: "#6366f1", to: "#0ea5e9" },
  { id: "litterature", emoji: "📚", from: "#f472b6", to: "#9d174d" },
  { id: "cinema", emoji: "🎬", from: "#fb7185", to: "#7c3aed" },
  { id: "musique", emoji: "🎵", from: "#a78bfa", to: "#db2777" },
  { id: "jeux-video", emoji: "🎮", from: "#22d3ee", to: "#6366f1" },
  { id: "anime-manga", emoji: "🌸", from: "#f472b6", to: "#6366f1" },
  { id: "animaux", emoji: "🐾", from: "#84cc16", to: "#15803d" },
  { id: "cuisine", emoji: "🍳", from: "#fbbf24", to: "#dc2626" },
  { id: "mythologie", emoji: "🐉", from: "#c084fc", to: "#4c1d95" },
  { id: "espace", emoji: "🚀", from: "#60a5fa", to: "#1e1b4b" },
  { id: "medecine", emoji: "🩺", from: "#34d399", to: "#0284c7" },
  { id: "economie", emoji: "📈", from: "#facc15", to: "#15803d" },
  { id: "politique", emoji: "🏛", from: "#94a3b8", to: "#334155" },
  { id: "inventions", emoji: "💡", from: "#fde047", to: "#f97316" },
  { id: "arts", emoji: "🎨", from: "#fb923c", to: "#be123c" },
  { id: "langues", emoji: "🗣️", from: "#4ade80", to: "#0891b2" },
  { id: "automobile", emoji: "🏎️", from: "#f87171", to: "#1e293b" },
  { id: "technologie", emoji: "⚙️", from: "#22d3ee", to: "#4338ca" },
  { id: "culture-generale", emoji: "🧠", from: "#818cf8", to: "#7c3aed" },
];

export const CATEGORY_BY_ID: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
) as Record<CategoryId, Category>;
