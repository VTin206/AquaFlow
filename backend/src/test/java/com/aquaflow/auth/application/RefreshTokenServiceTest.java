package com.aquaflow.auth.application;

import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.domain.UserStatus;
import com.aquaflow.auth.repository.RefreshTokenRepository;
import com.aquaflow.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-11T03:00:00Z");
    private static final UUID FAMILY = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Mock
    private RefreshTokenRepository tokens;

    @Mock
    private UserRepository users;

    private RefreshTokenService service;
    private User user;

    @BeforeEach
    void setUp() {
        RefreshTokenProperties properties = new RefreshTokenProperties();
        properties.setDays(14);
        service = new RefreshTokenService(tokens, users, properties, Clock.fixed(NOW, ZoneOffset.UTC));
        user = new User(new Role("SALES_STAFF", "Sales"), "Trang", "trang@example.com", null, "hash", UserStatus.ACTIVE);
        ReflectionTestUtils.setField(user, "id", 5L);
    }

    @Test
    void issueStoresOnlyTheHashWithANewFamilyAndCleansExpiredTokens() {
        String raw = service.issue(user);

        ArgumentCaptor<String> hash = ArgumentCaptor.forClass(String.class);
        verify(tokens).deleteExpired(5L, NOW);
        verify(tokens).insert(hash.capture(), any(UUID.class), eq(5L), eq(0), eq(NOW), eq(NOW.plusSeconds(14 * 86400)));
        assertThat(raw).hasSizeGreaterThanOrEqualTo(43).doesNotContain("=");
        assertThat(hash.getValue()).isEqualTo(RefreshTokenService.hash(raw)).isNotEqualTo(raw).hasSize(64);
    }

    @Test
    void rotateRevokesTheOldTokenAndIssuesANewOneInTheSameFamily() {
        when(tokens.lock(RefreshTokenService.hash("old"))).thenReturn(Optional.of(token(null, NOW.plusSeconds(60), 0)));
        when(users.findById(5L)).thenReturn(Optional.of(user));

        RefreshTokenService.Rotated rotated = service.rotate("old");

        assertThat(rotated.user()).isSameAs(user);
        assertThat(rotated.token()).isNotEqualTo("old");
        verify(tokens).revoke(1L, NOW);
        verify(tokens).insert(eq(RefreshTokenService.hash(rotated.token())), eq(FAMILY), eq(5L), eq(0), eq(NOW), any());
        verify(tokens, never()).revokeFamily(any(), any());
    }

    @Test
    void reusingARotatedTokenAfterTheGracePeriodRevokesTheWholeFamily() {
        Instant rotatedLongAgo = NOW.minus(RefreshTokenService.REUSE_GRACE).minusSeconds(1);
        when(tokens.lock(anyString())).thenReturn(Optional.of(token(rotatedLongAgo, NOW.plusSeconds(60), 0)));

        assertThatThrownBy(() -> service.rotate("stolen")).isInstanceOf(InvalidRefreshTokenException.class);
        verify(tokens).revokeFamily(FAMILY, NOW);
        verify(tokens, never()).insert(anyString(), any(), anyLong(), anyInt(), any(), any());
    }

    @Test
    void reusingWithinTheGracePeriodIsRejectedWithoutEndingTheSession() {
        // Hai tab cùng làm mới: tab chậm bị từ chối nhưng phiên (cookie mới của tab kia) vẫn dùng được.
        when(tokens.lock(anyString())).thenReturn(Optional.of(token(NOW.minusSeconds(5), NOW.plusSeconds(60), 0)));

        assertThatThrownBy(() -> service.rotate("raced")).isInstanceOf(InvalidRefreshTokenException.class);
        verify(tokens, never()).revokeFamily(any(), any());
    }

    @Test
    void expiredUnknownOrBlankTokensAreRejected() {
        when(tokens.lock(RefreshTokenService.hash("expired"))).thenReturn(Optional.of(token(null, NOW, 0)));
        when(tokens.lock(RefreshTokenService.hash("unknown"))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rotate("expired")).isInstanceOf(InvalidRefreshTokenException.class);
        verify(tokens).revoke(1L, NOW);
        assertThatThrownBy(() -> service.rotate("unknown")).isInstanceOf(InvalidRefreshTokenException.class);
        assertThatThrownBy(() -> service.rotate(" ")).isInstanceOf(InvalidRefreshTokenException.class);
        assertThatThrownBy(() -> service.rotate(null)).isInstanceOf(InvalidRefreshTokenException.class);
    }

    @Test
    void passwordChangeOrLockedAccountEndsTheSession() {
        when(tokens.lock(anyString())).thenReturn(Optional.of(token(null, NOW.plusSeconds(60), 0)));
        user.changePassword("new-hash");
        when(users.findById(5L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.rotate("before-reset")).isInstanceOf(InvalidRefreshTokenException.class);
        verify(tokens).revokeFamily(FAMILY, NOW);

        User locked = new User(new Role("SALES_STAFF", "Sales"), "Trang", "trang@example.com", null, "hash", UserStatus.INACTIVE);
        when(users.findById(5L)).thenReturn(Optional.of(locked));
        when(tokens.lock(anyString())).thenReturn(Optional.of(token(null, NOW.plusSeconds(60), locked.getCredentialsVersion())));
        assertThatThrownBy(() -> service.rotate("locked")).isInstanceOf(InvalidRefreshTokenException.class);
    }

    @Test
    void logoutRevokesTheFamilyAndIgnoresMissingCookies() {
        when(tokens.lock(RefreshTokenService.hash("current"))).thenReturn(Optional.of(token(null, NOW.plusSeconds(60), 0)));

        service.revoke("current");
        service.revoke(null);

        verify(tokens).revokeFamily(FAMILY, NOW);
    }

    private static RefreshTokenRepository.Token token(Instant revokedAt, Instant expiresAt, int credentialsVersion) {
        return new RefreshTokenRepository.Token(1L, FAMILY, 5L, credentialsVersion, expiresAt, revokedAt);
    }
}
