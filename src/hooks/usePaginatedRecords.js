import React, { useMemo, useState } from "react";
import PaginationControls from "@/components/admin/PaginationControls";

export default function usePaginatedRecords(records = [], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = useMemo(
    () => records.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [records, currentPage, pageSize]
  );
  const controls = React.createElement(PaginationControls, {
    page: currentPage,
    pageSize,
    total: records.length,
    onPageChange: setPage,
    onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
  });

  return { visibleRecords, controls };
}
