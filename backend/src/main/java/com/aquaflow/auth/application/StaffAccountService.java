package com.aquaflow.auth.application;

import com.aquaflow.auth.api.dto.StaffRequests;
import com.aquaflow.auth.api.dto.UserResponse;
import com.aquaflow.auth.domain.*;
import com.aquaflow.auth.repository.*;
import com.aquaflow.shared.api.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Locale;

@Service
@Transactional(readOnly = true)
public class StaffAccountService {
    private static final List<String> STAFF = List.of("SALES_STAFF", "DELIVERY_STAFF");
    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwords;
    public StaffAccountService(UserRepository users, RoleRepository roles, PasswordEncoder passwords) {
        this.users = users; this.roles = roles; this.passwords = passwords;
    }
    public List<UserResponse> list() {
        return users.findByRoleCodeInOrderByIdDesc(STAFF).stream().map(StaffAccountService::view).toList();
    }
    public UserResponse get(long id) { return view(staff(id)); }
    @Transactional
    public UserResponse create(StaffRequests.Create request) {
        if (!STAFF.contains(request.role())) throw new BadRequestException("Invalid staff role");
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.findByEmailIgnoreCase(email).isPresent()) throw new ConflictException("Email already exists");
        Role role = roles.findByCodeIgnoreCase(request.role()).orElseThrow(() -> new BadRequestException("Staff role not configured"));
        return view(users.saveAndFlush(new User(role, request.fullName().trim(), email, clean(request.phone()),
                encode(request.password()), UserStatus.ACTIVE)));
    }
    @Transactional
    public UserResponse update(long id, StaffRequests.Update request) {
        User account = staff(id);
        account.updateStaffProfile(request.fullName().trim(), clean(request.phone()), request.status());
        return view(account);
    }
    @Transactional
    public void password(long id, StaffRequests.Password request) {
        staff(id).changePassword(encode(request.password()));
    }
    private String encode(String password) {
        if (password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
            throw new BadRequestException("Password must not exceed 72 UTF-8 bytes");
        return passwords.encode(password);
    }
    private User staff(long id) {
        return users.findById(id).filter(u -> STAFF.contains(u.getRole().getCode()))
                .orElseThrow(() -> new NotFoundException("Staff account not found"));
    }
    private static String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static UserResponse view(User user) {
        return new UserResponse(user.getId(), user.getFullName(), user.getEmail(), user.getPhone(),
                user.getRole().getCode(), user.getStatus().name());
    }
}
