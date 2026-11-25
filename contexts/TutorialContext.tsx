import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useAuth } from './AuthContext';
import { concluirTutorial, prepararTutorial } from '@/lib/tutorial';

export type TutorialTargetId = 'care' | 'devotional' | 'groups' | 'serve' | 'giving' | 'menu' | 'dock';
type Target = { view: View; reveal?: () => void };
type Value = {
  ready: boolean; pending: boolean; pushReady: boolean; revision: number;
  finish: () => void; replay: () => void; releasePush: () => void;
  targets: React.RefObject<Map<TutorialTargetId, Target>>;
  register: (id: TutorialTargetId, target: Target | null) => void;
  layout: () => void;
};
const TutorialContext = createContext<Value | null>(null);
export const useTutorial = () => useContext(TutorialContext);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, preview } = useAuth();
  return <TutorialSession key={user?.id ?? 'guest'} userId={preview ? undefined : user?.id}>{children}</TutorialSession>;
}
function TutorialSession({ userId, children }: { userId?: string; children: ReactNode }) {
  const [ready, setReady] = useState(!userId), [pending, setPending] = useState(false), [pushReady, setPushReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const requestedReplay = useRef(false);
  const targets = useRef(new Map<TutorialTargetId, Target>());
  useEffect(() => {
    if (!userId) return;
    let live = true;
    prepararTutorial(AsyncStorage, userId).then(status => {
      if (live) { setPending(requestedReplay.current || status === 'pending'); setReady(true); }
    });
    return () => { live = false; };
  }, [userId]);
  const finish = useCallback(() => {
    setPending(false);
    if (userId) void concluirTutorial(AsyncStorage, userId);
  }, [userId]);
  const replay = useCallback(() => { if (userId) { requestedReplay.current = true; setPending(true); } }, [userId]);
  const releasePush = useCallback(() => setPushReady(true), []);
  const register = useCallback((id: TutorialTargetId, target: Target | null) => {
    if (target) targets.current.set(id, target); else targets.current.delete(id);
  }, []);
  const layout = useCallback(() => setRevision(value => value + 1), []);
  const value = useMemo(() => ({ ready, pending, pushReady, revision, finish, replay, releasePush, targets, register, layout }), [ready, pending, pushReady, revision, finish, replay, releasePush, register, layout]);
  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function TutorialTarget({ id, reveal, children, ...props }: ViewProps & { id: TutorialTargetId; reveal?: () => void }) {
  const tutorial = useTutorial();
  const register = tutorial?.register;
  const ref = useCallback((view: View | null) => register?.(id, view ? { view, reveal } : null), [id, register, reveal]);
  return <View {...props} ref={ref} collapsable={false} onLayout={event => { props.onLayout?.(event); tutorial?.layout(); }}>{children}</View>;
}
