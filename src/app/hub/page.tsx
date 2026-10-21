"use client";

import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import HubCentral from "@/components/HubCentral";

export default function HubPage() {
  return (
    <ProtectedRoute>
      <HubCentral />
    </ProtectedRoute>
  );
}
