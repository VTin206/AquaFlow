package com.aquaflow.activity;

import com.aquaflow.shared.api.BadRequestException;
import org.springframework.web.bind.annotation.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/admin/activity-logs")
@io.swagger.v3.oas.annotations.tags.Tag(name="Activity logs")
@io.swagger.v3.oas.annotations.security.SecurityRequirement(name="bearerAuth")
public class ActivityController {
    private final ActivityRepository repository;
    public ActivityController(ActivityRepository repository) { this.repository=repository; }
    @GetMapping
    @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public ActivityRepository.Page list(@RequestParam(required=false) String area,
        @RequestParam(required=false) Long actorId,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) Instant from,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) Instant to,
        @RequestParam(required=false) String q,
        @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        if(page<0 || page>100000 || size<1 || size>100 || (actorId!=null && actorId<=0)
            || (q!=null && q.length()>200) || (from!=null && to!=null && !from.isBefore(to))
            || (area!=null && !Set.of("ORDERS","DELIVERY","CUSTOMERS","SUPPLIERS","SETTINGS","INVENTORY","OTHER").contains(area)))
            throw new BadRequestException("Bộ lọc nhật ký không hợp lệ");
        return repository.list(area,actorId,from,to,q,page,size);
    }
    @GetMapping("/{id}") public ActivityRepository.Entry get(@PathVariable long id) { return repository.get(id); }
    @GetMapping("/actors") public List<ActivityRepository.Actor> actors() { return repository.actors(); }
}
