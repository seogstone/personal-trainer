"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type LineDef = {
  dataKey: string;
  name: string;
  color: string;
};

export function TrendChart({ title, data, lines }: { title: string; data: Array<Record<string, string | number>>; lines: LineDef[] }) {
  return (
    <section className="rounded-md border border-border bg-panel p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 h-72">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 12, bottom: 4 }}>
            <CartesianGrid stroke="#d7dee8" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} width={36} />
            <Tooltip />
            {lines.map((line) => (
              <Line dataKey={line.dataKey} dot={false} key={line.dataKey} name={line.name} stroke={line.color} strokeWidth={2} type="monotone" />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
