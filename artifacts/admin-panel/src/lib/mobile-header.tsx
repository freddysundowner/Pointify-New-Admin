import { createContext, useContext, useState, type ReactNode } from "react";

export type MobileHeaderState = { title: string; backHref?: string } | null;

type MobileHeaderContextValue = {
  header: MobileHeaderState;
  setHeader: (header: MobileHeaderState) => void;
};

const MobileHeaderContext = createContext<MobileHeaderContextValue | null>(null);

export function MobileHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<MobileHeaderState>(null);
  return (
    <MobileHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </MobileHeaderContext.Provider>
  );
}

export function useMobileHeader() {
  const ctx = useContext(MobileHeaderContext);
  if (!ctx) {
    throw new Error("useMobileHeader must be used within a MobileHeaderProvider");
  }
  return ctx;
}
