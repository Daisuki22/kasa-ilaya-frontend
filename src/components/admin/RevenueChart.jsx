import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { calculateDashboardRevenue, formatPHPAmount } from "@/lib/dashboardRevenue";
import { useChartMetrics } from "@/hooks/useChartMetrics";

export default function RevenueChart({ bookings }) {
  const { monthlyData } = calculateDashboardRevenue(bookings);
  const chartMetrics = useChartMetrics();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Monthly Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={chartMetrics.margin}>
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
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
