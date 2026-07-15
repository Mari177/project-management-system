package com.company.pms.supportticket;

import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class SupportTicketCodeService {

    private static final String COMPANY_PREFIX = "NI";
    private static final String TICKET_PREFIX = "TKT";
    private static final int CODE_LENGTH = 6;

    private final SupportTicketRepository supportTicketRepository;

    public SupportTicketCodeService(SupportTicketRepository supportTicketRepository) {
        this.supportTicketRepository = supportTicketRepository;
    }

    public synchronized String generateTicketCode(LocalDate date) {
        int year = date != null ? date.getYear() : LocalDate.now().getYear();
        String prefix = COMPANY_PREFIX + "-" + TICKET_PREFIX + "-" + year + "-";

        int nextNumber = supportTicketRepository
                .findTopByTicketCodeStartingWithOrderByTicketCodeDesc(prefix)
                .map(ticket -> extractSequence(ticket.getTicketCode(), prefix))
                .orElse(0) + 1;

        String ticketCode;

        do {
            ticketCode = prefix + String.format("%0" + CODE_LENGTH + "d", nextNumber);
            nextNumber++;
        } while (supportTicketRepository.existsByTicketCode(ticketCode));

        return ticketCode;
    }

    private int extractSequence(String ticketCode, String prefix) {
        if (ticketCode == null || !ticketCode.startsWith(prefix)) {
            return 0;
        }

        try {
            return Integer.parseInt(ticketCode.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }
}
