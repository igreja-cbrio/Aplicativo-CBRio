import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { chaveTemaKids, temaKids, type TemaKids } from "@/lib/kidsTema";

const Context = createContext<{ tema: TemaKids; escolher: (id: TemaKids["id"]) => Promise<void> }>({
  tema: temaKids(null), escolher: async () => {},
});

export function KidsThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id || "";
  const [preferencia, setPreferencia] = useState({ uid: "", id: "amarelo" });
  const revisao = useRef(0);
  const fila = useRef(Promise.resolve());
  useEffect(() => {
    let cancelado = false;
    const versao = ++revisao.current;
    if (uid) AsyncStorage.getItem(chaveTemaKids(uid)).then(id => {
      if (!cancelado && revisao.current === versao) setPreferencia({ uid, id: temaKids(id).id });
    }).catch(() => {});
    return () => { cancelado = true; };
  }, [uid]);
  async function escolher(id: TemaKids["id"]) {
    ++revisao.current;
    setPreferencia({ uid, id });
    if (!uid) return;
    const gravacao = fila.current.catch(() => {}).then(() => AsyncStorage.setItem(chaveTemaKids(uid), id));
    fila.current = gravacao;
    await gravacao;
  }
  return <Context.Provider value={{ tema: temaKids(preferencia.uid === uid ? preferencia.id : null), escolher }}>{children}</Context.Provider>;
}
export const useKidsTheme = () => useContext(Context);
