export const requestCategories = [
  { value: "hydraulik", label: "Hydraulik" },
  { value: "elektryk", label: "Elektryk" },
  { value: "malarz", label: "Malarz" },
  { value: "stolarz", label: "Stolarz" },
  { value: "plytkarz", label: "Płytkarz" },
  { value: "brukarz", label: "Brukarz" },
  { value: "dekarz", label: "Dekarz" },
  { value: "wykonczenia", label: "Wykończenia" },
  { value: "zlota-raczka", label: "Złota Rączka" },
  { value: "inne", label: "inne" },
] as const;

export const requestCategoryLabels: Record<string, string> = Object.fromEntries(
  requestCategories.map(({ value, label }) => [value, label]),
);

export const requestCategoryFilterOptions = [
  { value: "all", label: "Wszystkie" },
  ...requestCategories,
] as const;