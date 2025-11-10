// Generic pagination and cursor utilities (ESM)
export const Pagination = {
  paginate(items, { page = 1, pageSize = 10, orderBy = 'createdAt', order = 'desc' } = {}) {
    const sorted = [...items].sort((a, b) => {
      const av = (a?.[orderBy] ?? 0);
      const bv = (b?.[orderBy] ?? 0);
      if (order === 'asc') return av > bv ? 1 : av < bv ? -1 : 0;
      return av < bv ? 1 : av > bv ? -1 : 0;
    });
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return { items: sorted.slice(start, end), page: currentPage, pageSize, total, totalPages };
  },
  cursor(items, { cursor = null, limit = 10, orderBy = 'createdAt', order = 'desc' } = {}) {
    const sorted = [...items].sort((a, b) => {
      const av = (a?.[orderBy] ?? 0);
      const bv = (b?.[orderBy] ?? 0);
      if (order === 'asc') return av > bv ? 1 : av < bv ? -1 : 0;
      return av < bv ? 1 : av > bv ? -1 : 0;
    });
    let startIndex = 0;
    if (cursor != null) {
      startIndex = sorted.findIndex(i => (i?.id ?? i?.[orderBy]) === cursor);
      startIndex = startIndex >= 0 ? startIndex + 1 : 0;
    }
    const slice = sorted.slice(startIndex, startIndex + limit);
    const last = slice[slice.length - 1] || null;
    const nextCursor = last ? (last?.id ?? last?.[orderBy]) : null;
    return { items: slice, nextCursor, hasNext: startIndex + limit < sorted.length };
  }
};

