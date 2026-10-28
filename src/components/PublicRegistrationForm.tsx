"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Users,
  Trophy,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Phone,
  Shield,
  Plus,
  Trash2,
  ChevronDown,
  FileText,
  Mail,
  Upload,
} from "lucide-react";
import { Tournament, SportType, Team } from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthProvider";
import { useTournament } from "@/context/TournamentContext";
import PixCheckoutForm from "@/components/PixCheckoutForm";

export interface PublicRegistrationFormProps {
  tournament: Tournament;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PublicRegistrationForm({
  tournament,
  isOpen,
  onClose,
  onSuccess,
}: PublicRegistrationFormProps) {
  const { user } = useAuth();
  const { setTeams } = useTournament();

  const sportType: SportType = tournament.sport_type || "DOMINO";
  const format = (tournament.format || "").toLowerCase();
  const entryFee = tournament.entry_fee ? Number(tournament.entry_fee) : 0;

  // Lógica de adaptação do esporte
  const isPingPongSolo =
    sportType === "PING_PONG" &&
    (format.includes("solo") || format.includes("1v1") || !format.includes("duplas"));

  const isDuplasSport =
    sportType === "DOMINO" ||
    (sportType === "PING_PONG" && format.includes("duplas")) ||
    (sportType === "VOLEI" && format.includes("duplas"));

  const isTeamSport =
    sportType === "FUTSAL" ||
    (sportType === "VOLEI" && !format.includes("duplas"));

  // Fluxo de Etapas (form -> checkout pix)
  const [step, setStep] = useState<"form" | "checkout">("form");
  const [createdTeam, setCreatedTeam] = useState<Team | null>(null);

  // Estados dos campos do formulário
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.name || ""
  );
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [contact, setContact] = useState("");
  const [athletes, setAthletes] = useState<{ name: string; email: string }[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});

  const customFields = tournament.custom_registration_fields || [];

  const handleCustomAnswerChange = (fieldLabel: string, value: any) => {
    setCustomAnswers((prev) => ({
      ...prev,
      [fieldLabel]: value,
    }));
  };

  // Estados de upload de comprovante de pagamento
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limpa o preview de imagem do comprovante ao desmontar
  useEffect(() => {
    return () => {
      if (receiptPreview) {
        URL.revokeObjectURL(receiptPreview);
      }
    };
  }, [receiptPreview]);

  // Manipulador de seleção do arquivo de comprovante
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Erro ao enviar o comprovante. O arquivo deve ter no máximo 5MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setReceiptFile(file);
    setErrorMessage("");

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setReceiptPreview(url);
    } else {
      setReceiptPreview(null);
    }
  };

  // Remove o comprovante selecionado
  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview);
      setReceiptPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Estados de submissão e feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  // Se já preencheu e houver taxa, renderiza a tela de checkout Pix dinâmico
  if (step === "checkout" && createdTeam) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
        <PixCheckoutForm
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          teamId={createdTeam.id}
          teamName={createdTeam.name}
          captainName={
            createdTeam.manager_name ||
            (Array.isArray(createdTeam.players) ? createdTeam.players[0] : "") ||
            captainName ||
            "Capitão"
          }
          totalAmount={entryFee}
          sportType={sportType}
          email={user?.email || undefined}
          initialReceiptUrl={createdTeam.payment_proof_url || undefined}
          onClose={onClose}
          onSuccess={() => {
            onSuccess?.();
            onClose();
          }}
        />
      </div>
    );
  }

  // Manipuladores de atletas adicionais (Futsal / Vôlei)
  const handleAddAthlete = () => {
    setAthletes((prev) => [...prev, { name: "", email: "" }]);
  };

  const handleUpdateAthlete = (index: number, field: "name" | "email", val: string) => {
    setAthletes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveAthlete = (index: number) => {
    setAthletes((prev) => prev.filter((_, i) => i !== index));
  };

  // Submissão do Formulário de Inscrição
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // 1. Validação de Campos
    if (isPingPongSolo) {
      if (!captainName.trim()) {
        setErrorMessage("Por favor, preencha o Nome do Jogador.");
        return;
      }
      if (!contact.trim()) {
        setErrorMessage("Por favor, informe seu Contato (WhatsApp).");
        return;
      }
    } else if (isDuplasSport) {
      if (!teamName.trim() || !captainName.trim() || !partnerName.trim()) {
        setErrorMessage("Por favor, preencha o Nome da Dupla, Capitão e Parceiro.");
        return;
      }
      if (!contact.trim()) {
        setErrorMessage("Por favor, informe o Contato do Capitão.");
        return;
      }
    } else {
      // Esporte coletivo (Futsal / Vôlei)
      if (!teamName.trim() || !captainName.trim()) {
        setErrorMessage("Por favor, preencha o Nome da Equipe e do Responsável.");
        return;
      }
      if (!contact.trim()) {
        setErrorMessage("Por favor, informe o Contato do Responsável.");
        return;
      }
    }

    // 1.1 Validação de Campos Personalizados Obrigatórios
    for (const field of customFields) {
      if (field.required) {
        const val = customAnswers[field.label];
        if (field.type === "checkbox") {
          if (!val || val === "Não" || val === false) {
            setErrorMessage(`Por favor, responda/marque o campo obrigatório: "${field.label}".`);
            return;
          }
        } else {
          if (val === undefined || val === null || String(val).trim() === "") {
            setErrorMessage(`Por favor, preencha o campo obrigatório: "${field.label}".`);
            return;
          }
        }
      }
    }

    // 1.2 Validação de Status do Torneio
    if (tournament.status && tournament.status !== "OPEN") {
      setErrorMessage("As inscrições para este torneio estão encerradas.");
      setIsSubmitting(false);
      return;
    }

    // 1.3 Validação Obrigatória de Autenticação para Inscrição
    if (!user || !user.id) {
      const authErrorMsg = "Usuário não autenticado. Faça login para se inscrever.";
      setErrorMessage(authErrorMsg);
      setIsSubmitting(false);
      throw new Error(authErrorMsg);
    }

    setIsSubmitting(true);

    try {
      // 2. Compilação do Elenco (Roster)
      let compiledRoster: string[] = [];
      let finalName = "";
      let p1 = "";
      let p2 = "";

      if (isPingPongSolo) {
        finalName = teamName.trim() || captainName.trim();
        p1 = captainName.trim();
        p2 = "";
        compiledRoster = [p1];
      } else if (isDuplasSport) {
        finalName = teamName.trim();
        p1 = captainName.trim();
        p2 = partnerName.trim();
        compiledRoster = [p1, p2];
      } else {
        finalName = teamName.trim();
        p1 = captainName.trim();
        p2 = "";
        const validAthletes = athletes.map((a) => a.name.trim()).filter(Boolean);
        compiledRoster = [p1, ...validAthletes];
      }

      // 3. Upload Obrigatório do Comprovante (se anexado pelo atleta) ANTES do INSERT na tabela teams
      let uploadedReceiptPath: string | null = null;

      if (receiptFile) {
        if (receiptFile.size > 5 * 1024 * 1024) {
          setErrorMessage("Erro ao enviar o comprovante. O arquivo deve ter no máximo 5MB.");
          setIsSubmitting(false);
          return;
        }

        try {
          const fileExt = receiptFile.name.split(".").pop() || "png";
          const cleanFileName = `${user.id}-${Date.now()}.${fileExt}`;
          const filePath = `${cleanFileName}`;

          const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(filePath, receiptFile, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            console.error("Erro ao enviar comprovante no Supabase Storage:", uploadError);
            setErrorMessage("Erro ao enviar o comprovante. Verifique sua conexão e tente novamente.");
            setIsSubmitting(false);
            return;
          }

          uploadedReceiptPath = filePath;
        } catch (uploadCatchErr) {
          console.error("Exceção ao fazer upload do comprovante:", uploadCatchErr);
          setErrorMessage("Erro ao enviar o comprovante. Verifique sua conexão e tente novamente.");
          setIsSubmitting(false);
          return;
        }
      }

      // 4. Montagem do payload e Insert na tabela teams (user_id obrigatório)
      const formattedCustomAnswers: Record<string, any> = {};
      for (const field of customFields) {
        const val = customAnswers[field.label];
        if (field.type === "checkbox") {
          formattedCustomAnswers[field.label] = val === true || val === "Sim" ? "Sim" : "Não";
        } else if (val !== undefined && val !== null && String(val).trim() !== "") {
          formattedCustomAnswers[field.label] = String(val).trim();
        }
      }

      const payload: any = {
        name: finalName,
        manager_name: p1,
        player1: p1,
        player2: p2 || "",
        roster: compiledRoster,
        contact: contact.trim(),
        tournament_id: tournament.id,
        user_id: user.id,
        payment_status: uploadedReceiptPath ? "WAITING_APPROVAL" : (entryFee > 0 ? "WAITING_PIX" : "APPROVED"),
        payment_proof_url: uploadedReceiptPath || null,
        status: entryFee > 0 ? "PENDING" : "CONFIRMED",
        category: "Geral",
        custom_registration_answers: formattedCustomAnswers,
      };

      const { data: insertedTeam, error: insertError } = await supabase
        .from("teams")
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        console.error("Erro ao cadastrar equipe:", JSON.stringify(insertError, null, 2));
        throw insertError;
      }

      // 4. Inserção de membros vinculados na tabela team_members
      const teamMembersToInsert: {
        team_id: string;
        user_id: string | null;
        name: string;
        email: string;
        is_captain: boolean;
      }[] = [];

      // A. Adiciona o usuário logado (capitão) com is_captain: true
      teamMembersToInsert.push({
        team_id: insertedTeam.id,
        user_id: user.id,
        name: p1,
        email: user.email || "",
        is_captain: true,
      });

      // B. Coleta e processa os outros membros informados
      const otherMembers: { name: string; email: string }[] = [];

      if (isDuplasSport && partnerName.trim()) {
        otherMembers.push({
          name: partnerName.trim(),
          email: partnerEmail.trim().toLowerCase(),
        });
      } else if (isTeamSport) {
        athletes.forEach((ath) => {
          if (ath.name.trim()) {
            otherMembers.push({
              name: ath.name.trim(),
              email: ath.email.trim().toLowerCase(),
            });
          }
        });
      }

      // C. Loop nos e-mails dos membros para verificar na tabela profiles
      for (const member of otherMembers) {
        let matchedUserId: string | null = null;
        if (member.email) {
          try {
            const { data: profileFound } = await supabase
              .from("profiles")
              .select("id")
              .eq("email", member.email)
              .maybeSingle();

            if (profileFound?.id) {
              matchedUserId = profileFound.id;
            }
          } catch (pErr) {
            console.warn("Aviso ao buscar perfil por email:", pErr);
          }
        }

        teamMembersToInsert.push({
          team_id: insertedTeam.id,
          user_id: matchedUserId,
          name: member.name,
          email: member.email,
          is_captain: false,
        });
      }

      // D. Executa o INSERT em lote na tabela team_members
      try {
        const { error: tmError } = await supabase
          .from("team_members")
          .insert(teamMembersToInsert);

        if (tmError) {
          console.warn("Aviso ao vincular membros em team_members:", tmError);
        }
      } catch (tmErr) {
        console.warn("Exceção ao inserir em team_members:", tmErr);
      }

      // 4. Mapear equipe inserida
      const mappedTeam: Team = {
        id: insertedTeam.id,
        name: insertedTeam.name,
        user_id: insertedTeam.user_id,
        players: [insertedTeam.player1, insertedTeam.player2],
        roster: insertedTeam.roster,
        createdAt: insertedTeam.created_at || new Date().toISOString(),
        status: insertedTeam.status,
        tournamentId: insertedTeam.tournament_id,
        payment_status: insertedTeam.payment_status,
        payment_proof_url: insertedTeam.payment_proof_url,
        manager_name: insertedTeam.manager_name,
        category: insertedTeam.category,
        contact: insertedTeam.contact,
        custom_registration_answers: insertedTeam.custom_registration_answers || formattedCustomAnswers,
      };

      setTeams((prev: Team[]) => [...prev, mappedTeam]);

      // 5. Se houver taxa de inscrição, transiciona imediatamente para o Checkout Pix Dinâmico
      if (entryFee > 0) {
        setCreatedTeam(mappedTeam);
        setStep("checkout");
      } else {
        // Se for gratuito, conclui com sucesso direto
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2500);
      }
    } catch (err: unknown) {
      console.error("Erro na inscrição:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Ocorreu um erro ao processar sua inscrição. Tente novamente.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 sm:p-8 max-w-xl w-full text-white shadow-2xl relative max-h-[92vh] overflow-y-auto selection:bg-orange-500/30 selection:text-white">
        {/* Linha superior decorativa */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500" />

        {/* Botão de Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        {isSuccess ? (
          /* Feedback de Sucesso para Inscrição Gratuita */
          <div className="py-8 text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
            </div>
            <h3 className="text-2xl font-black font-display uppercase tracking-tight text-white">
              Inscrição Concluída com Sucesso!
            </h3>
            <p className="text-sm text-zinc-300 max-w-md mx-auto leading-relaxed">
              Sua equipe foi confirmada na competição oficial. Boa sorte!
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  onSuccess?.();
                  onClose();
                }}
                className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          /* Formulário de Inscrição */
          <div className="space-y-6">
            {/* Cabeçalho */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-black uppercase tracking-wider mb-2">
                <Sparkles className="h-3 w-3" />
                <span>Inscrição Oficial</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
                {tournament.name}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Modalidade: <strong className="text-zinc-200">{sportType}</strong>
                {tournament.format ? ` • Formato: ${tournament.format}` : ""}
              </p>
            </div>

            {/* Mensagem de Erro Visual */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 1. Campos Dinâmicos (Adaptação ao Esporte) */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2 border-b border-[#27272a] pb-2">
                  <Users className="h-4 w-4 text-orange-500" />
                  <span>Dados dos Participantes</span>
                </h3>

                {/* Caso 1: Ping Pong Solo */}
                {isPingPongSolo && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                        Nome do Jogador <span className="text-orange-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={captainName}
                        onChange={(e) => setCaptainName(e.target.value)}
                        placeholder="Ex: Carlos Augusto"
                        className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                        Contato (WhatsApp) <span className="text-orange-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <input
                          type="text"
                          required
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                          placeholder="(89) 99999-9999"
                          className="w-full pl-10 pr-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Caso 2: Dominó, Ping Pong Duplas ou Vôlei de Areia Duplas */}
                {isDuplasSport && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                        Nome da Dupla <span className="text-orange-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Ex: Os Carrascos do Carroça"
                        className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                          Nome do Capitão <span className="text-orange-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={captainName}
                          onChange={(e) => setCaptainName(e.target.value)}
                          placeholder="Capitão da Dupla"
                          className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                          Nome do Parceiro <span className="text-orange-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={partnerName}
                          onChange={(e) => setPartnerName(e.target.value)}
                          placeholder="Jogador 2"
                          className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                        />
                      </div>
                    </div>

                    {/* E-mail do Parceiro para vínculo automático de perfil */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                          E-mail do Parceiro
                        </label>
                        <span className="text-[10px] text-zinc-500">
                          Vincula estatísticas automaticamente
                        </span>
                      </div>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <input
                          type="email"
                          value={partnerEmail}
                          onChange={(e) => setPartnerEmail(e.target.value)}
                          placeholder="parceiro@exemplo.com (caso possua conta)"
                          className="w-full pl-10 pr-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                        Contato do Capitão (WhatsApp) <span className="text-orange-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <input
                          type="text"
                          required
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                          placeholder="(89) 99999-9999"
                          className="w-full pl-10 pr-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Caso 3: Futsal ou Vôlei Quadra / 4x4 */}
                {isTeamSport && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                        Nome da Equipe <span className="text-orange-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Ex: Falcões Futsal Clube"
                        className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                          Nome do Responsável / Capitão <span className="text-orange-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={captainName}
                          onChange={(e) => setCaptainName(e.target.value)}
                          placeholder="Responsável pelo time"
                          className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                          Contato do Responsável (WhatsApp) <span className="text-orange-500">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                          <input
                            type="text"
                            required
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                            placeholder="(89) 99999-9999"
                            className="w-full pl-10 pr-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Secção de Elenco (Array Dinâmico de Membros com Nome e E-mail) */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                            Elenco da Equipe ({athletes.length + 1} no total)
                          </label>
                          <p className="text-[10px] text-zinc-500">
                            Informe os e-mails para vincular automaticamente às contas dos atletas
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddAthlete}
                          className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Adicionar Membro</span>
                        </button>
                      </div>

                      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                          <input
                            type="text"
                            disabled
                            value={`Capitão: ${captainName || "Responsável"}`}
                            className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 rounded-lg cursor-not-allowed"
                          />
                          <input
                            type="text"
                            disabled
                            value={user?.email || "Email autenticado"}
                            className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 rounded-lg cursor-not-allowed"
                          />
                          <span className="text-[10px] text-orange-400 font-bold px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg self-start sm:self-center">
                            Capitão
                          </span>
                        </div>

                        {athletes.map((ath, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-[#0f0f0f] border border-[#27272a] animate-fadeIn">
                            <input
                              type="text"
                              value={ath.name}
                              onChange={(e) => handleUpdateAthlete(idx, "name", e.target.value)}
                              placeholder={`Nome do Membro #${idx + 2}`}
                              className="flex-1 px-3 py-1.5 bg-[#141416] border border-[#27272a] focus:border-orange-500 text-xs text-zinc-100 placeholder:text-zinc-600 rounded-lg outline-none"
                            />
                            <input
                              type="email"
                              value={ath.email}
                              onChange={(e) => handleUpdateAthlete(idx, "email", e.target.value)}
                              placeholder="E-mail (para vincular perfil)"
                              className="flex-1 px-3 py-1.5 bg-[#141416] border border-[#27272a] focus:border-orange-500 text-xs text-zinc-100 placeholder:text-zinc-600 rounded-lg outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveAthlete(idx)}
                              className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer self-end sm:self-center"
                              title="Remover membro"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Renderização Dinâmica dos Campos Personalizados (Configurados pelo Organizador) */}
              {customFields.length > 0 && (
                <div className="pt-2 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2 border-b border-[#27272a] pb-2">
                    <FileText className="h-4 w-4 text-orange-400" />
                    <span>Perguntas da Inscrição</span>
                  </h3>

                  <div className="space-y-3">
                    {customFields.map((field) => {
                      const value = customAnswers[field.label] ?? "";

                      if (field.type === "text") {
                        return (
                          <div key={field.id} className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                              {field.label} {field.required && <span className="text-orange-500">*</span>}
                            </label>
                            <input
                              type="text"
                              required={field.required}
                              value={value}
                              onChange={(e) => handleCustomAnswerChange(field.label, e.target.value)}
                              placeholder={`Sua resposta para ${field.label}`}
                              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                            />
                          </div>
                        );
                      }

                      if (field.type === "textarea") {
                        return (
                          <div key={field.id} className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                              {field.label} {field.required && <span className="text-orange-500">*</span>}
                            </label>
                            <textarea
                              rows={3}
                              required={field.required}
                              value={value}
                              onChange={(e) => handleCustomAnswerChange(field.label, e.target.value)}
                              placeholder={`Sua resposta para ${field.label}`}
                              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all resize-y shadow-inner"
                            />
                          </div>
                        );
                      }

                      if (field.type === "select") {
                        return (
                          <div key={field.id} className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                              {field.label} {field.required && <span className="text-orange-500">*</span>}
                            </label>
                            <div className="relative">
                              <select
                                required={field.required}
                                value={value}
                                onChange={(e) => handleCustomAnswerChange(field.label, e.target.value)}
                                className="w-full pl-4 pr-10 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-orange-500 rounded-xl text-sm text-zinc-100 outline-none transition-all appearance-none cursor-pointer"
                              >
                                <option value="" className="bg-[#121214] text-zinc-500">
                                  Selecione uma opção...
                                </option>
                                {(field.options || []).map((opt, i) => (
                                  <option key={i} value={opt} className="bg-[#121214] text-zinc-100">
                                    {opt}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                            </div>
                          </div>
                        );
                      }

                      if (field.type === "checkbox") {
                        const isChecked = Boolean(value === "Sim" || value === true);
                        return (
                          <div
                            key={field.id}
                            onClick={() => handleCustomAnswerChange(field.label, isChecked ? "Não" : "Sim")}
                            className="flex items-center gap-3 p-3.5 bg-[#0f0f0f] border border-[#27272a] hover:border-zinc-700 rounded-xl cursor-pointer transition-all select-none"
                          >
                            <input
                              type="checkbox"
                              id={`cb-${field.id}`}
                              checked={isChecked}
                              onChange={(e) => handleCustomAnswerChange(field.label, e.target.checked ? "Sim" : "Não")}
                              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-orange-500 focus:ring-orange-500 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <label
                              htmlFor={`cb-${field.id}`}
                              className="text-sm font-medium text-zinc-200 cursor-pointer flex-1"
                            >
                              {field.label} {field.required && <span className="text-orange-500">*</span>}
                            </label>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              )}

              {/* 2. Informações de Pagamento e Taxa Oficial */}
              <div className="pt-2 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2 border-b border-[#27272a] pb-2">
                  <Shield className="h-4 w-4 text-orange-400" />
                  <span>Taxa de Inscrição</span>
                </h3>

                {entryFee > 0 ? (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-[#18181b] via-[#121214] to-zinc-900 border border-orange-500/25 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-black uppercase tracking-wider">
                          Pix Dinâmico
                        </span>
                        <span className="text-xs text-zinc-400">Pagamento Automatizado</span>
                      </div>
                      <div className="text-lg font-black text-white font-display">
                        R$ {entryFee.toFixed(2).replace(".", ",")}
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Ao prosseguir, você visualizará o <strong>QR Code Pix Oficial</strong> e a chave <strong>Pix Copia e Cola</strong> com confirmação integrada.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Inscrição Gratuita • Não há cobrança financeira para este torneio.</span>
                  </div>
                )}
              </div>

              {/* 3. Seção de Comprovante de Pagamento (Anexo Opcional/Recomendado para Torneios Pagos) */}
              {entryFee > 0 && (
                <div className="pt-2 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                      <Upload className="h-4 w-4 text-orange-400" />
                      <span>Comprovante de Pagamento</span>
                    </h3>
                    <span className="text-[10px] text-zinc-400">
                      PNG, JPG ou PDF (máx. 5MB)
                    </span>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="registration-receipt-upload"
                  />

                  {!receiptFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-[#27272a] hover:border-orange-500/50 rounded-2xl cursor-pointer bg-zinc-900/30 hover:bg-zinc-900/60 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <Upload className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-bold text-zinc-200 text-center">
                        Anexar Comprovante de Pagamento Pix
                      </p>
                      <p className="text-[10px] text-zinc-500 text-center mt-1">
                        Se você já efetuou o pagamento, anexe o comprovante aqui antes de concluir.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                      <div className="flex items-center gap-3 min-w-0">
                        {receiptPreview ? (
                          <img
                            src={receiptPreview}
                            alt="Pré-visualização do comprovante"
                            className="w-10 h-10 rounded-lg object-cover border border-zinc-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-200 truncate">
                            {receiptFile.name}
                          </p>
                          <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Comprovante pronto para envio ({(receiptFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Trocar
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveReceipt}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Remover comprovante"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botão de Envio / Prosseguir para Checkout Pix */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500 hover:from-orange-400 hover:to-amber-300 text-neutral-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-orange-500/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{receiptFile ? "Enviando Comprovante e Registrando..." : "Registrando Equipe..."}</span>
                    </>
                  ) : receiptFile ? (
                    <span>Confirmar Inscrição com Comprovante 🚀</span>
                  ) : entryFee > 0 ? (
                    <span>Prosseguir para Pagamento Pix (R$ {entryFee.toFixed(2).replace(".", ",")}) 🚀</span>
                  ) : (
                    <span>Confirmar Inscrição Gratuita 🚀</span>
                  )}
                </button>

                <p className="text-[11px] text-zinc-500 text-center mt-3">
                  Ao se inscrever, você declara concordar com o regulamento do campeonato.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
