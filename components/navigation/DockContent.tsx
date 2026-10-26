import { createContext, forwardRef, useContext } from "react";
import { FlatList as NativeFlatList, SectionList as NativeSectionList, ScrollView as NativeScrollView, Modal as NativeModal, StyleSheet, type ScrollViewProps } from "react-native";

/** Altura real do dock, incluindo área segura. Só o scroll externo reserva espaço. */
export const DockInsetContext = createContext(0);
function useDockProps<T extends ScrollViewProps>(props: T): T {
  const inset = useContext(DockInsetContext);
  if (!inset || props.horizontal) return props;
  const content = StyleSheet.flatten(props.contentContainerStyle) || {};
  const existing = content.paddingBottom ?? content.paddingVertical ?? content.padding ?? 0;
  return {
    ...props,
    contentContainerStyle: [props.contentContainerStyle, { paddingBottom: Math.max(typeof existing === "number" ? existing : 0, inset + 12) }],
    scrollIndicatorInsets: { ...props.scrollIndicatorInsets, bottom: inset },
  };
}
export type ScrollView = NativeScrollView;
export const ScrollView = forwardRef<NativeScrollView, ScrollViewProps>(function DockScroll(props, ref) {
  const padded = useDockProps(props);
  const inset = useContext(DockInsetContext);
  return <DockInsetContext.Provider value={props.horizontal ? inset : 0}><NativeScrollView {...padded} ref={ref} /></DockInsetContext.Provider>;
});
export type FlatList<T> = NativeFlatList<T>;
export const FlatList = forwardRef(function DockList(props: React.ComponentProps<typeof NativeFlatList>, ref: React.ForwardedRef<NativeFlatList>) {
  const padded = useDockProps(props);
  const inset = useContext(DockInsetContext);
  return <DockInsetContext.Provider value={props.horizontal ? inset : 0}><NativeFlatList {...padded} ref={ref} /></DockInsetContext.Provider>;
}) as unknown as typeof NativeFlatList;
export type SectionList<T, S = unknown> = NativeSectionList<T, S>;
export const SectionList = forwardRef(function DockSections(props: React.ComponentProps<typeof NativeSectionList>, ref: React.ForwardedRef<NativeSectionList<unknown, unknown>>) {
  const padded = useDockProps(props);
  return <DockInsetContext.Provider value={0}><NativeSectionList {...padded} ref={ref} /></DockInsetContext.Provider>;
}) as unknown as typeof NativeSectionList;
/** Modais são janelas independentes: não herdam o espaço da barra por trás. */
export const Modal = (props: React.ComponentProps<typeof NativeModal>) => <DockInsetContext.Provider value={0}><NativeModal {...props} /></DockInsetContext.Provider>;
