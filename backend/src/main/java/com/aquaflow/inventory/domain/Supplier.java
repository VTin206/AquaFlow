package com.aquaflow.inventory.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "suppliers")
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 20)
    private String phone;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "contact_name", length = 150)
    private String contactName;

    @Column(length = 254)
    private String email;

    @Column(nullable = false)
    private boolean active;

    protected Supplier() {
    }

    public Supplier(String name, String phone, String address) {
        this.name = name;
        this.phone = phone;
        this.address = address;
        this.active = true;
    }

    public void update(String name, String phone, String address) {
        this.name = name;
        this.phone = phone;
        this.address = address;
    }

    /** Null keeps the current value so older clients that omit these fields do not erase them. */
    public void updateContact(String contactName, String email) {
        if (contactName != null) this.contactName = contactName.isBlank() ? null : contactName.trim();
        if (email != null) this.email = email.isBlank() ? null : email.trim();
    }

    public void deactivate() {
        this.active = false;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getAddress() { return address; }
    public String getContactName() { return contactName; }
    public String getEmail() { return email; }
    public boolean isActive() { return active; }
}