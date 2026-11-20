"use client";

import { useEffect, useState } from "react";

// Cuenta regresiva calculada en el navegador: el sitio es estático y un número
// fijado al compilar quedaría viejo al día siguiente.
export function DaysLeft({ iso, unit }: { iso: string; unit: string }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const end = new Date(`${iso}T23:59:59-06:00`).getTime();
    setDays(Math.max(0, Math.ceil((end - Date.now()) / 86_400_000)));
  }, [iso]);
  return <>{days === null ? "—" : `${days} ${unit}`}</>;
}
