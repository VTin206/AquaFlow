package com.aquaflow.customer.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "customer_addresses")
public class CustomerAddress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "recipient_name", nullable = false, length = 150)
    private String recipientName;

    @Column(name = "recipient_phone", nullable = false, length = 20)
    private String recipientPhone;

    @Column(name = "address_line", nullable = false, columnDefinition = "TEXT")
    private String addressLine;

    @Column(length = 150)
    private String area;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault;

    protected CustomerAddress() {
    }

    public CustomerAddress(
            Customer customer,
            String recipientName,
            String recipientPhone,
            String addressLine,
            String area) {

        this.customer = customer;
        this.recipientName = recipientName;
        this.recipientPhone = recipientPhone;
        this.addressLine = addressLine;
        this.area = area;
    }

    public Long getId() {
        return id;
    }

    public Customer getCustomer() {
        return customer;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public String getRecipientPhone() {
        return recipientPhone;
    }

    public String getAddressLine() {
        return addressLine;
    }

    public String getArea() {
        return area;
    }

    public boolean isDefault() {
        return isDefault;
    }

    public void updateDetails(
            String recipientName,
            String recipientPhone,
            String addressLine,
            String area) {

        this.recipientName = recipientName;
        this.recipientPhone = recipientPhone;
        this.addressLine = addressLine;
        this.area = area;
    }

    public void setDefault(boolean isDefault) {
        this.isDefault = isDefault;
    }
}
