package com.company.pms.resource;

import com.company.pms.auth.AppUser;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "resources")
@Data
public class ResourceEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private String resourceName;

  /*
   * Company/job title of this person.
   * Example: CEO, CTO, Team Lead, Java Developer, QA Engineer.
   *
   * This is NOT the system permission role.
   */
  private String designation;

  private String department;

  private String skill;

  private Double monthlySalary;

  private String status;

  /*
   * Country is used for regional filtering.
   * Example: INDIA, UAE, USA, UK
   */
  private String country;

  /*
   * Location is display information.
   * Example: Chennai, Bangalore, Dubai, London
   */
  private String location;

  @OneToOne
  @JoinColumn(name = "app_user_id", nullable = true, unique = true)
  @JsonIgnoreProperties({ "password", "managerUser" })
  private AppUser appUser;
}