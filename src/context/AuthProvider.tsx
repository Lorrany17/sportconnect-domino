"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/types";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  isAdmin: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ) => Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ data: any; error: AuthError | null }>;
  updatePassword: (
    newPassword: string
  ) => Promise<{ data: { user: User | null } | null; error: AuthError | null }>;
  isRecoveringPassword: boolean;
  setIsRecoveringPassword: (val: boolean) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState<boolean>(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Consulta e sincroniza dados do perfil (incluindo flag is_admin)
  const fetchProfile = async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }

    if (currentUser.id === "organizer-admin-session") {
      setIsAdmin(true);
      setProfile({ id: currentUser.id, full_name: "Organizador Principal", is_admin: true });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
        const adminFlag = Boolean(
          data.is_admin === true ||
          currentUser.email === "admin@sportconnect.com" ||
          currentUser.email === "santoslorrany250@gmail.com"
        );
        setIsAdmin(adminFlag);
      } else {
        const adminByEmail = Boolean(
          currentUser.email === "admin@sportconnect.com" ||
          currentUser.email === "santoslorrany250@gmail.com"
        );
        setIsAdmin(adminByEmail);
        setProfile(null);
      }
    } catch (err) {
      console.warn("Aviso ao carregar perfil do usuário:", err);
      setIsAdmin(false);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  // Sincroniza cookies para leitura no middleware de rotas protegidas
  const syncAuthCookies = (sessionToSync: Session | null, isAdminLogged?: boolean) => {
    if (typeof document === "undefined") return;
    if (sessionToSync?.access_token) {
      document.cookie = `sb-access-token=${sessionToSync.access_token}; path=/; max-age=604800; SameSite=Lax`;
    } else {
      document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax`;
    }
    if (isAdminLogged) {
      document.cookie = `sc_admin_auth=true; path=/; max-age=604800; SameSite=Lax`;
    } else if (isAdminLogged === false) {
      document.cookie = `sc_admin_auth=; path=/; max-age=0; SameSite=Lax`;
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. Obtém sessão inicial ativa do Supabase
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        const isAdminLogged =
          typeof window !== "undefined" && localStorage.getItem("sc_admin_auth") === "true";

        if (session?.user) {
          setSession(session);
          setUser(session.user);
          syncAuthCookies(session, isAdminLogged);
          fetchProfile(session.user);
        } else {
          // Compatibilidade com sessão administrativa local (PIN do organizador)
          if (isAdminLogged) {
            const adminUser = {
              id: "organizer-admin-session",
              email: "organizador@sportconnect.com",
              app_metadata: {},
              user_metadata: {
                role: "organizer",
                name: "Organizador Principal",
                full_name: "Organizador Principal",
              },
              aud: "authenticated",
              created_at: new Date().toISOString(),
            } as User;
            setUser(adminUser);
            syncAuthCookies(null, true);
            fetchProfile(adminUser);
          } else {
            setUser(null);
            setSession(null);
            syncAuthCookies(null, false);
            fetchProfile(null);
          }
        }
      })
      .catch((err) => {
        console.error("Erro ao obter sessão Supabase:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // 2. Escuta mudanças contínuas de autenticação (LOGIN, LOGOUT, TOKEN_REFRESHED, PASSWORD_RECOVERY)
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setIsRecoveringPassword(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveringPassword(true);
      }

      const isAdminLogged =
        typeof window !== "undefined" && localStorage.getItem("sc_admin_auth") === "true";

      setSession(newSession);
      if (newSession?.user) {
        setUser(newSession.user);
        syncAuthCookies(newSession, isAdminLogged);
        fetchProfile(newSession.user);
      } else {
        if (isAdminLogged) {
          const adminUser = {
            id: "organizer-admin-session",
            email: "organizador@sportconnect.com",
            app_metadata: {},
            user_metadata: {
              role: "organizer",
              name: "Organizador Principal",
              full_name: "Organizador Principal",
            },
            aud: "authenticated",
            created_at: new Date().toISOString(),
          } as User;
          setUser(adminUser);
          syncAuthCookies(null, true);
          fetchProfile(adminUser);
        } else {
          setUser(null);
          syncAuthCookies(null, false);
          fetchProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.data?.user) {
      setUser(result.data.user);
      setSession(result.data.session);
      syncAuthCookies(result.data.session);
    }
    setLoading(false);
    return result;
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    setLoading(true);
    // Envia full_name e phone dentro de options.data para o Trigger da tabela profiles do Supabase
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
        },
      },
    });
    if (result.data?.user) {
      setUser(result.data.user);
      setSession(result.data.session);
      syncAuthCookies(result.data.session);

      // Garante atualização na tabela profiles com o telefone e show_phone padrão true
      if (phone) {
        try {
          await supabase
            .from("profiles")
            .update({ phone, show_phone: true })
            .eq("id", result.data.user.id);
        } catch (err) {
          console.warn("Aviso ao atualizar telefone no perfil recém-criado:", err);
        }
      }
      await fetchProfile(result.data.user);
    }
    setLoading(false);
    return result;
  };

  const signOut = async () => {
    setLoading(true);
    const result = await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("sc_admin_auth");
    }
    syncAuthCookies(null, false);
    setLoading(false);
    return result;
  };

  const resetPassword = async (email: string) => {
    return await supabase.auth.resetPasswordForEmail(email);
  };

  const updatePassword = async (newPassword: string) => {
    setLoading(true);
    const result = await supabase.auth.updateUser({ password: newPassword });
    if (!result.error) {
      setIsRecoveringPassword(false);
      if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    setLoading(false);
    return result;
  };

  // Renderiza um loader/spinner moderno caso o estado inicial de autenticação ainda esteja carregando
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-4 text-[#e4e4e7] select-none">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-[#00a2ff] animate-spin" />
          <div className="absolute w-6 h-6 rounded-full bg-[#00a2ff]/10 blur-sm" />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-xs font-black tracking-widest uppercase text-zinc-300">
            SportConnect
          </span>
          <span className="text-[11px] text-zinc-500 font-medium">
            Carregando autenticação...
          </span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        isAdmin,
        refreshProfile,
        isRecoveringPassword,
        setIsRecoveringPassword,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
