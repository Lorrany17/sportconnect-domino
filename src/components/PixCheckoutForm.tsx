"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  ShieldCheck,
  RefreshCw,
  QrCode,
  Sparkles,
  FileText,
  UploadCloud,
  ArrowRight,
  Shield,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthProvider";

export interface PixCheckoutFormProps {
  tournamentId: string;
  tournamentName: string;
  teamId: string;
  teamName: string;
  captainName: string;
  totalAmount: number;
  sportType?: string;
  email?: string;
  onClose?: () => void;
  onSuccess?: () => void;
}

interface SplitInfo {
  platformFee: number;
  organizerAmount: number;
  platformFeePercentage: number;
  currency?: string;
}

export default function PixCheckoutForm({
  tournamentId,
  tournamentName,
  teamId,
  teamName,
  captainName,
  totalAmount,
  sportType,
  email,
  onClose,
  onSuccess,
}: PixCheckoutFormProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeBase64, setQrCodeBase64] = useState<string>("");
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState<string>("");
  const [copiaECola, setCopiaECola] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const [split, setSplit] = useState<SplitInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  // Estados de upload de comprovante
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptSuccess, setReceiptSuccess] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formatar Moeda Brasileira
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  // Redirecionamento unificado
  const handleRedirect = useCallback(() => {
    if (onSuccess) {
      onSuccess();
    }
    if (onClose) {
      onClose();
    }
    if (tournamentId) {
      router.push(`/torneio/${tournamentId}`);
    }
  }, [onSuccess, onClose, tournamentId, router]);

  // Gerar Pagamento Pix via Rota Backend Next.js (/api/checkout/pix)
  const generatePix = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/checkout/pix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tournamentId,
          teamId,
          totalAmount,
          teamName,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Não foi possível gerar a cobrança Pix no momento."
        );
      }

      setPaymentId(data.paymentId || "");
      setCopiaECola(data.qr_code_copia_e_cola || data.qr_code || "");
      setQrCodeBase64(data.qr_code_base64 || "");

      // Define URL da imagem (suporta data url direta ou base64 bruta)
      if (data.qr_code_image_url) {
        setQrCodeImageUrl(data.qr_code_image_url);
      } else if (data.qr_code_base64) {
        const src = data.qr_code_base64.startsWith("data:")
          ? data.qr_code_base64
          : `data:image/svg+xml;base64,${data.qr_code_base64}`;
        setQrCodeImageUrl(src);
      }

      if (data.split) {
        setSplit({
          platformFee: data.split.platformFee ?? data.split.platform_fee ?? 0,
          organizerAmount:
            data.split.organizerAmount ?? data.split.organizer_amount ?? 0,
          platformFeePercentage:
            data.split.platformFeePercentage ??
            data.split.platform_fee_percentage ??
            10,
          currency: data.split.currency || "BRL",
        });
      }
    } catch (err: unknown) {
      console.error("Erro ao gerar Pix:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Erro ao comunicar com a plataforma de pagamentos.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, teamId, totalAmount]);

  useEffect(() => {
    generatePix();
  }, [generatePix]);

  // Copiar código Pix para a área de transferência
  const handleCopyCode = async () => {
    if (!copiaECola) return;
    try {
      await navigator.clipboard.writeText(copiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para navegadores legados
      const textarea = document.createElement("textarea");
      textarea.value = copiaECola;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Upload do Comprovante de Pagamento
  const handleUploadReceipt = async (file: File) => {
    setReceiptError(null);

    // Validação de tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Falha ao enviar imagem. Verifique o tamanho (máx 5MB).");
      return;
    }

    setIsUploadingReceipt(true);

    try {
      const userId = user?.id || teamId;
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Erro no upload:", uploadError);
        alert("Falha ao enviar imagem. Verifique o tamanho (máx 5MB).");
        return;
      }

      // Update final na tabela
      const { error: updateError } = await supabase
        .from("teams")
        .update({ payment_proof_url: filePath, payment_status: "WAITING_PIX" })
        .eq("id", teamId);

      if (updateError) {
        console.error("Erro no update da equipe com comprovante:", updateError);
        alert("Erro ao registrar comprovante da equipe.");
        return;
      }

      setUploadedReceiptUrl(filePath);
      setReceiptSuccess(true);
    } catch (err: unknown) {
      console.error("Erro no envio do comprovante:", err);
      alert("Falha ao enviar imagem. Verifique o tamanho (máx 5MB).");
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  // Verificação automática periódica de status no Supabase (Polling suave)
  useEffect(() => {
    if (isPaid || !teamId) return;

    const interval = setInterval(async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("teams")
          .select("payment_status")
          .eq("id", teamId)
          .maybeSingle();

        if (!fetchErr && data && data.payment_status === "APPROVED") {
          setIsPaid(true);
          setTimeout(handleRedirect, 3000);
        }
      } catch (pollErr) {
        console.warn("Aviso na checagem de status do Pix:", pollErr);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [isPaid, teamId, handleRedirect]);

  // Botão de simulação manual de confirmação (Webhook mock para testes rápidos)
  const handleSimulatePaymentApproval = async () => {
    try {
      setCheckingPayment(true);
      const { error: updateErr } = await supabase
        .from("teams")
        .update({
          payment_status: "APPROVED",
          status: "CONFIRMED",
        })
        .eq("id", teamId);

      if (updateErr) {
        console.warn("Erro ao simular aprovação:", updateErr.message);
      }

      setIsPaid(true);
      setTimeout(handleRedirect, 2500);
    } catch (err) {
      console.error("Erro ao simular webhook:", err);
    } finally {
      setCheckingPayment(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-[#0f0f0f] border border-[#27272a] rounded-3xl p-6 sm:p-8 text-[#e4e4e7] shadow-2xl relative overflow-hidden selection:bg-orange-500/30 selection:text-white">
      {/* Linha decorativa superior no topo do card */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500" />

      {/* Botão de Fechar */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Estado 1: Comprovante Enviado com Sucesso */}
      {receiptSuccess ? (
        <div className="py-8 text-center space-y-4 animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
            <CheckCircle2 className="h-10 w-10 animate-bounce" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[11px] font-black uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>COMPROVANTE ENVIADO</span>
          </div>

          <h3 className="text-2xl font-black font-display uppercase tracking-tight text-white">
            Comprovante enviado! O organizador irá conferir em breve.
          </h3>

          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Seu pagamento foi registrado no sistema. O organizador do torneio receberá uma notificação para validar sua vaga na tabela oficial.
          </p>

          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRedirect}
              className="py-3 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-600/30 cursor-pointer flex items-center gap-2"
            >
              <span>Voltar ao Torneio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : isPaid ? (
        /* Estado 2: Pagamento Confirmado via Webhook/Simulação */
        <div className="py-8 text-center space-y-4 animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="h-10 w-10 animate-bounce" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PAGAMENTO APROVADO</span>
          </div>

          <h3 className="text-2xl font-black font-display uppercase tracking-tight text-white">
            Inscrição Confirmada!
          </h3>

          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            O Pix de <strong className="text-white">{formatCurrency(totalAmount)}</strong> foi identificado com sucesso. Sua equipe já está apta para a chave de jogos!
          </p>

          <div className="pt-4">
            <button
              type="button"
              onClick={handleRedirect}
              className="py-3 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/30 cursor-pointer flex items-center gap-2 mx-auto"
            >
              <span>Acessar Torneio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Estado 3: Checkout Pix Normal com QR Code + Botão Anexar Comprovante */
        <div className="space-y-6">
          {/* 1. Header do Pedido */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[11px] font-black uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span>INSCRIÇÃO PENDENTE</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white font-display mt-2 tracking-tight">
              {tournamentName}
            </h2>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-zinc-400">
              <span>
                Equipe: <strong className="text-zinc-200">{teamName}</strong>
              </span>
              <span>•</span>
              <span>
                Capitão: <strong className="text-zinc-200">{captainName}</strong>
              </span>
              {sportType && (
                <>
                  <span>•</span>
                  <span>
                    Modalidade: <strong className="text-zinc-200">{sportType}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Mensagem de Erro Geral ou de Upload */}
          {(error || receiptError) && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{receiptError || error}</span>
              </div>
              {error && (
                <button
                  type="button"
                  onClick={generatePix}
                  className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-lg text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Tentar de novo</span>
                </button>
              )}
            </div>
          )}

          {/* 2. Card de Valor Total e Transparência do Split */}
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-2xl p-5 text-center shadow-inner space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
              VALOR TOTAL
            </span>
            <div className="text-3xl sm:text-4xl font-black text-white font-display tracking-tight text-shadow-sm">
              {formatCurrency(totalAmount)}
            </div>

            {split && (
              <div className="pt-2 border-t border-zinc-800/80 mt-2 flex items-center justify-center gap-4 text-[11px] text-zinc-400">
                <span>
                  Taxa SportConnect (10%):{" "}
                  <strong className="text-zinc-300">
                    {formatCurrency(split.platformFee)}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Organizador:{" "}
                  <strong className="text-zinc-300">
                    {formatCurrency(split.organizerAmount)}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* 3. Área do QR Code com Loading Spinner */}
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-2xl p-6 text-center space-y-4">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
                  <QrCode className="w-5 h-5 text-orange-400 absolute inset-0 m-auto" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-200">
                    Gerando QR Code Pix
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Calculando split e conectando ao gateway bancário...
                  </p>
                </div>
              </div>
            ) : qrCodeImageUrl ? (
              <div className="flex flex-col items-center justify-center space-y-3">
                {/* Quadro branco com bordas arredondadas para o QR Code */}
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xl border-4 border-zinc-900 inline-flex items-center justify-center transition-transform hover:scale-[1.01]">
                  <img
                    src={qrCodeImageUrl}
                    alt="QR Code Pix Dinâmico"
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain select-none"
                  />
                </div>

                <div className="space-y-1 text-center">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Pague via Pix</span>
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                    Escaneie o QR Code acima apontando a câmera do aplicativo do seu banco.
                  </p>
                </div>
              </div>
            ) : null}

            {/* 4. Pix Copia e Cola */}
            {!loading && copiaECola && (
              <div className="space-y-2 text-left pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
                    Pix Copia e Cola
                  </label>
                  <span className="text-[10px] text-zinc-500 font-medium">
                    Válido por 30 minutos
                  </span>
                </div>

                <div className="flex items-center gap-2 p-2 bg-[#0f0f0f] border border-[#27272a] rounded-xl focus-within:border-orange-500/60 transition-colors">
                  <div className="flex-1 min-w-0 px-2 font-mono text-xs text-zinc-300 truncate select-all">
                    {copiaECola}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      copied
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/60"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5. Área Inferior: Botão Largo Azul Claro/Lilás para Anexar Comprovante */}
          <div className="space-y-3 pt-1">
            {/* Input de arquivo invisível */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadReceipt(file);
              }}
            />

            {/* Botão Largo em cor azul clara / lilás (Design UI Original) para Anexar */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingReceipt}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#93c5fd] hover:bg-[#bfdbfe] text-neutral-950 font-black text-sm uppercase tracking-wider transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2.5 border border-blue-200"
            >
              {isUploadingReceipt ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                  <span>Enviando Comprovante...</span>
                </>
              ) : receiptSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                  <span>Comprovante Anexado com Sucesso!</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-neutral-950" />
                  <span>Anexar Comprovante</span>
                </>
              )}
            </button>

            {/* Botão Concluir Pagamento - ativado apenas após ciclo assíncrono com sucesso */}
            <button
              type="button"
              onClick={handleRedirect}
              disabled={!receiptSuccess || isUploadingReceipt}
              className={`w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-lg ${
                receiptSuccess && !isUploadingReceipt
                  ? "bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/25 cursor-pointer active:scale-[0.99]"
                  : "bg-zinc-800/80 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-50"
              }`}
            >
              {isUploadingReceipt ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando Comprovante...</span>
                </>
              ) : receiptSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-neutral-950" />
                  <span>Concluir Pagamento</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span>Concluir Pagamento</span>
                </>
              )}
            </button>

            {/* Texto de Segurança com Ícone */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-medium text-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Pagamento 100% Seguro via SportConnect Pay</span>
            </div>

            {/* Status Informativo Suave */}
            <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 text-center">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
              </span>
              <span>
                Aguardando confirmação do pagamento... (Atualização automática)
              </span>
            </div>

            {/* Ações de Apoio / Fechamento */}
            <div className="flex items-center justify-between gap-3 pt-1">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer text-center"
                >
                  Concluir Pagamento Mais Tarde
                </button>
              )}

              {/* Opção discreta de simular webhook em desenvolvimento/testes */}
              <button
                type="button"
                onClick={handleSimulatePaymentApproval}
                disabled={checkingPayment}
                className="py-2.5 px-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/60 text-[10px] font-bold text-zinc-500 hover:text-emerald-400 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                title="Simula a confirmação via webhook bancário instantâneo"
              >
                {checkingPayment ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                <span>Simular Aprovação</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
