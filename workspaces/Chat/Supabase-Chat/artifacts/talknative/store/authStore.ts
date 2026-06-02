import { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import { Profile } from "@/types";

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: false,
  initialized: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setProfile: (profile) => set({ profile }),

  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    set({ session, user: session?.user ?? null });

    if (session?.user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      set({ profile: profileData });
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        set({ profile: profileData });
      } else {
        set({ profile: null });
      }
    });

    set({ initialized: true });
  },

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password, displayName) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email,
          display_name: displayName,
          is_online: true,
        });
      }
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    const userId = get().user?.id;
    if (userId) {
      await supabase
        .from("profiles")
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq("id", userId);
    }
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  updateProfile: async (updates) => {
    const userId = get().user?.id;
    if (!userId) return;
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();
    if (!error && data) set({ profile: data });
  },
}));
