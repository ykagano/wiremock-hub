import { ref, computed } from 'vue';

const PAGE_SIZE_KEY = 'wiremock-hub-page-size';
const PAGE_SIZES = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

function getStoredPageSize(): number {
  const stored = localStorage.getItem(PAGE_SIZE_KEY);
  if (stored !== null) {
    const num = Number(stored);
    if (PAGE_SIZES.includes(num as (typeof PAGE_SIZES)[number])) {
      return num;
    }
  }
  return DEFAULT_PAGE_SIZE;
}

// Shared reactive state (module-level singleton)
const pageSize = ref(getStoredPageSize());

export function usePageSize() {
  const pageSizeModel = computed({
    get: () => pageSize.value,
    set: (val: number) => {
      pageSize.value = val;
      localStorage.setItem(PAGE_SIZE_KEY, String(val));
    }
  });

  return {
    pageSize: pageSizeModel,
    pageSizes: PAGE_SIZES
  };
}
