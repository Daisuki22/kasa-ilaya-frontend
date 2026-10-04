import React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';

export const resortCalendarClassNames = {
  months: 'flex w-full justify-center',
  month: 'w-full max-w-[32rem] space-y-4 sm:space-y-5',
  caption: 'relative flex h-10 items-center justify-center px-10',
  caption_label: 'font-display text-base font-semibold sm:text-lg',
  nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
  nav_button: 'flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground',
  table: 'w-full table-fixed border-collapse',
  head_row: 'grid grid-cols-7',
  head_cell: 'flex h-8 items-center justify-center rounded-md text-xs font-medium text-muted-foreground sm:h-10 sm:text-sm',
  row: 'grid grid-cols-7 gap-y-1 sm:gap-y-2',
  cell: 'flex h-10 min-w-0 items-center justify-center p-0 text-center text-sm sm:h-14',
  day: 'flex h-9 w-9 items-center justify-center rounded-xl p-0 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-selected:opacity-100 sm:h-12 sm:w-12',
  day_selected: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
  day_today: 'bg-secondary/10 font-semibold text-secondary ring-1 ring-secondary/40',
  day_outside: 'day-outside text-muted-foreground/50',
  day_disabled: 'text-muted-foreground/45 hover:bg-transparent',
  day_hidden: 'invisible',
};

export function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        row: 'flex w-full mt-2',
        cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md focus-within:relative focus-within:z-20',
        day: 'h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md',
        day_range_end: 'day-range-end',
        day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'bg-accent text-accent-foreground',
        day_outside: 'day-outside text-muted-foreground opacity-50',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  );
}
