package com.aquaflow.workspace.application;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.notifications.owner-alerts.enabled", havingValue = "true", matchIfMissing = true)
public class OwnerAlertScheduler {
    private final OwnerAlertService service;

    public OwnerAlertScheduler(OwnerAlertService service) { this.service = service; }

    @Scheduled(initialDelayString = "${app.notifications.owner-alerts.initial-delay-ms:10000}",
            fixedDelayString = "${app.notifications.owner-alerts.delay-ms:30000}")
    public void refresh() { service.refresh(); }
}
