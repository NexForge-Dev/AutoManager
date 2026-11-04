"use client";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { brl } from "@/lib/analytics";

// Lê a cor da marca (--brand-600) em runtime, então o gráfico acompanha a cor
// personalizada da loja em vez de um rosa fixo.
function useCorMarca() {
  const [rgb, setRgb] = useState("219 39 119");
  useEffect(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--brand-600").trim();
    if (v) setRgb(v);
  }, []);
  return `rgb(${rgb})`;
}

function TooltipCustom({ active, payload, label, formatLabel }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="surface shadow-pop rounded-xl border border-default px-3 py-2 text-xs">
      {label != null && <div className="text-muted mb-0.5">{formatLabel ? formatLabel(label) : label}</div>}
      <div className="font-bold text-sm">{brl(payload[0].value)}</div>
    </div>
  );
}

// Gráfico de área isolado, carregado sob demanda (next/dynamic), tirando o peso
// do recharts do bundle inicial. Reutilizado no painel e nos relatórios.
export default function VendasArea({
  data,
  xKey = "dia",
  yKey = "total",
  gradientId = "g",
  interval = 2,
  height = 140,
  formatLabel,
}: {
  data: any[];
  xKey?: string;
  yKey?: string;
  gradientId?: string;
  interval?: number | "preserveStart" | "preserveEnd" | "preserveStartEnd";
  height?: number;
  formatLabel?: (v: any) => string;
}) {
  const cor = useCorMarca();
  // sem animação para quem prefere menos movimento
  const [animar, setAnimar] = useState(false);
  useEffect(() => {
    setAnimar(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={cor} stopOpacity={0.28} />
              <stop offset="95%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            dataKey={xKey}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={interval}
            stroke="var(--text-muted)"
            padding={{ left: 14, right: 14 }}
          />
          <Tooltip
            content={<TooltipCustom formatLabel={formatLabel} />}
            cursor={{ stroke: cor, strokeOpacity: 0.4, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={cor}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: cor, stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={animar}
            animationDuration={750}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
