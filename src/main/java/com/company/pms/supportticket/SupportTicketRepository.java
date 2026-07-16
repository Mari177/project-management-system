package com.company.pms.supportticket;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long>, JpaSpecificationExecutor<SupportTicket> {

    Optional<SupportTicket> findTopByTicketCodeStartingWithOrderByTicketCodeDesc(String prefix);

    boolean existsByTicketCode(String ticketCode);

    List<SupportTicket> findBySupportProjectIdOrderByReportedAtDesc(Long supportProjectId);

    List<SupportTicket> findBySupportProjectClientIdOrderByReportedAtDesc(Long clientId);

    List<SupportTicket> findByAssignedResourceAppUserIdOrderByReportedAtDesc(Long appUserId);
}
