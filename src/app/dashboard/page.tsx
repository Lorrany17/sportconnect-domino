"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import OrganizerDashboard from "@/components/OrganizerDashboard";

export default function DashboardPage() {
  const router = useRouter();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0f0f0f] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 flex flex-col">
        <OrganizerDashboard
          onBack={() => router.push("/hub")}
        />
      </div>
    </ProtectedRoute>
  );
}
