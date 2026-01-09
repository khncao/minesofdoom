import { createContext } from "react";

export type Props = {
  onTick: Array<() => void>;
};
export const Context = createContext<Props>(null as unknown as Props);
