package com.company.pms.supportticket;

import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.data.domain.Page;

import java.util.List;

@Data
@AllArgsConstructor
public class SupportTicketPageResponse {

    private List<SupportTicket> content;
    private int page;
    private int size;
    private int numberOfElements;
    private long totalElements;
    private int totalPages;
    private boolean first;
    private boolean last;
    private boolean empty;

    private long totalTickets;
    private long openTickets;
    private long resolvedTickets;
    private long closedTickets;

    public static SupportTicketPageResponse from(
            Page<SupportTicket> page,
            long totalTickets,
            long openTickets,
            long resolvedTickets,
            long closedTickets) {

        return new SupportTicketPageResponse(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getNumberOfElements(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast(),
                page.isEmpty(),
                totalTickets,
                openTickets,
                resolvedTickets,
                closedTickets
        );
    }
}
