import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabase } from "@/lib/supabase";

// Inicializa o cliente do Mercado Pago V2
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});
const payment = new Payment(client);

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    console.log("Notificação de Webhook do Mercado Pago recebida:", {
      query: Object.fromEntries(url.searchParams.entries()),
      body,
    });

    // 1. Extrair data.id (ID do pagamento)
    const paymentId =
      body?.data?.id ||
      body?.id ||
      url.searchParams.get("data.id") ||
      url.searchParams.get("id");

    if (!paymentId) {
      console.log("Webhook do Mercado Pago recebido sem data.id (provável teste ou ping).");
      return NextResponse.json(
        { received: true, message: "Webhook recebido sem identificador de pagamento." },
        { status: 200 }
      );
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.warn("Aviso: MERCADOPAGO_ACCESS_TOKEN não configurado para processar webhook.");
      return NextResponse.json(
        { error: "Credenciais do Mercado Pago não configuradas." },
        { status: 500 }
      );
    }

    // 2. Consultar a API do Mercado Pago para verificar o status real desse pagamento
    const paymentInfo = await payment.get({ id: String(paymentId) });
    const paymentStatus = paymentInfo?.status;

    console.log(`Status do pagamento ${paymentId} no Mercado Pago:`, paymentStatus);

    // 3. Se o status for approved, atualizar na tabela teams (payment_status = APPROVED)
    if (paymentStatus === "approved") {
      const { data: updatedTeams, error: updateError } = await supabase
        .from("teams")
        .update({
          payment_status: "APPROVED",
          status: "CONFIRMED",
        })
        .eq("mp_payment_id", String(paymentId))
        .select();

      if (updateError) {
        console.error("Erro ao atualizar equipe via webhook:", updateError);
        return NextResponse.json(
          { error: "Erro ao atualizar equipe no banco de dados.", details: updateError.message },
          { status: 500 }
        );
      }

      console.log(`Equipe atualizada para APPROVED via Webhook (${paymentId}):`, updatedTeams);
    } else if (paymentStatus === "refunded") {
      // Se tiver sido estornado pelo Mercado Pago
      const { error: refundError } = await supabase
        .from("teams")
        .update({
          payment_status: "CANCELED",
          status: "CANCELED",
          cancellation_status: "REFUNDED",
        })
        .eq("mp_payment_id", String(paymentId));

      if (refundError) {
        console.warn("Erro ao atualizar estorno via webhook:", refundError);
      }
    }

    return NextResponse.json(
      {
        received: true,
        paymentId: String(paymentId),
        status: paymentStatus,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro ao processar webhook do Mercado Pago:", error);
    return NextResponse.json(
      {
        error: error?.message || "Erro interno ao processar webhook do Mercado Pago.",
      },
      { status: 500 }
    );
  }
}

// GET para health check ou verificação do painel do Mercado Pago
export async function GET() {
  return NextResponse.json(
    { status: "active", service: "Mercado Pago Webhook Route - SportConnect" },
    { status: 200 }
  );
}
