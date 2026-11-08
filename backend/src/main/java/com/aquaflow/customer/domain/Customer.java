package com.aquaflow.customer.domain;

import java.time.Instant;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;

@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", unique = true)
    private Long userId;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(length = 20)
    private String phone;

    @Column(name = "customer_type", nullable = false, length = 20)
    private String customerType = DEFAULT_TYPE;

    @Column(length = 150)
    private String area;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static final String DEFAULT_TYPE = "Cá nhân";

    protected Customer() {
    }

    public Customer(String fullName, String phone) {
        this(null, fullName, phone);
    }

    public Customer(Long userId, String fullName, String phone) {
        this.userId = userId;
        this.fullName = fullName;
        this.phone = phone;
        this.createdAt = Instant.now();
    }

    public void updateDetails(String fullName, String phone) {
        this.fullName = fullName;
        this.phone = phone;
    }

    /** Null keeps the current value so older clients that omit these fields do not erase them; blank clears area/note. */
    public void updateProfile(String customerType, String area, String note) {
        if (customerType != null && !customerType.isBlank()) this.customerType = customerType.trim();
        if (area != null) this.area = area.isBlank() ? null : area.trim();
        if (note != null) this.note = note.isBlank() ? null : note.trim();
    }

    public void deactivate() {
        this.active = false;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getFullName() {
        return fullName;
    }

    public String getPhone() {
        return phone;
    }

    public String getCustomerType() {
        return customerType;
    }

    public String getArea() {
        return area;
    }

    public String getNote() {
        return note;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public boolean isActive() {
        return active;
    }
}
