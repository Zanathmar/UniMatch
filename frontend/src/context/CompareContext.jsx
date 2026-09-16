import { createContext, useContext, useState } from "react";

const CompareContext = createContext(null);

export function CompareProvider({ children }) {
  const [slugs, setSlugs] = useState([]);

  const toggle = (slug) => {
    setSlugs((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 5) return prev;
      return [...prev, slug];
    });
  };
  const remove = (slug) => setSlugs((prev) => prev.filter((s) => s !== slug));
  const clear = () => setSlugs([]);
  const has = (slug) => slugs.includes(slug);

  return (
    <CompareContext.Provider value={{ slugs, toggle, remove, clear, has }}>
      {children}
    </CompareContext.Provider>
  );
}

export const useCompare = () => useContext(CompareContext);
