package com.aquaflow.workspace;

import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.shared.api.*;
import com.aquaflow.workspace.api.*;
import com.aquaflow.workspace.application.*;
import com.aquaflow.workspace.repository.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkspaceServiceTest {
    StoreSettingsRepository settings = mock(StoreSettingsRepository.class);
    NotificationRepository notifications = mock(NotificationRepository.class);
    UserRepository users = mock(UserRepository.class);
    StoreSettingsService settingsService = new StoreSettingsService(settings);
    NotificationService notificationService = new NotificationService(notifications, users);
    StoreSettingsData data = new StoreSettingsData("Store", "", "", null, null, null, null, null, null, null, 30, 10);

    @Test void staleSettingsCannotOverwriteOrAudit() {
        when(settings.get()).thenReturn(new StoreSettingsResponse(data, 2, Instant.EPOCH, 1L));
        assertThatThrownBy(() -> settingsService.update(new UpdateStoreSettingsRequest(data, 1L), 1))
                .isInstanceOf(ConflictException.class);
        verify(settings, never()).update(any(), anyLong(), anyLong());
        verify(settings, never()).audit(any(), any(), anyLong());
    }

    @Test void concurrentUpdateConflictDoesNotAudit() {
        when(settings.get()).thenReturn(new StoreSettingsResponse(data, 1, Instant.EPOCH, 1L));
        when(settings.update(data, 1, 1)).thenReturn(false);
        assertThatThrownBy(() -> settingsService.update(new UpdateStoreSettingsRequest(data, 1L), 1))
                .isInstanceOf(ConflictException.class);
        verify(settings, never()).audit(any(), any(), anyLong());
    }

    @Test void successfulUpdateRecordsAudit() {
        when(settings.get()).thenReturn(new StoreSettingsResponse(data, 1, Instant.EPOCH, 1L));
        when(settings.update(data, 1, 1)).thenReturn(true);
        settingsService.update(new UpdateStoreSettingsRequest(data, 1L), 1);
        verify(settings).audit(data, data, 1);
    }

    @Test void missingOrOtherUsersNotificationIsNotFound() {
        when(notifications.find(12, 7)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> notificationService.markRead(12, 7)).isInstanceOf(NotFoundException.class);
        verify(notifications).markRead(12, 7);
    }

    @Test void paginationIsBounded() {
        assertThatThrownBy(() -> notificationService.list(1, false, -1, 20)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> notificationService.list(1, false, 0, 101)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> notificationService.list(1, false, 0, 0)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(notifications);
    }

    @Test void missingRecipientCannotReceiveNotification() {
        assertThatThrownBy(() -> notificationService.create(new CreateNotificationRequest(8L, "Title", "Message"), 1))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(notifications);
    }
}
