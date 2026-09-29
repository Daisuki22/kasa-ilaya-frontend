import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const getPageItems = (page, totalPages) => {
  const values = new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages));
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.flatMap((value, index) => index && value - sorted[index - 1] > 1 ? ["ellipsis", value] : [value]);
};

export default function PaginationControls({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const first = (currentPage - 1) * pageSize + 1;
  const last = Math.min(currentPage * pageSize, total);
  const pageItems = getPageItems(currentPage, totalPages);

  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground sm:justify-start">
        <span>Showing {first}–{last} of {total}</span>
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Rows per page"
          >
            {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="min-w-16 text-center text-sm text-muted-foreground sm:hidden">{currentPage} / {totalPages}</span>
        <div className="hidden items-center gap-1 sm:flex">
          {pageItems.map((item, index) => item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-muted-foreground" aria-hidden="true">…</span>
          ) : (
            <Button key={item} variant={item === currentPage ? "default" : "outline"} size="sm" className="min-w-9 px-2" onClick={() => onPageChange(item)} aria-current={item === currentPage ? "page" : undefined} aria-label={`Page ${item}`}>
              {item}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Next page">
          <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
