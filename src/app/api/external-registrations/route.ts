import { NextResponse } from "next/server";

export async function GET() {
  // Simular latência de rede de 800ms
  await new Promise((resolve) => setTimeout(resolve, 800));

  const mockExternalRegistrations = [
    {
      id: "ext-1",
      teamName: "Os Reis do Dominó (API)",
      player1: "Adalberto Costa",
      player2: "Bruno Silveira",
      status: "CONFIRMED",
    },
    {
      id: "ext-2",
      teamName: "Carrascos de Realengo",
      player1: "Claudio Duarte",
      player2: "Daniel Ferreira",
      status: "CONFIRMED",
    },
    {
      id: "ext-3",
      teamName: "Dupla Imperial",
      player1: "Eduardo Souza",
      player2: "Felipe Nogueira",
      status: "CONFIRMED",
    },
    {
      id: "ext-4",
      teamName: "Parceria Forte (API)",
      player1: "Gustavo Abreu",
      player2: "Hugo Lima",
      status: "CONFIRMED",
    },
  ];

  return NextResponse.json(mockExternalRegistrations);
}
