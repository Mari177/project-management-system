package com.company.pms.client;

import com.company.pms.common.PageResponse;
import com.company.pms.common.PaginationSupport;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    private static final Map<String, String> CLIENT_SORTS = Map.of(
            "clientName", "clientName",
            "contactPerson", "contactPerson",
            "status", "status",
            "id", "id"
    );

    private final ClientRepository clientRepository;

    public ClientController(ClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

    @GetMapping
    public List<Client> getAllClients() {
        return clientRepository.findAll();
    }

    @GetMapping("/paged")
    public PageResponse<Client> getClientsPaged(
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "clientName") String sort,
            @RequestParam(defaultValue = "asc") String direction) {

        Pageable pageable = PaginationSupport.pageable(
                page,
                size,
                20,
                100,
                sort,
                direction,
                CLIENT_SORTS,
                "clientName"
        );

        Specification<Client> specification = buildSpecification(search, status);
        Page<Client> result = clientRepository.findAll(specification, pageable);
        return PageResponse.from(result);
    }

    @PostMapping
    public Client createClient(@RequestBody Client client) {
        return clientRepository.save(client);
    }

    @GetMapping("/{id}")
    public Client getClientById(@PathVariable Long id) {
        return clientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client not found"));
    }

    @DeleteMapping("/{id}")
    public void deleteClient(@PathVariable Long id) {
        clientRepository.deleteById(id);
    }

    @PutMapping("/{id}")
    public Client updateClient(@PathVariable Long id, @RequestBody Client request) {
        Client client = clientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client not found"));

        client.setClientName(request.getClientName());
        client.setContactPerson(request.getContactPerson());
        client.setEmail(request.getEmail());
        client.setPhone(request.getPhone());
        client.setStatus(request.getStatus());

        return clientRepository.save(client);
    }

    private Specification<Client> buildSpecification(String search, String status) {
        String normalizedSearch = PaginationSupport.normalized(search);
        String normalizedStatus = PaginationSupport.normalizedUpper(status);

        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (normalizedSearch != null) {
                String contains = "%" + normalizedSearch + "%";
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("clientName")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("contactPerson")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("email")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("phone")), contains)
                ));
            }

            if (normalizedStatus != null) {
                predicates.add(criteriaBuilder.equal(criteriaBuilder.upper(root.get("status")), normalizedStatus));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }
}
