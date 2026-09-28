import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, CalendarCheck, Users } from "lucide-react";
import { calculateDashboardRevenue, formatPHPAmount } from "@/lib/dashboardRevenue";

export default function RevenueCards({ bookings }) {
  const revenue = calculateDashboardRevenue(bookings);
  const visibleBookings = bookings.filter((booking) => booking.status !== "archived");
  const pendingBookings = visibleBookings.filter((booking) => booking.status === "pending");

  const cards = [
    {
      title: "Total Revenue",
      value: formatPHPAmount(revenue.totalRevenue),
      icon: DollarSign,
      color: "bg-primary",
      desc: `${revenue.paidBookingCount} paid bookings`,
    },
    {
      title: "Monthly Revenue",
      value: formatPHPAmount(revenue.monthlyRevenue),
      icon: TrendingUp,
      color: "bg-secondary",
      desc: `${revenue.monthlyPaidBookingCount} paid bookings this month`,
    },
    {
      title: "Total Bookings",
      value: visibleBookings.length,
      icon: CalendarCheck,
      color: "bg-chart-3",
      desc: `${pendingBookings.length} pending`,
    },
    {
      title: "Pending Bookings",
      value: pendingBookings.length,
      icon: Users,
      color: "bg-chart-4",
      desc: "Awaiting confirmation",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden">
          <CardContent className="p-5 sm:p-6 sm:pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
              </div>
              <div className={`${card.color} rounded-xl bg-opacity-10 p-2.5`}>
                <card.icon className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
