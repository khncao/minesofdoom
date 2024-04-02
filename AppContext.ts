import { createContext } from "react";

export type AppContextProps = {
  onTick: Array<() => void>;
};
export const AppContext = createContext<AppContextProps>(
  null as unknown as AppContextProps
);
