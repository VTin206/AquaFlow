package com.aquaflow.operations.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.operations.application.*;
import com.aquaflow.shared.api.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/** The /admin namespace is protected by the ADMIN role in SecurityConfig. */
@RestController
@RequestMapping("/api/v1/admin/workspace")
public class WorkspaceController {
    private final WorkspaceQueries queries;
    private final WorkspaceCommands commands;
    public WorkspaceController(WorkspaceQueries queries,WorkspaceCommands commands) {this.queries=queries;this.commands=commands;}
    private static final Set<String> READS=Set.of("products/list","products/lots","products/receipts","orders/list","customers/list","customers/ledger","suppliers/list","trips/list","settings/get","activity/list","reports/data");
    public record Request(JsonNode args,UUID requestId) {}
    @PostMapping("/{resource}/{action}")
    public Object call(@PathVariable String resource,@PathVariable String action,@RequestBody Request request,@AuthenticationPrincipal AuthUserDetails user) {
        if(request.args()==null || !request.args().isArray() || request.args().size()>4) throw new BadRequestException("Danh sách tham số không hợp lệ.");
        if(READS.contains(resource+"/"+action)) return queries.read(resource,action,request.args());
        if(request.requestId()==null) throw new BadRequestException("Thiếu mã yêu cầu.");
        return commands.execute(resource,action,request.args(),user.user().getId(),request.requestId());
    }
}
