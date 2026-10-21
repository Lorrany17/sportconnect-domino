"use client";

import React from "react";
import { useParams } from "next/navigation";
import BracketViewer from "@/components/BracketViewer";

export default function TournamentChaveamentoPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  return <BracketViewer tournamentId={id} />;
}
