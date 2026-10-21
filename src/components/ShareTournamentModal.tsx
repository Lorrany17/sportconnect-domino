"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Check,
  Trash2,
  X,
  Loader2,
  Copy,
  ChevronDown,
  AlertCircle,
  Crown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { TournamentStaffMember, TournamentRole } from "@/types";
import { useAuth } from "@/context/AuthProvider";

interface ShareTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName?: string;
  ownerEmail?: string;
  isOwnerOrAdmin?: boolean;
}

const ROLE_OPTIONS = [
  {
    value: "ADMIN",
    label: "Administrador",
    description: "Acesso total: gerencia configurações, finanças e partidas",
    badgeColor: "bg-purple-500/15 border-purple-500/30 text-purple-300",
    icon: ShieldCheck,
  },
  {
    value: "REFEREE",
    label: "Árbitro",
    description: "Pode gerenciar súmulas, iniciar partidas e editar resultados",
    badgeColor: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    icon: Shield,
  },
  {
    value: "SCOREKEEPER",
    label: "Mesário",
    description: "Pode apenas atualizar placares e pontos ao vivo",
    badgeColor: "bg-amber-500/15 border-amber-500/30 text-amber-300",
    icon: ShieldAlert,
  },
];

export default function ShareTournamentModal({
  isOpen,
  onClose,
  tournamentId,
  tournamentName,
  ownerEmail,
  isOwnerOrAdmin = true,
}: ShareTournamentModalProps) {
  const { user } = useAuth();

  const [emailInput, setEmailInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "REFEREE" | "SCOREKEEPER">("REFEREE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [staffList, setStaffList] = useState<TournamentStaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Carregar lista de membros com acesso ao torneio
  const fetchStaff = useCallback(async () => {
    if (!tournamentId) return;
    try {
      setLoadingStaff(true);
      const { data, error } = await supabase
        .from("tournament_staff")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erro ao buscar equipe do torneio:", error);
        return;
      }

      setStaffList((data as TournamentStaffMember[]) || []);
    } catch (err) {
      console.error("Exceção ao listar membros da equipe:", err);
    } finally {
      setLoadingStaff(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (isOpen) {
      fetchStaff();
      setFeedbackMessage(null);
      setEmailInput("");
    }
  }, [isOpen, fetchStaff]);

  if (!isOpen) return null;

  // Enviar novo convite
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setFeedbackMessage({
        type: "error",
        text: "Por favor, informe um endereço de e-mail válido.",
      });
      return;
    }

    if (ownerEmail && cleanEmail === ownerEmail.toLowerCase()) {
      setFeedbackMessage({
        type: "error",
        text: "Este e-mail pertence ao proprietário do torneio.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("tournament_staff").insert({
        tournament_id: tournamentId,
        email: cleanEmail,
        role: selectedRole,
      });

      if (error) {
        if (error.code === "23505" || error.message.includes("unique")) {
          setFeedbackMessage({
            type: "error",
            text: "Este e-mail já possui convite ou permissão ativa neste torneio.",
          });
        } else {
          setFeedbackMessage({
            type: "error",
            text: `Erro ao enviar convite: ${error.message}`,
          });
        }
        return;
      }

      setFeedbackMessage({
        type: "success",
        text: `Convite enviado com sucesso para ${cleanEmail}!`,
      });
      setEmailInput("");
      fetchStaff();
    } catch (err: any) {
      console.error("Exceção ao convidar membro:", err);
      setFeedbackMessage({
        type: "error",
        text: "Ocorreu um erro ao registrar o acesso.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alterar papel de um membro
  const handleRoleChange = async (memberId: string, newRole: "ADMIN" | "REFEREE" | "SCOREKEEPER") => {
    if (!isOwnerOrAdmin) return;
    setUpdatingId(memberId);
    try {
      const { error } = await supabase
        .from("tournament_staff")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) {
        alert(`Erro ao alterar função: ${error.message}`);
        return;
      }

      setStaffList((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      console.error("Erro ao alterar função:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Remover acesso de um membro
  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!isOwnerOrAdmin) return;
    if (!window.confirm(`Deseja remover o acesso de ${email} a este campeonato?`)) {
      return;
    }

    setUpdatingId(memberId);
    try {
      const { error } = await supabase
        .from("tournament_staff")
        .delete()
        .eq("id", memberId);

      if (error) {
        alert(`Erro ao remover acesso: ${error.message}`);
        return;
      }

      setStaffList((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      console.error("Erro ao excluir membro:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Copiar link público do torneio
  const handleCopyLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/torneio/${tournamentId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Linha decorativa superior estilo Google Docs Workspace */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00a2ff] via-indigo-500 to-purple-500" />

        {/* Botão de Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Cabeçalho do Modal */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-[#00a2ff]/15 border border-[#00a2ff]/25 text-[#00a2ff]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight text-white flex items-center gap-2">
              <span>Compartilhar Torneio</span>
            </h3>
            <p className="text-xs text-zinc-400 line-clamp-1">
              {tournamentName ? `Gerenciar equipe de ${tournamentName}` : "Controle de Acesso por Papéis (RBAC)"}
            </p>
          </div>
        </div>

        {/* Formulário de Convite */}
        <div className="bg-[#101012] border border-zinc-800/80 rounded-2xl p-4 sm:p-5 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
            <UserPlus className="h-4 w-4 text-[#00a2ff]" />
            <span>Adicionar Pessoas à Equipe</span>
          </div>

          <form onSubmit={handleInviteSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Campo E-mail */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 focus:border-[#00a2ff] focus:ring-1 focus:ring-[#00a2ff] rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 outline-none transition-all"
                />
              </div>

              {/* Seletor de Nível de Acesso (Role) */}
              <div className="sm:w-44 shrink-0">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full py-2.5 px-3 bg-zinc-900 border border-zinc-800 focus:border-[#00a2ff] rounded-xl text-xs font-bold text-zinc-200 outline-none cursor-pointer"
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="REFEREE">Árbitro</option>
                  <option value="SCOREKEEPER">Mesário</option>
                </select>
              </div>

              {/* Botão de Enviar Convite */}
              <button
                type="submit"
                disabled={isSubmitting || !isOwnerOrAdmin}
                className="py-2.5 px-4 rounded-xl bg-[#00a2ff] hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                <span>Convidar</span>
              </button>
            </div>

            {/* Descrição rápida da função selecionada */}
            <div className="text-[11px] text-zinc-400 bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-2.5">
              {ROLE_OPTIONS.find((r) => r.value === selectedRole)?.description}
            </div>

            {/* Mensagem de Feedback */}
            {feedbackMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
                  feedbackMessage.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                }`}
              >
                {feedbackMessage.type === "success" ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{feedbackMessage.text}</span>
              </div>
            )}
          </form>
        </div>

        {/* Listagem de Acessos Ativos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
            <span>Pessoas com Acesso</span>
            <span>{staffList.length + 1} membro(s)</span>
          </div>

          <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-2xl bg-[#101012] overflow-hidden">
            {/* 1. Proprietário Original do Torneio */}
            <div className="p-3.5 flex items-center justify-between gap-3 bg-zinc-900/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <Crown className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                    <span>{ownerEmail || "Organizador Principal"}</span>
                    {user?.email && ownerEmail && user.email.toLowerCase() === ownerEmail.toLowerCase() && (
                      <span className="text-[10px] text-zinc-500 font-normal">(Você)</span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 block truncate">
                    Criador e Dono do Campeonato
                  </span>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider shrink-0">
                <Crown className="h-3 w-3" />
                <span>Proprietário</span>
              </span>
            </div>

            {/* 2. Lista de Membros Staff Convidada */}
            {loadingStaff ? (
              <div className="p-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#00a2ff]" />
                <span>Carregando membros da equipe...</span>
              </div>
            ) : staffList.length === 0 ? (
              <div className="p-6 text-center space-y-1">
                <p className="text-xs font-medium text-zinc-400">
                  Nenhum co-organizador convidado ainda.
                </p>
                <p className="text-[11px] text-zinc-500">
                  Convide árbitros e mesários para ajudar na condução das partidas.
                </p>
              </div>
            ) : (
              staffList.map((member) => {
                const roleMeta = ROLE_OPTIONS.find((r) => r.value === member.role) || ROLE_OPTIONS[1];
                const isCurrentMemberUpdating = updatingId === member.id;

                return (
                  <div
                    key={member.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {member.email.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-200 truncate flex items-center gap-1.5">
                          <span>{member.email}</span>
                          {user?.email && user.email.toLowerCase() === member.email.toLowerCase() && (
                            <span className="text-[10px] text-zinc-500 font-normal">(Você)</span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 block truncate">
                          {member.user_id ? "Conta vinculada" : "Convite enviado • aguardando login"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Seletor rápido de Role inline para o Dono */}
                      {isOwnerOrAdmin ? (
                        <select
                          disabled={isCurrentMemberUpdating}
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as any)}
                          className="py-1 px-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-[11px] font-bold text-zinc-300 outline-none cursor-pointer disabled:opacity-50"
                        >
                          <option value="ADMIN">Administrador</option>
                          <option value="REFEREE">Árbitro</option>
                          <option value="SCOREKEEPER">Mesário</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${roleMeta.badgeColor}`}
                        >
                          {roleMeta.label}
                        </span>
                      )}

                      {/* Botão Excluir Membro */}
                      {isOwnerOrAdmin && (
                        <button
                          type="button"
                          disabled={isCurrentMemberUpdating}
                          onClick={() => handleRemoveMember(member.id, member.email)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                          title="Remover acesso"
                        >
                          {isCurrentMemberUpdating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Rodapé: Copiar Link de Acesso Público */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer text-xs font-bold shadow-sm"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-zinc-400" />
                <span>Copiar Link do Torneio</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
