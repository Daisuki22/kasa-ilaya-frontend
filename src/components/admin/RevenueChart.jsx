import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { calculateDashboardRevenue, formatPHPAmount } from "@/lib/dashboardRevenue";
import { useChartMetrics } from "@/hooks/useChartMetrics";

export default function RevenueChart({ bookings, year }) {
  const chartDate = year ? new Date(Number(year), new Date().getMonth(), 1) : new Date();
  const { monthlyData } = calculateDashboardRevenue(bookings, chartDate);
  const chartMetrics = useChartMetrics();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">{year ? `Monthly Revenue (${year})` : "Monthly Revenue"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={chartMetrics.margin}>
              <defs>
                <linearGradient id="monthlyRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" />
                  <stop offset="100%" stopColor="hsl(var(--chart-3))" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: chartMetrics.tickFontSize }} angle={chartMetrics.xAxisAngle} height={chartMetrics.xAxisHeight} stroke="hsl(var(--muted-foreground))" />
              <YAxis width={chartMetrics.tickFontSize * 4} tick={{ fontSize: chartMetrics.tickFontSize }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value) => [formatPHPAmount(value), "Revenue"]}
              />
              <Bar dataKey="revenue" fill="url(#monthlyRevenueGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
