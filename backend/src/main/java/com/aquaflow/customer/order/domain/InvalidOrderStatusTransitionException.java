package com.aquaflow.customer.order.domain;

/** Raised when an order is asked to move to a status that is not allowed. */
public class InvalidOrderStatusTransitionException extends IllegalStateException {

    public InvalidOrderStatusTransitionException(String message) {
        super(message);
    }
}
