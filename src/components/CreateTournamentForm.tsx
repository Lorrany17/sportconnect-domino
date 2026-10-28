"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  MapPin,
  Calendar,
  Clock,
  Users,
  ChevronDown,
  Loader2,
  X,
  AlertCircle,
  Plus,
  Minus,
  Sparkles,
  Camera,
  UploadCloud,
  Trash2,
  ImageIcon,
  FileText,
  Building2,
} from "lucide-react";
import { SportType, Tournament, CustomFieldType, CustomRegistrationField, Sponsor } from "@/types";
import { useAuth } from "@/context/AuthProvider";
import { useTournament } from "@/context/TournamentContext";
import { supabase } from "@/lib/supabase";

export interface CreateTournamentFormProps {
  onClose?: () => void;
  onSuccess?: (tournamentId: string) => void;
  isModal?: boolean;
  initialData?: Tournament | null;
}

export const SPORT_SELECT_OPTIONS: { id: SportType; label: string; icon: string }[] = [
  { id: "DOMINO", label: "Dominó", icon: "🁓" },
  { id: "PING_PONG", label: "Ping Pong", icon: "🏓" },
  { id: "FUTSAL", label: "Futsal", icon: "⚽" },
  { id: "VOLEI", label: "Vôlei", icon: "🏐" },
];

export const DEFAULT_COVERS: Record<SportType, string> = {
  DOMINO: "https://placehold.co/1200x400/18181b/00a2ff?text=Torneio+de+Domino",
  PING_PONG: "https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=1200&q=80",
  FUTSAL: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
  VOLEI: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1200&q=80",
};

export const VOLEI_FORMAT_OPTIONS = [
  "Quadra (6x6)",
  "Areia (Duplas)",
  "Areia (4x4)",
];

export const PING_PONG_FORMAT_OPTIONS = [
  "Solo (1v1)",
  "Duplas (2v2)",
];

export default function CreateTournamentForm({
  onClose,
  onSuccess,
  isModal = false,
  initialData,
}: CreateTournamentFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { setCurrentTournamentId, setTournaments, setCurrentSportType } = useTournament();

  const isEditing = Boolean(initialData?.id);

  // Estados locais do formulário
  const [name, setName] = useState(initialData?.name || "");
  const [sportType, setSportType] = useState<SportType>((initialData?.sport_type as SportType) || "DOMINO");
  const [format, setFormat] = useState<string>(initialData?.format || "Duplas");
  const [genderCategory, setGenderCategory] = useState<string>(
    initialData?.gender_category ? initialData.gender_category.toUpperCase() : "MISTO"
  );
  const [startDate, setStartDate] = useState(initialData?.start_date ? initialData.start_date.split("T")[0] : "");
  const [startTime, setStartTime] = useState(initialData?.start_time || "");
  const [address, setAddress] = useState(initialData?.location || "");
  const [debouncedAddress, setDebouncedAddress] = useState(initialData?.location || "");
  const [maxTeams, setMaxTeams] = useState<number>(initialData?.max_teams ? Number(initialData.max_teams) : 16);
  const [entryFee, setEntryFee] = useState<string>(initialData?.entry_fee !== undefined && initialData?.entry_fee !== null ? Number(initialData.entry_fee).toFixed(2) : "100.00");
  const [organizerPixKey, setOrganizerPixKey] = useState(initialData?.organizer_pix_key || "");
  const [rules, setRules] = useState(initialData?.rules || "");

  // Interface para Patrocinador no Formulário
  interface FormSponsor {
    id: string;
    name: string;
    logo_url: string | null;
    link: string | null;
    file?: File | null;
    previewUrl?: string | null;
  }

  // Helpers de parsing robusto (suporta array ou JSON em formato de string da base de dados)
  const parseCustomFields = (raw: any): CustomRegistrationField[] => {
    if (!raw) return [];
    let fields = raw;
    if (typeof raw === "string") {
      try {
        fields = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (Array.isArray(fields)) {
      return fields.map((f: any) => ({
        id: f.id || `field_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        label: f.label || "",
        type: f.type || "text",
        required: Boolean(f.required),
        options: Array.isArray(f.options) ? f.options : [],
        optionsString: Array.isArray(f.options)
          ? f.options.join(", ")
          : typeof f.options === "string"
          ? f.options
          : "",
      }));
    }
    return [];
  };

  const parseSponsors = (raw: any): FormSponsor[] => {
    if (!raw) return [];
    let sps = raw;
    if (typeof raw === "string") {
      try {
        sps = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (Array.isArray(sps)) {
      return sps.map((s: any) => ({
        id: s.id || `sp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: s.name || "",
        logo_url: s.logo_url || null,
        link: s.link || null,
        previewUrl: s.logo_url || null,
      }));
    }
    return [];
  };

  // Estado para Campos Personalizados de Inscrição (Estilo Google Forms)
  const [customFields, setCustomFields] = useState<CustomRegistrationField[]>(() =>
    parseCustomFields(initialData?.custom_registration_fields)
  );

  // Estado para Patrocinadores do Evento
  const [sponsors, setSponsors] = useState<FormSponsor[]>(() =>
    parseSponsors(initialData?.sponsors)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Estados para foto de capa (Upload / Padrão / Existente)
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(initialData?.cover_url || null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manipuladores de Campos Personalizados
  const handleAddCustomField = () => {
    const newField: CustomRegistrationField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      label: "",
      type: "text",
      required: false,
      options: [],
      optionsString: "",
    };
    setCustomFields((prev) => [...prev, newField]);
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpdateCustomField = (id: string, updates: Partial<CustomRegistrationField>) => {
    setCustomFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const updated = { ...f, ...updates };
        if (updates.optionsString !== undefined) {
          updated.options = updates.optionsString
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return updated;
      })
    );
  };

  // Manipuladores de Patrocinadores
  const handleAddSponsor = () => {
    const newSponsor: FormSponsor = {
      id: `sp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: "",
      logo_url: null,
      link: null,
      file: null,
      previewUrl: null,
    };
    setSponsors((prev) => [...prev, newSponsor]);
  };

  const handleRemoveSponsor = (id: string) => {
    setSponsors((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target?.previewUrl && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((s) => s.id !== id);
    });
  };

  const handleUpdateSponsor = (id: string, updates: Partial<FormSponsor>) => {
    setSponsors((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return { ...s, ...updates };
      })
    );
  };

  const handleSponsorLogoSelect = (id: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WEBP).");
      return;
    }
    const preview = URL.createObjectURL(file);
    setSponsors((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (s.previewUrl && s.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(s.previewUrl);
        }
        return { ...s, file, previewUrl: preview };
      })
    );
  };

  // Atualiza estados caso initialData mude
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      if (initialData.sport_type) {
        setSportType(initialData.sport_type as SportType);
      }
      if (initialData.format) {
        setFormat(initialData.format);
      }
      if (initialData.gender_category) {
        setGenderCategory(initialData.gender_category.toUpperCase());
      }
      if (initialData.start_date) {
        setStartDate(initialData.start_date.split("T")[0]);
      }
      if (initialData.start_time !== undefined) {
        setStartTime(initialData.start_time || "");
      }
      if (initialData.location) {
        setAddress(initialData.location);
        setDebouncedAddress(initialData.location);
      }
      if (initialData.max_teams) {
        setMaxTeams(Number(initialData.max_teams));
      }
      if (initialData.entry_fee !== undefined && initialData.entry_fee !== null) {
        setEntryFee(Number(initialData.entry_fee).toFixed(2));
      }
      if (initialData.organizer_pix_key) {
        setOrganizerPixKey(initialData.organizer_pix_key);
      }
      if (initialData.rules) {
        setRules(initialData.rules);
      }
      if (initialData.cover_url) {
        setCoverPreviewUrl(initialData.cover_url);
      }

      if (initialData.custom_registration_fields !== undefined) {
        setCustomFields(parseCustomFields(initialData.custom_registration_fields));
      }
      if (initialData.sponsors !== undefined) {
        setSponsors(parseSponsors(initialData.sponsors));
      }

      // Se estiver em modo edição (initialData.id existe) e os campos/patrocinadores não vieram ou estão ausentes,
      // busca diretamente da tabela tournaments no Supabase para garantir persistência total!
      if (
        initialData.id &&
        (initialData.custom_registration_fields === undefined ||
          initialData.sponsors === undefined ||
          initialData.start_time === undefined)
      ) {
        supabase
          .from("tournaments")
          .select("custom_registration_fields, sponsors, start_time, gender_category")
          .eq("id", initialData.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (!error && data) {
              if (
                data.custom_registration_fields &&
                (initialData.custom_registration_fields === undefined ||
                  !Array.isArray(initialData.custom_registration_fields) ||
                  initialData.custom_registration_fields.length === 0)
              ) {
                setCustomFields(parseCustomFields(data.custom_registration_fields));
              }
              if (
                data.sponsors &&
                (initialData.sponsors === undefined ||
                  !Array.isArray(initialData.sponsors) ||
                  initialData.sponsors.length === 0)
              ) {
                setSponsors(parseSponsors(data.sponsors));
              }
              if (data.start_time && !initialData.start_time) {
                setStartTime(data.start_time);
              }
              if (data.gender_category && !initialData.gender_category) {
                setGenderCategory(data.gender_category.toUpperCase());
              }
            }
          });
      }
    }
  }, [initialData]);

  // Limpa o ObjectURL de preview para evitar vazamento de memória
  useEffect(() => {
    return () => {
      if (coverPreviewUrl && !coverPreviewUrl.startsWith("http")) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  // Manipulador de seleção de arquivo de capa
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("A imagem deve ter no máximo 5MB.");
      return;
    }
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }
    setCoverFile(file);
    const preview = URL.createObjectURL(file);
    setCoverPreviewUrl(preview);
    if (errorMessage) setErrorMessage("");
  };

  // Remover imagem personalizada e voltar para o padrão do esporte
  const handleRemoveCover = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }
    setCoverFile(null);
    setCoverPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Preview ativo: se o usuário selecionou imagem, usa o preview local; caso contrário, a capa padrão da modalidade
  const activeCoverUrl = coverPreviewUrl || DEFAULT_COVERS[sportType];

  // 1. Debounce de 800ms para o endereço do mapa
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedAddress(address.trim());
    }, 800);

    return () => {
      clearTimeout(handler);
    };
  }, [address]);

  // 2. Adaptação do campo Formato ao mudar a Modalidade
  const handleSportChange = (newSport: SportType) => {
    setSportType(newSport);
    if (newSport === "VOLEI") {
      setFormat("Quadra (6x6)");
    } else if (newSport === "PING_PONG") {
      setFormat("Solo (1v1)");
    } else if (newSport === "DOMINO") {
      setFormat("Duplas");
    } else if (newSport === "FUTSAL") {
      setFormat("5x5");
    }
  };

  const isFormatVisible = sportType === "VOLEI" || sportType === "PING_PONG";

  // 3. Rótulos Dinâmicos para o Contador de Vagas (Número de X) e Valor da Inscrição
  const getCounterMeta = () => {
    if (sportType === "DOMINO") {
      return {
        label: "Número de Duplas",
        unit: "duplas",
        singular: "dupla",
      };
    }
    if (sportType === "PING_PONG") {
      if (format === "Duplas (2v2)") {
        return {
          label: "Número de Duplas",
          unit: "duplas",
          singular: "dupla",
        };
      }
      return {
        label: "Número de Jogadores",
        unit: "jogadores",
        singular: "jogador",
      };
    }
    if (sportType === "VOLEI") {
      if (format === "Areia (Duplas)") {
        return {
          label: "Número de Duplas",
          unit: "duplas",
          singular: "dupla",
        };
      }
      return {
        label: "Número de Equipes",
        unit: "equipes",
        singular: "equipe",
      };
    }
    // Futsal ou Padrão
    return {
      label: "Número de Equipes",
      unit: "equipes",
      singular: "equipe",
    };
  };

  const counterMeta = getCounterMeta();

  // Manipulador do contador de times (- e +)
  const handleDecrementTeams = () => {
    setMaxTeams((prev) => Math.max(prev - 2, 2));
  };

  const handleIncrementTeams = () => {
    setMaxTeams((prev) => Math.min(prev + 2, 64));
  };

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // Validação de campos obrigatórios
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Por favor, informe o Nome do Torneio.");
      return;
    }

    if (!sportType) {
      setErrorMessage("Por favor, selecione a Modalidade esportiva.");
      return;
    }

    setIsSubmitting(true);

    try {
      const parsedEntryFee = parseFloat(entryFee) || 0;
      const formattedStartDate = startDate ? new Date(startDate).toISOString() : null;
      const ownerId =
        user?.id && user.id !== "organizer-admin-session" ? user.id : null;

      // Sanitização dos campos personalizados
      const sanitizedCustomFields = customFields
        .map((f) => {
          const opts = f.optionsString
            ? f.optionsString.split(",").map((s) => s.trim()).filter(Boolean)
            : Array.isArray(f.options)
            ? f.options
            : [];
          return {
            id: f.id,
            label: f.label.trim(),
            type: f.type,
            required: Boolean(f.required),
            ...(f.type === "select" ? { options: opts } : {}),
          };
        })
        .filter((f) => f.label.length > 0);

      // Processamento e Upload das Logos de Patrocinadores
      const processedSponsors: Sponsor[] = [];
      for (const sp of sponsors) {
        const trimmedSpName = sp.name.trim();
        if (!trimmedSpName) continue; // Pula patrocinadores sem nome

        let finalLogoUrl = sp.logo_url || null;
        if (sp.file) {
          try {
            const cleanFileName = sp.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const uniqueFileName = `${Date.now()}_${cleanFileName}`;

            const { error: spUploadError } = await supabase.storage
              .from("sponsors")
              .upload(uniqueFileName, sp.file, {
                cacheControl: "3600",
                upsert: true,
              });

            if (!spUploadError) {
              const { data: pubData } = supabase.storage
                .from("sponsors")
                .getPublicUrl(uniqueFileName);

              if (pubData?.publicUrl) {
                finalLogoUrl = pubData.publicUrl;
              }
            } else {
              console.warn("Aviso no upload da logo do patrocinador:", spUploadError);
            }
          } catch (spErr) {
            console.warn("Exceção ao enviar logo:", spErr);
          }
        }

        processedSponsors.push({
          id: sp.id,
          name: trimmedSpName,
          logo_url: finalLogoUrl,
          link: sp.link ? sp.link.trim() : null,
        });
      }

      // Montagem da base do payload
      const payload: any = {
        name: trimmedName,
        sport_type: sportType,
        gender_category: (genderCategory || "MISTO").toUpperCase(),
        format: format || (sportType === "DOMINO" ? "Duplas" : sportType === "FUTSAL" ? "5x5" : null),
        start_date: formattedStartDate,
        start_time: startTime.trim() || null,
        location: address.trim() || null,
        max_teams: maxTeams,
        entry_fee: parsedEntryFee,
        rules: rules.trim() || null,
        organizer_pix_key: organizerPixKey.trim() || null,
        custom_registration_fields: sanitizedCustomFields,
        sponsors: processedSponsors,
      };

      if (isEditing) {
        // MODO DE EDIÇÃO: UPDATE na tabela tournaments
        const tournamentIdToUpdate = initialData!.id;

        // 1. Verificar se o utilizador anexou um NOVO ficheiro de imagem no campo de capa
        if (coverFile) {
          try {
            const cleanFileName = coverFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const uniqueFileName = `${Date.now()}_${cleanFileName}`;

            const { error: uploadError } = await supabase.storage
              .from("covers")
              .upload(uniqueFileName, coverFile, {
                cacheControl: "3600",
                upsert: true,
              });

            if (uploadError) {
              console.error("Erro no upload da foto de capa (modo edição):", uploadError);
              alert(`Erro no upload da foto de capa: ${uploadError.message}`);
              setIsSubmitting(false);
              return;
            }

            const { data: publicData } = supabase.storage
              .from("covers")
              .getPublicUrl(uniqueFileName);

            if (publicData?.publicUrl) {
              payload.cover_url = publicData.publicUrl;
            }
          } catch (storageErr: any) {
            console.error("Exceção ao fazer upload da capa:", storageErr);
            alert(`Falha no upload da foto de capa: ${storageErr?.message || storageErr}`);
            setIsSubmitting(false);
            return;
          }
        } else {
          // Se o utilizador NÃO alterou a imagem, mantenha o cover_url atual sem sobrescrever
          if (initialData?.cover_url) {
            payload.cover_url = initialData.cover_url;
          } else if (coverPreviewUrl) {
            payload.cover_url = coverPreviewUrl;
          }
        }

        // 2. Executar o UPDATE com bloco try/catch robusto
        try {
          const { data, error } = await supabase
            .from("tournaments")
            .update(payload)
            .eq("id", tournamentIdToUpdate)
            .select()
            .single();

          if (error) {
            console.error("Erro Supabase ao atualizar torneio:", error);
            alert(`Erro ao salvar alterações do torneio: ${error.message}`);
            setIsSubmitting(false);
            return;
          }

          setCurrentSportType(sportType);

          setTournaments((prev: Tournament[]) =>
            prev.map((t) =>
              t.id === tournamentIdToUpdate
                ? {
                    ...t,
                    ...payload,
                    id: tournamentIdToUpdate,
                    cover_url: data?.cover_url || payload.cover_url || t.cover_url,
                  }
                : t
            )
          );

          if (onSuccess) {
            onSuccess(tournamentIdToUpdate);
          } else if (onClose) {
            onClose();
          }
        } catch (updateErr: any) {
          console.error("Falha ao atualizar torneio no banco de dados:", updateErr);
          alert(`Erro ao atualizar torneio: ${updateErr?.message || updateErr}`);
          setIsSubmitting(false);
          return;
        }
      } else {
        // MODO CRIAÇÃO (INSERT)
        let finalCoverUrl = DEFAULT_COVERS[sportType];

        if (coverFile) {
          try {
            const cleanFileName = coverFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const uniqueFileName = `${Date.now()}_${cleanFileName}`;

            const { error: uploadError } = await supabase.storage
              .from("covers")
              .upload(uniqueFileName, coverFile, {
                cacheControl: "3600",
                upsert: true,
              });

            if (uploadError) {
              console.warn("Aviso no upload da capa na criação:", uploadError);
            } else {
              const { data: publicData } = supabase.storage
                .from("covers")
                .getPublicUrl(uniqueFileName);
              if (publicData?.publicUrl) {
                finalCoverUrl = publicData.publicUrl;
              }
            }
          } catch (storageErr) {
            console.warn("Exceção no upload da capa na criação:", storageErr);
          }
        } else if (coverPreviewUrl) {
          finalCoverUrl = coverPreviewUrl;
        }

        payload.cover_url = finalCoverUrl;
        payload.status = "OPEN";
        payload.owner_id = ownerId;

        const { data, error } = await supabase
          .from("tournaments")
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.error("Erro Supabase ao criar torneio:", error);
          throw error;
        }

        const createdTournamentId = data?.id;

        if (createdTournamentId) {
          setCurrentTournamentId(createdTournamentId);
          setCurrentSportType(sportType);
          if (typeof window !== "undefined") {
            localStorage.setItem("sc_current_tournament_id", createdTournamentId);
          }

          const mappedNewTour: Tournament = {
            id: createdTournamentId,
            name: data.name,
            status: data.status,
            createdAt: data.created_at,
            sport_type: data.sport_type,
            format: data.format,
            gender_category: (data.gender_category || genderCategory || "MISTO").toUpperCase(),
            owner_id: data.owner_id,
            max_teams: data.max_teams ? Number(data.max_teams) : maxTeams,
            entry_fee: data.entry_fee ? Number(data.entry_fee) : parsedEntryFee,
            location: data.location,
            start_date: data.start_date,
            start_time: data.start_time || payload.start_time,
            rules: data.rules,
            cover_url: data.cover_url || finalCoverUrl,
            organizer_pix_key: data.organizer_pix_key || organizerPixKey.trim() || undefined,
            custom_registration_fields: data.custom_registration_fields || sanitizedCustomFields,
            sponsors: data.sponsors || processedSponsors,
          };

          setTournaments((prev: Tournament[]) => [mappedNewTour, ...prev]);
        }

        // Redirecionamento para o Dashboard
        if (onSuccess && createdTournamentId) {
          onSuccess(createdTournamentId);
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: unknown) {
      console.error("Erro ao salvar campeonato:", err);

      let msg = "Ocorreu um erro ao salvar o campeonato no banco de dados.";

      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        // Captura a propriedade message de objetos de erro do Supabase
        msg = String((err as { message: string }).message);
      }

      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`bg-[#1a1a1a] border border-[#333] rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl relative text-white w-full max-h-[90vh] overflow-y-auto selection:bg-blue-600/30 selection:text-white ${
        isModal ? "max-w-xl mx-auto" : "max-w-2xl mx-auto"
      }`}
    >
      {/* Faixa decorativa superior em gradiente azul SportConnect */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-[#00a2ff] to-indigo-500" />

      {/* Botão de Fechar Modal (se fornecido) */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-blue-600/15 border border-blue-500/25 text-blue-400">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight uppercase">
              {isEditing ? "Editar Configurações do Torneio" : "Configurar Novo Torneio"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              {isEditing
                ? "Atualize os dados e regulamento da sua competição oficial."
                : "Preencha as informações essenciais para abrir as inscrições e gerenciar sua competição."}
            </p>
          </div>
        </div>
      </div>

      {/* Alerta de Erro Visual */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Formulário com Grelha Responsiva (Mobile 1 col, Desktop md:grid-cols-2) */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Upload da Foto de Capa (Drag & Drop + Botão + Live Preview Padrão/Custom) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
              Foto de Capa do Torneio
            </label>
            <span className="text-[11px] text-zinc-400 font-medium">
              {coverFile ? "Arquivo selecionado" : `Padrão: ${SPORT_SELECT_OPTIONS.find((s) => s.id === sportType)?.label}`}
            </span>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileSelect(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border-2 border-dashed transition-all cursor-pointer group flex flex-col justify-between p-4 ${
              isDragging
                ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30"
                : coverFile
                ? "border-blue-500/60 bg-[#18181b]"
                : "border-[#3f3f46] hover:border-zinc-500 bg-[#18181b]"
            }`}
          >
            {/* Imagem de Fundo (Preview Ao Vivo: Usuário ou Padrão) */}
            <img
              src={activeCoverUrl}
              alt="Capa do Torneio"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Gradiente Escuro Sobreposto para contraste e legibilidade */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30 group-hover:from-black/95 transition-all" />

            {/* Input de arquivo invisível */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />

            {/* Badges superiores na imagem */}
            <div className="relative z-10 flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white shadow-md">
                {coverFile ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Capa Personalizada</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span>Capa Padrão ({SPORT_SELECT_OPTIONS.find((s) => s.id === sportType)?.label})</span>
                  </>
                )}
              </div>

              {coverFile && (
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-all shadow-md active:scale-95 cursor-pointer"
                  title="Remover foto personalizada e restaurar padrão"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Conteúdo inferior e instruções de upload */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/90 group-hover:bg-blue-600 border border-blue-400/30 flex items-center justify-center text-white shadow-lg shrink-0 transition-transform group-hover:scale-110">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                    {coverFile ? "Clique ou arraste para trocar a capa" : "Arraste uma foto ou clique para escolher"}
                  </p>
                  <p className="text-[11px] text-zinc-300">
                    PNG, JPG ou WEBP (máximo 5MB)
                  </p>
                </div>
              </div>

              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 group-hover:bg-white/20 backdrop-blur-md border border-white/15 text-xs font-bold text-white transition-all shadow-md">
                <UploadCloud className="h-3.5 w-3.5 text-blue-400" />
                <span>{coverFile ? "Alterar foto" : "Upload"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Nome do Torneio */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
            Nome do Torneio <span className="text-blue-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errorMessage) setErrorMessage("");
            }}
            placeholder="Ex: Copa Picos de Futsal 2026"
            className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
          />
        </div>

        {/* 2. Grid Responsiva: Modalidade e Categoria (Gênero) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Modalidade */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
              Modalidade <span className="text-blue-500">*</span>
            </label>
            <div className="relative">
              <select
                value={sportType}
                onChange={(e) => handleSportChange(e.target.value as SportType)}
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-zinc-100 outline-none transition-all appearance-none cursor-pointer pr-10"
              >
                {SPORT_SELECT_OPTIONS.map((sport) => (
                  <option key={sport.id} value={sport.id} className="bg-[#1a1a1a] text-white">
                    {sport.icon} {sport.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-400">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Categoria de Gênero */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
              Categoria <span className="text-blue-500">*</span>
            </label>
            <div className="relative">
              <select
                value={genderCategory}
                onChange={(e) => setGenderCategory(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-zinc-100 outline-none transition-all appearance-none cursor-pointer pr-10"
              >
                <option value="MASCULINO" className="bg-[#1a1a1a] text-white">Masculino</option>
                <option value="FEMININO" className="bg-[#1a1a1a] text-white">Feminino</option>
                <option value="MISTO" className="bg-[#1a1a1a] text-white">Misto</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-400">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* 2.1 Formato da Competição (se aplicável), Data de Início e Horário */}
        <div className={`grid grid-cols-1 ${isFormatVisible ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
          {isFormatVisible && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                Formato da Competição <span className="text-blue-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-zinc-100 outline-none transition-all appearance-none cursor-pointer pr-10"
                >
                  {sportType === "VOLEI" &&
                    VOLEI_FORMAT_OPTIONS.map((fmt) => (
                      <option key={fmt} value={fmt} className="bg-[#1a1a1a] text-white">
                        {fmt}
                      </option>
                    ))}
                  {sportType === "PING_PONG" &&
                    PING_PONG_FORMAT_OPTIONS.map((fmt) => (
                      <option key={fmt} value={fmt} className="bg-[#1a1a1a] text-white">
                        {fmt}
                      </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
              Data de Início
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-zinc-100 outline-none transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
              Horário (Opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#0f0f0f] border border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-zinc-100 outline-none transition-all [color-scheme:dark]"
              />
            </div>
            <p className="text-[11px] text-zinc-500">Deixe em branco se ainda for a definir</p>
          </div>
        </div>

        {/* 3. Local do Evento & Mapa Funcional com Iframe */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
            Local do Evento
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-500">
              <MapPin className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Digite o endereço do ginásio, quadra ou clube..."
              className="w-full pl-10 pr-4 py-3 bg-[#0f0f0f] border border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
            />
          </div>

          {/* Renderização Condicional do Mapa Google Maps */}
          <div className="mt-2">
            {!debouncedAddress ? (
              <div className="h-[150px] w-full rounded-xl border border-[#333] bg-[#0c0c0c] flex flex-col items-center justify-center p-4 text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-[#333] flex items-center justify-center text-zinc-500 mb-2">
                  <MapPin className="h-5 w-5 text-blue-500/70" />
                </div>
                <p className="text-xs text-zinc-400 font-medium">
                  Digite o endereço para carregar o mapa
                </p>
                <span className="text-[11px] text-zinc-600 mt-0.5">
                  O mapa interativo será carregado automaticamente
                </span>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 shadow-md animate-fadeIn">
                <iframe
                  width="100%"
                  height="150"
                  className="rounded-md border border-zinc-700 w-full block"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    debouncedAddress
                  )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  frameBorder="0"
                  scrolling="no"
                  title="Localização do Torneio"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        </div>

        {/* 4. Grid Responsiva: Contador de Vagas e Valor da Inscrição */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Número de Vagas com Rótulo e Unidade Dinâmicos */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
              {counterMeta.label}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecrementTeams}
                disabled={maxTeams <= 2}
                className="w-12 h-11 rounded-xl bg-[#0f0f0f] border border-[#333] hover:border-blue-500 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Diminuir vagas"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="flex-1 h-11 bg-[#0f0f0f] border border-[#333] rounded-xl flex items-center justify-center px-3 shadow-inner">
                <Users className="h-4 w-4 text-blue-500 mr-2 shrink-0" />
                <span className="text-base font-black text-white font-display">
                  {maxTeams}
                </span>
                <span className="text-xs text-zinc-500 font-bold ml-1.5 truncate">
                  {counterMeta.unit}
                </span>
              </div>

              <button
                type="button"
                onClick={handleIncrementTeams}
                disabled={maxTeams >= 64}
                className="w-12 h-11 rounded-xl bg-[#0f0f0f] border border-[#333] hover:border-blue-500 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Aumentar vagas"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Valor da Inscrição (por time/dupla/jogador) */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
              VALOR DA INSCRIÇÃO (POR {counterMeta.singular.toUpperCase()})
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-500 font-bold text-xs">
                R$
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                placeholder="100.00"
                className="w-full pl-11 pr-4 py-3 bg-[#0f0f0f] border border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Chave Pix para Repasse (Organizador) */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
            Chave Pix para Repasse (Organizador)
          </label>
          <div className="relative">
            <input
              type="text"
              value={organizerPixKey}
              onChange={(e) => setOrganizerPixKey(e.target.value)}
              placeholder="Ex: CPF, E-mail, Celular ou Chave Aleatória"
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner font-mono"
            />
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            O valor arrecadado (com o desconto da taxa da plataforma) será transferido para esta chave.
          </p>
        </div>

        {/* 5. Regras e Regulamento (Opcional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
            Regras e Regulamento (Opcional)
          </label>
          <textarea
            rows={3}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="Descreva pontuação máxima, critérios de desempate, tolerância para atrasos (W.O.) e diretrizes gerais..."
            className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all resize-y shadow-inner"
          />
        </div>

        {/* Nova Secção: Campos Personalizados de Inscrição (Estilo Google Forms) */}
        <div className="space-y-3 pt-2 border-t border-[#27272a]/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200">
                  Campos Personalizados de Inscrição
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Crie perguntas personalizadas para os atletas responderem no formulário de inscrição.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddCustomField}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 hover:border-blue-500/50 text-blue-400 hover:text-blue-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer self-start sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar Pergunta</span>
            </button>
          </div>

          {customFields.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-dashed border-[#27272a] text-center space-y-1">
              <p className="text-xs text-zinc-400 font-medium">
                Nenhuma pergunta personalizada adicionada.
              </p>
              <p className="text-[11px] text-zinc-600">
                Os atletas responderão apenas aos campos padrão (Nome, Contato/WhatsApp).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {customFields.map((field, index) => {
                const parsedOptions = field.optionsString
                  ? field.optionsString.split(",").map((s) => s.trim()).filter(Boolean)
                  : Array.isArray(field.options)
                  ? field.options
                  : [];

                return (
                  <div
                    key={field.id}
                    className="p-4 rounded-2xl bg-[#0f0f0f] border border-[#27272a] hover:border-zinc-700 transition-all space-y-3 shadow-inner"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-black flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                          Pergunta #{index + 1}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(field.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Remover pergunta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      {/* Texto da Pergunta (label) */}
                      <div className="sm:col-span-7 space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                          Texto da Pergunta <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => handleUpdateCustomField(field.id, { label: e.target.value })}
                          placeholder="Ex: Tamanho da Camisa, Traz Raquete?"
                          className="w-full px-3.5 py-2.5 bg-[#141416] border border-[#27272a] focus:border-blue-500 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition-all"
                        />
                      </div>

                      {/* Tipo da Pergunta (type) */}
                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                          Tipo de Resposta
                        </label>
                        <div className="relative">
                          <select
                            value={field.type}
                            onChange={(e) =>
                              handleUpdateCustomField(field.id, {
                                type: e.target.value as CustomFieldType,
                              })
                            }
                            className="w-full pl-3.5 pr-8 py-2.5 bg-[#141416] border border-[#27272a] focus:border-blue-500 rounded-xl text-xs text-zinc-200 outline-none transition-all appearance-none cursor-pointer"
                          >
                            <option value="text">Texto Curto</option>
                            <option value="textarea">Texto Longo</option>
                            <option value="select">Múltipla Escolha</option>
                            <option value="checkbox">Caixa de Seleção / Checkbox</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Opções de Múltipla Escolha (se o tipo for select) */}
                    {field.type === "select" && (
                      <div className="space-y-1.5 pt-1 border-t border-[#27272a]/40">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                          Opções de Escolha (separadas por vírgula)
                        </label>
                        <input
                          type="text"
                          value={field.optionsString ?? ""}
                          onChange={(e) =>
                            handleUpdateCustomField(field.id, { optionsString: e.target.value })
                          }
                          placeholder="Ex: P, M, G, GG ou Canhoto, Destro"
                          className="w-full px-3.5 py-2.5 bg-[#141416] border border-[#27272a] focus:border-blue-500 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition-all"
                        />
                        {parsedOptions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-zinc-500 font-bold">Prévia:</span>
                            {parsedOptions.map((opt, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-medium"
                              >
                                {opt}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Toggle / Checkbox de Obrigatório (required) */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#27272a]/40">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            handleUpdateCustomField(field.id, { required: e.target.checked })
                          }
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-zinc-300">
                          Resposta Obrigatória
                        </span>
                      </label>
                      <span className="text-[10px] text-zinc-500">
                        {field.required ? "Atleta deve responder para se inscrever" : "Opcional"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Nova Secção: Patrocinadores do Evento */}
        <div className="space-y-3 pt-2 border-t border-[#27272a]/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200">
                  Patrocinadores do Evento
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Adicione marcas e apoiadores oficiais para exibir na vitrine do torneio e no chaveamento.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddSponsor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/30 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer self-start sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar Patrocinador</span>
            </button>
          </div>

          {sponsors.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-dashed border-[#27272a] text-center space-y-1">
              <p className="text-xs text-zinc-400 font-medium">
                Nenhum patrocinador cadastrado.
              </p>
              <p className="text-[11px] text-zinc-600">
                Torneios com patrocinadores ganham mais visibilidade e credibilidade.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sponsors.map((sponsor, index) => (
                <div
                  key={sponsor.id}
                  className="p-4 rounded-2xl bg-[#0f0f0f] border border-[#27272a] hover:border-zinc-700 transition-all space-y-3 shadow-inner"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                        Patrocinador #{index + 1}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSponsor(sponsor.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Remover patrocinador"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Nome da Empresa/Marca */}
                    <div className="sm:col-span-6 space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                        Nome da Empresa/Marca <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={sponsor.name}
                        onChange={(e) => handleUpdateSponsor(sponsor.id, { name: e.target.value })}
                        placeholder="Ex: Auto Posto Central, Red Bull"
                        className="w-full px-3.5 py-2.5 bg-[#141416] border border-[#27272a] focus:border-amber-500 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition-all"
                      />
                    </div>

                    {/* Link / Instagram */}
                    <div className="sm:col-span-6 space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                        Link / Instagram (Opcional)
                      </label>
                      <input
                        type="text"
                        value={sponsor.link || ""}
                        onChange={(e) => handleUpdateSponsor(sponsor.id, { link: e.target.value })}
                        placeholder="https://instagram.com/marca ou site"
                        className="w-full px-3.5 py-2.5 bg-[#141416] border border-[#27272a] focus:border-amber-500 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Upload da Logo */}
                  <div className="space-y-1.5 pt-1 border-t border-[#27272a]/40">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                      Logo da Marca (Opcional)
                    </label>
                    <div className="flex items-center gap-3">
                      {sponsor.previewUrl ? (
                        <div className="relative w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center p-1 overflow-hidden shrink-0">
                          <img
                            src={sponsor.previewUrl}
                            alt={sponsor.name || "Logo"}
                            className="w-full h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSponsor(sponsor.id, {
                                logo_url: null,
                                file: null,
                                previewUrl: null,
                              })
                            }
                            className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors"
                            title="Remover imagem"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-[#141416] border border-dashed border-[#27272a] flex items-center justify-center text-zinc-600 shrink-0">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}

                      <div className="flex-1">
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors border border-zinc-700">
                          <UploadCloud className="h-3.5 w-3.5 text-amber-400" />
                          <span>{sponsor.previewUrl ? "Alterar Logo" : "Escolher Logo (PNG, JPG, SVG)"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleSponsorLogoSelect(sponsor.id, file);
                            }}
                          />
                        </label>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Recomendado: imagem transparente (PNG ou SVG) até 3MB.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. Botão de Submissão & Termos de Uso */}
        <div className="pt-2 space-y-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-blue-600/30 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isEditing ? "Salvando Alterações..." : "Criando Torneio..."}</span>
              </>
            ) : (
              <span>{isEditing ? "Salvar Alterações 💾" : "Criar Torneio 🚀"}</span>
            )}
          </button>

          <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
            {isEditing
              ? "As alterações serão refletidas imediatamente na página pública e no painel do torneio."
              : "Ao criar este torneio, você concorda com os Termos de Uso e Políticas de Privacidade da SportConnect."}
          </p>
        </div>
      </form>
    </div>
  );
}
