package com.aquaflow.workspace.application;

import com.aquaflow.workspace.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;

@Service
public class OwnerAlertService {
    private final NotificationRepository repository;
    private final Clock clock;

    public OwnerAlertService(NotificationRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional
    public void refresh() {
        if (repository.tryLockOwnerAlerts()) {
            var now = clock.instant();
            repository.reconcileOwnerAlerts(LocalDate.ofInstant(now, clock.getZone()), now);
        }
    }
}
