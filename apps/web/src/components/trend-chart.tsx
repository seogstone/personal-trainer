"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type LineDef = {
  dataKey: string;
  name: string;
  color: string;
};

export function TrendChart({ title, data, lines }: { title: string; data: Array<Record<string, string | number>>; lines: LineDef[] }) {
  return (
    <section className="rounded-md border border-border bg-panel/90 p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 h-64 sm:h-72">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 12, bottom: 4 }}>
            <CartesianGrid stroke="rgba(238, 232, 213, 0.14)" strokeDasharray="3 3" />
            <XAxis axisLine={false} dataKey="date" tick={{ fill: "#a9a39a", fontSize: 12 }} tickLine={false} />
            <YAxis axisLine={false} tick={{ fill: "#a9a39a", fontSize: 12 }} tickLine={false} width={36} />
            <Tooltip contentStyle={{ background: "#1c1b19", border: "1px solid #3f3b35", borderRadius: 6, color: "#eee8d5" }} />
            {lines.map((line) => (
              <Line dataKey={line.dataKey} dot={false} key={line.dataKey} name={line.name} stroke={line.color} strokeWidth={2} type="monotone" />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
