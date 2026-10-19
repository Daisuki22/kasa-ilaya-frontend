import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, CalendarCheck, Users } from "lucide-react";
import { calculateDashboardRevenue, formatPHPAmount } from "@/lib/dashboardRevenue";

export default function RevenueCards({ bookings, year }) {
  const revenue = calculateDashboardRevenue(bookings, year ? new Date(Number(year), new Date().getMonth(), 1) : new Date());
  const visibleBookings = bookings.filter((booking) => booking.status !== "archived");
  const pendingBookings = visibleBookings.filter((booking) => booking.status === "pending");

  const cards = [
    {
      title: "Total Revenue",
      value: formatPHPAmount(revenue.totalRevenue),
      icon: DollarSign,
      iconColor: "text-primary",
      iconBackground: "bg-primary/10",
      desc: `${revenue.paidBookingCount} paid bookings`,
    },
    {
      title: year ? `Revenue in ${year}` : "Monthly Revenue",
      value: formatPHPAmount(year ? revenue.totalRevenue : revenue.monthlyRevenue),
      icon: TrendingUp,
      iconColor: "text-secondary",
      iconBackground: "bg-secondary/10",
      desc: year ? `${revenue.paidBookingCount} paid bookings in this year` : `${revenue.monthlyPaidBookingCount} paid bookings this month`,
    },
    {
      title: "Total Bookings",
      value: visibleBookings.length,
      icon: CalendarCheck,
      iconColor: "text-chart-3",
      iconBackground: "bg-chart-3/10",
      desc: `${pendingBookings.length} pending`,
    },
    {
      title: "Pending Bookings",
      value: pendingBookings.length,
      icon: Users,
      iconColor: "text-chart-4",
      iconBackground: "bg-chart-4/10",
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
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBackground}`}>
                <card.icon aria-hidden="true" className={`h-5 w-5 stroke-[2.25] ${card.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
