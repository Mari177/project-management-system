package com.company.pms.milestone;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "milestone_master")
@Data
public class MilestoneMaster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "milestone_order", nullable = false, unique = true)
    private Integer milestoneOrder;

    @Column(name = "milestone_name", nullable = false, unique = true)
    private String milestoneName;

    @Column(name = "weight_percentage")
    private Double weightPercentage = 0.0;

    private Boolean active = true;
}