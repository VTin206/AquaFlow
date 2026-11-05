package com.aquaflow.workspace;

import com.aquaflow.workspace.application.OwnerAlertService;
import com.aquaflow.workspace.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.mockito.Mockito.*;

class OwnerAlertServiceTest {
    @Test void usesVietnamCalendarDateAcrossUtcMidnightBoundary() {
        var repository = mock(NotificationRepository.class);
        var instant = Instant.parse("2026-11-01T17:30:00Z");
        when(repository.tryLockOwnerAlerts()).thenReturn(true);
        new OwnerAlertService(repository, Clock.fixed(instant, ZoneId.of("Asia/Ho_Chi_Minh"))).refresh();
        verify(repository).reconcileOwnerAlerts(LocalDate.of(2026, 11, 2), instant);
    }

    @Test void skipsScanWhenAnotherInstanceHoldsLock() {
        var repository = mock(NotificationRepository.class);
        new OwnerAlertService(repository, Clock.systemUTC()).refresh();
        verify(repository).tryLockOwnerAlerts();
        verifyNoMoreInteractions(repository);
    }
}
