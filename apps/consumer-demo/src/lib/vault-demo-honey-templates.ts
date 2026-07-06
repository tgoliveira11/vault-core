export const HONEY_NOTE_TEMPLATES = [
  {
    title: "Grocery list",
    body: "Milk, eggs, bread, coffee, bananas",
  },
  {
    title: "Weekend plans",
    body: "Saturday: farmers market. Sunday: brunch with Alex.",
  },
  {
    title: "Book recommendations",
    body: "The Pragmatic Programmer, Deep Work, Atomic Habits",
  },
] as const;

export function buildHoneyPayloadFromTemplates() {
  const now = new Date().toISOString();
  return {
    version: 1 as const,
    notes: HONEY_NOTE_TEMPLATES.map((template, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      title: template.title,
      body: template.body,
      createdAt: now,
    })),
  };
}
