package com.company.pms.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Map;

public final class PaginationSupport {

    private PaginationSupport() {
    }

    public static Pageable pageable(
            Integer page,
            Integer size,
            int defaultSize,
            int maxSize,
            String sort,
            String direction,
            Map<String, String> allowedSorts,
            String defaultSort) {

        int safePage = page == null || page < 0 ? 0 : page;
        int safeSize = size == null || size <= 0 ? defaultSize : Math.min(size, maxSize);

        String requestedSort = sort == null || sort.isBlank() ? defaultSort : sort.trim();
        String entitySort = allowedSorts.getOrDefault(requestedSort, allowedSorts.get(defaultSort));

        Sort.Direction sortDirection = "asc".equalsIgnoreCase(direction)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        return PageRequest.of(safePage, safeSize, Sort.by(sortDirection, entitySort));
    }

    public static String normalized(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim().toLowerCase();
    }

    public static String normalizedUpper(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim().toUpperCase();
    }
}
