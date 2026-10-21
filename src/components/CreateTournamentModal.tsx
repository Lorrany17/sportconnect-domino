"use client";

import React from "react";
import { Tournament } from "@/types";
import CreateTournamentForm from "@/components/CreateTournamentForm";

export interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentToEdit?: Tournament | null;
  onTournamentUpdated?: () => void;
}

export default function CreateTournamentModal({
  isOpen,
  onClose,
  tournamentToEdit,
  onTournamentUpdated,
}: CreateTournamentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-2xl my-8">
        <CreateTournamentForm
          isModal={true}
          initialData={tournamentToEdit}
          onClose={onClose}
          onSuccess={() => {
            onTournamentUpdated?.();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
