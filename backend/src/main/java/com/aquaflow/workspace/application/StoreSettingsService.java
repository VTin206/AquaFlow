package com.aquaflow.workspace.application;

import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.workspace.api.*;
import com.aquaflow.workspace.repository.StoreSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class StoreSettingsService {
    private final StoreSettingsRepository repository;

    public StoreSettingsService(StoreSettingsRepository repository) { this.repository = repository; }

    public StoreSettingsResponse get() { return repository.get(); }

    @Transactional
    public StoreSettingsResponse update(UpdateStoreSettingsRequest request, long actorId) {
        StoreSettingsResponse before = repository.get();
        if (before.version() != request.version()
                || !repository.update(request.settings(), request.version(), actorId)) {
            throw new ConflictException("Settings have changed; reload before saving");
        }
        repository.audit(before.settings(), request.settings(), actorId);
        return repository.get();
    }
}
