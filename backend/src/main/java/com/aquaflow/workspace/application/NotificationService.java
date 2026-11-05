package com.aquaflow.workspace.application;

import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.NotFoundException;
import com.aquaflow.workspace.api.*;
import com.aquaflow.workspace.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class NotificationService {
    private final NotificationRepository repository;
    private final UserRepository users;

    public NotificationService(NotificationRepository repository, UserRepository users) {
        this.repository = repository;
        this.users = users;
    }

    public List<NotificationResponse> list(long recipient, boolean unreadOnly, int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new BadRequestException("page must be >= 0; size must be between 1 and 100");
        return repository.list(recipient, unreadOnly, page, size);
    }

    public long unreadCount(long recipient) { return repository.unreadCount(recipient); }

    @Transactional
    public NotificationResponse markRead(long id, long recipient) {
        repository.markRead(id, recipient);
        return repository.find(id, recipient).orElseThrow(() -> new NotFoundException("Notification not found"));
    }

    @Transactional
    public int markAllRead(long recipient) { return repository.markAllRead(recipient); }

    @Transactional
    public NotificationResponse create(CreateNotificationRequest request, long actor) {
        if (!users.existsById(request.recipientId())) throw new NotFoundException("Recipient not found");
        return repository.create(request, actor);
    }
}
